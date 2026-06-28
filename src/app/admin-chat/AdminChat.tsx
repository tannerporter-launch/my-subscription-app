"use client";

import { useRef, useState } from "react";

type Action = { type: "commit"; commitUrl: string; commitSha: string; branch: string };
type Message = { role: "user" | "assistant"; content: string; actions?: Action[] };

export function AdminChat({ adminEmail }: { adminEmail: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply ?? "", actions: data.actions ?? [] },
      ]);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">
              Admin AI Control Portal
            </h1>
            <p className="text-xs text-neutral-500">{adminEmail}</p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            claude-opus-4-8
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 ? (
            <div className="mt-16 text-center text-sm text-neutral-500">
              <p>Ask a question, or request a code change.</p>
              <p className="mt-1 text-neutral-600">
                Code changes are opened as a pull request for you to review.
              </p>
            </div>
          ) : null}

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.actions?.map((a) => (
                  <a
                    key={a.commitSha}
                    href={a.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                  >
                    ↗ Committed {a.commitSha.slice(0, 7)} directly to {a.branch} — deploy to ship
                  </a>
                ))}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-500">
                Thinking…
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <footer className="border-t border-neutral-800 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Message the control portal…  (Enter to send, Shift+Enter for newline)"
            className="max-h-40 flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </footer>
    </main>
  );
}
