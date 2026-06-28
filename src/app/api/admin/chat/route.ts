import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminUser } from "@/lib/admin";
import {
  readRepoFile,
  commitToMain,
  triggerDeployHook,
  type ProposedFile,
} from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are the Admin AI Control Portal for the "my-subscription-app" web application — a Next.js 16 (App Router) + Supabase + Tailwind v4 project. You assist the authenticated administrator with questions and with making code changes to the app's GitHub repository.

How to make code changes:
- ALWAYS use read_repo_file to inspect the current contents of any file before changing it. Never guess existing code.
- Then use commit_code_change with the FULL new content of each file. This commits DIRECTLY to the main branch — there is no pull request and no review step. Be careful and precise. Report the commit link to the admin.
- Keep changes minimal and focused on exactly what was asked; match the existing code style.

Be concise and direct.`;

const tools: Anthropic.Tool[] = [
  {
    name: "read_repo_file",
    description:
      "Read the current contents of a file from the default branch of the GitHub repository so you can see existing code before changing it. Provide a repo-relative path, e.g. 'src/app/page.tsx'.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative file path" },
      },
      required: ["path"],
    },
  },
  {
    name: "commit_code_change",
    description:
      "Commit one or more files DIRECTLY to the main (production) branch. There is no pull request and no review. Provide the FULL new content of each file.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message" },
        files: {
          type: "array",
          description: "Files to create or overwrite, each with full new content",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["message", "files"],
    },
  },
];

type ChatMessage = { role: "user" | "assistant"; content: string };
type Action = {
  type: "commit";
  commitUrl: string;
  commitSha: string;
  branch: string;
  deployTriggered: boolean;
};

export async function POST(req: Request) {
  // Hard gate: only the admin email passes. Return 404 (not 403) so the
  // endpoint's existence isn't revealed to anyone else.
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Not found", { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const history = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (!history.length) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const convo: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const actions: Action[] = [];

  try {
    // Manual agentic loop so every tool call is gated and audited server-side.
    for (let turn = 0; turn < 6; turn++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        tools,
        messages: convo,
      });

      if (resp.stop_reason === "refusal") {
        return NextResponse.json({
          reply: "I can't help with that request.",
          actions,
        });
      }

      if (resp.stop_reason !== "tool_use") {
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return NextResponse.json({ reply: text, actions });
      }

      // Execute the requested tools, then feed results back.
      convo.push({ role: "assistant", content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        try {
          if (block.name === "read_repo_file") {
            const { path } = block.input as { path: string };
            const content = await readRepoFile(path);
            results.push({ type: "tool_result", tool_use_id: block.id, content });
          } else if (block.name === "commit_code_change") {
            const input = block.input as {
              message: string;
              files: ProposedFile[];
            };
            const commit = await commitToMain({
              message: input.message,
              files: input.files,
            });
            // Fire the Vercel deploy hook (no-op until VERCEL_DEPLOY_HOOK_URL is set).
            const deployTriggered = await triggerDeployHook();
            actions.push({ type: "commit", ...commit, deployTriggered });
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Committed ${commit.commitSha.slice(0, 7)} directly to '${commit.branch}': ${commit.commitUrl}. ${
                deployTriggered
                  ? "Production deploy triggered via deploy hook."
                  : "No deploy hook configured — a production deploy is still required to make it live."
              }`,
            });
          } else {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: `Unknown tool: ${block.name}`,
              is_error: true,
            });
          }
        } catch (e) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
            is_error: true,
          });
        }
      }

      convo.push({ role: "user", content: results });
    }

    return NextResponse.json({
      reply: "Stopped after too many tool iterations. Please refine the request.",
      actions,
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${e.status}): ${e.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
