// Minimal GitHub REST helper for the Admin AI Control Portal.
//
// SAFETY: writes never touch the default branch directly. commitChangeViaPR()
// always creates a NEW branch and opens a pull request, so a human reviews and
// merges before anything can reach production. The token (GH_AUTOMATION_TOKEN)
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

// Commit the given files to a fresh branch and open a PR. Returns the PR URL.
export async function commitChangeViaPR(opts: {
  title: string;
  body?: string;
  files: ProposedFile[];
  branchPrefix?: string;
}): Promise<{ prUrl: string; prNumber: number; branch: string }> {
  if (!opts.files?.length) throw new Error("No files provided.");
  const { owner, name } = repoParts();
  const base = defaultBranch();
  const repo = `/repos/${owner}/${name}`;

  // 1. Resolve the base commit + tree.
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

  // 3. New tree, 4. new commit (atomic across all files).
  const tree = await gh<{ sha: string }>(`${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems }),
  });
  const commit = await gh<{ sha: string }>(`${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: opts.title,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });

  // 5. New branch ref pointing at the commit.
  const branch = `${opts.branchPrefix ?? "admin-chat"}/${Date.now()}`;
  await gh(`${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });

  // 6. Open the PR against the default branch.
  const pr = await gh<{ html_url: string; number: number }>(`${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: opts.title,
      head: branch,
      base,
      body:
        (opts.body ? opts.body + "\n\n" : "") +
        "_Opened by the Admin AI Control Portal. Review and merge to ship._",
    }),
  });

  return { prUrl: pr.html_url, prNumber: pr.number, branch };
}
