// Minimal GitHub REST helper for the Admin AI Control Portal.
//
// ⚠️ commitToMain() writes DIRECTLY to the default (production) branch — there
// is no pull-request review gate. The only access control is the admin-email
// check on the calling route (/api/admin/chat). The token (GH_AUTOMATION_TOKEN)
// lives only on the server.

const GH_API = "https://api.github.com";

function repoParts() {
  const full = process.env.GITHUB_REPO ?? "";
  const [owner, name] = full.split("/");
  if (!owner || !name) {
    throw new Error("GITHUB_REPO must be set to 'owner/repo'.");
  }
  return { owner, name };
}

function authToken() {
  const t = process.env.GH_AUTOMATION_TOKEN;
  if (!t) throw new Error("GH_AUTOMATION_TOKEN is not set.");
  return t;
}

async function gh<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

const defaultBranch = () => process.env.GITHUB_DEFAULT_BRANCH ?? "main";

// Read a file's current contents from the default branch.
export async function readRepoFile(path: string): Promise<string> {
  const { owner, name } = repoParts();
  const ref = encodeURIComponent(defaultBranch());
  const data = await gh<{ content?: string; type?: string }>(
    `/repos/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=${ref}`,
  );
  if (!data.content) throw new Error(`'${path}' is not a readable file.`);
  return Buffer.from(data.content, "base64").toString("utf8");
}

export type ProposedFile = { path: string; content: string };

// Commit the given files DIRECTLY to the default (production) branch. No PR,
// no review — the new commit fast-forwards `main`. Returns the commit URL.
//
// ⚠️ This bypasses the pull-request review gate by design. The only safeguard
// left is the admin-email check on the calling route — keep it.
export async function commitToMain(opts: {
  message: string;
  files: ProposedFile[];
}): Promise<{ commitSha: string; commitUrl: string; branch: string }> {
  if (!opts.files?.length) throw new Error("No files provided.");
  const { owner, name } = repoParts();
  const base = defaultBranch();
  const repo = `/repos/${owner}/${name}`;

  // 1. Resolve the current tip of main + its tree.
  const ref = await gh<{ object: { sha: string } }>(
    `${repo}/git/ref/heads/${base}`,
  );
  const baseSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(
    `${repo}/git/commits/${baseSha}`,
  );

  // 2. Create a blob per file.
  const treeItems = [];
  for (const f of opts.files) {
    const blob = await gh<{ sha: string }>(`${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: Buffer.from(f.content, "utf8").toString("base64"),
        encoding: "base64",
      }),
    });
    treeItems.push({
      path: f.path.replace(/^\/+/, ""),
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 3. New tree, 4. new commit parented on the current main tip (atomic).
  const tree = await gh<{ sha: string }>(`${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }),
  });
  const commit = await gh<{ sha: string; html_url: string }>(
    `${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: opts.message,
        tree: tree.sha,
        parents: [baseSha],
      }),
    },
  );

  // 5. Fast-forward main directly to the new commit (force: false so a racing
  //    push isn't clobbered — a non-fast-forward update will error instead).
  await gh(`${repo}/git/refs/heads/${base}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: commit.sha, commitUrl: commit.html_url, branch: base };
}
