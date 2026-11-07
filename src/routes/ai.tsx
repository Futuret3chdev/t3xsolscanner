import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AI_FAMILIES, DEFAULT_AI_MODEL, aiModel, familyForModel } from "@/lib/ai-models";

export const Route = createFileRoute("/ai")({
  component: AskPage,
  head: () => ({ meta: [{ title: "Ask · T3X Scanner" }] }),
});

type Turn = { role: "user" | "assistant"; content: string; model?: string };

const STARTERS = [
  "What does T3X scan?",
  "If I swap or bridge more than $20, what do I earn?",
  "How is a Solana signature different from an Ethereum hash?",
  "What should I check before bridging ETH back to Solana?",
];

function AskPage() {
  const [family, setFamily] = useState(() => familyForModel(DEFAULT_AI_MODEL));
  const [modelId, setModelId] = useState(DEFAULT_AI_MODEL);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const models = AI_FAMILIES.find((item) => item.id === family)?.models ?? AI_FAMILIES[1].models;
  const active = aiModel(modelId);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns, busy]);

  async function ask(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setDraft("");
    const history = [...turns, { role: "user" as const, content }];
    setTurns([...history, { role: "assistant", content: "", model: active?.label ?? modelId }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
        }),
      });
      const type = response.headers.get("content-type") || "";
      if (!response.ok || type.includes("application/json")) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "The model did not answer.");
      }
      if (!response.body) throw new Error("The model did not answer.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const data = part
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (!data) continue;
          const payload = JSON.parse(data) as { delta?: string; error?: string; done?: boolean };
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) {
            answer += payload.delta;
            const next = answer;
            setTurns((current) => {
              const copy = current.slice();
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: next };
              return copy;
            });
          }
        }
      }
      if (!answer.trim()) throw new Error("Empty answer. Try another model.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "The model did not answer.";
      setError(message);
      setTurns((current) => {
        const copy = current.slice();
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && !last.content) copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Ask</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Claude, Gemini, Grok, and the rest.</h1>
        <p className="mt-2 max-w-2xl text-sm text-pretty text-muted">
          One HostGator gateway. Ask about a wallet, a bridge, or the $20 airdrop. Fast models spend fewer credits.
        </p>
      </div>

      <div className="chain-row -mx-4 flex h-11 items-center gap-2 overflow-x-auto px-4">
        {AI_FAMILIES.map((item) => {
          const on = item.id === family;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFamily(item.id);
                setModelId(item.models[0].id);
              }}
              className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold ${on ? "bg-accent text-bg" : "border border-line bg-surface text-fg"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="chain-row -mx-4 flex h-16 items-stretch gap-2 overflow-x-auto px-4">
        {models.map((item) => {
          const on = item.id === modelId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setModelId(item.id)}
              className={`flex w-28 shrink-0 flex-col justify-center rounded-xl px-3 text-left ${on ? "bg-accent text-bg" : "border border-line bg-surface text-fg"}`}
            >
              <span className="truncate text-sm font-semibold">{item.label}</span>
              <span className={`truncate text-xs ${on ? "text-bg/80" : "text-muted"}`}>{item.hint}</span>
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div ref={scroller} className="h-[min(28rem,52dvh)] overflow-y-auto px-4 py-4">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col justify-end gap-2">
              <p className="text-sm text-muted">Try one of these, or type your own.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTERS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void ask(prompt)}
                    className="h-16 rounded-lg border border-line bg-bg px-3 text-left text-sm text-fg"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {turns.map((turn, index) => (
                <li key={`${turn.role}-${index}`} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      turn.role === "user" ? "bg-accent text-bg" : "border border-line bg-bg text-fg"
                    }`}
                  >
                    {turn.role === "assistant" ? (
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">{turn.model}</p>
                    ) : null}
                    {turn.content || (busy ? "Thinking…" : "")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
        >
          <label className="sr-only" htmlFor="ask-box">
            Question
          </label>
          <textarea
            id="ask-box"
            ref={box}
            value={draft}
            rows={2}
            disabled={busy}
            placeholder="Ask about an address, a swap, or the airdrop"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
            className="h-14 min-w-0 flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent md:text-sm"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-14 w-20 shrink-0 rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-50"
          >
            {busy ? "…" : "Ask"}
          </button>
        </form>
      </section>
      {error ? <p className="text-sm text-down">{error}</p> : <p className="h-5 text-sm text-muted">The chat does not sign or send anything.</p>}
    </div>
  );
}
