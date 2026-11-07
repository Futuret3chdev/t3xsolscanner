import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/board")({
  component: BoardPage,
  head: () => ({ meta: [{ title: "Public claims · T3X" }] }),
});

type Row = { username: string; usd: number; earned: number; claimed: number };

function BoardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public-claims")
      .then((response) => response.json())
      .then((body: { ok?: boolean; rows?: Row[]; error?: string }) => {
        setRows(body.rows || []);
        if (!body.ok) setError(body.error || "The public board is not reachable yet.");
      })
      .catch(() => setError("The public board is not reachable yet."));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Public</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Everyone can see the claims</h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          Every full $20 swapped or bridged earns T3X. T3X will be paid once it becomes available. This board is also on the T3x claims page.
        </p>
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
          {!rows.length ? <li className="px-4 py-3 text-sm text-muted">{error || "No claims yet."}</li> : null}
          {rows.map((row, index) => (
            <li key={row.username} className="flex h-12 items-center justify-between gap-3 px-4 text-sm">
              <span className="min-w-0 truncate">
                <span className="mr-2 font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                {row.username}
              </span>
              <span className="shrink-0 text-right font-mono tabular-nums">
                {usd(row.usd)} · {row.earned} T3X
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
