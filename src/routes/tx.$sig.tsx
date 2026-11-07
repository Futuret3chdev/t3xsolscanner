import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Addr, CopyButton, Delta, Panel, Pending } from "@/components/bits";
import { clock, lamportsToSol, slotFmt } from "@/lib/format";
import { getTx } from "@/lib/server-fns";

export const Route = createFileRoute("/tx/$sig")({
  loader: ({ params }) => getTx({ data: { sig: params.sig } }),
  pendingComponent: () => <Pending label="Loading transaction…" />,
  component: TxPage,
  head: () => ({ meta: [{ title: "Transaction · T3X" }] }),
});

function TxPage() {
  const tx = Route.useLoaderData();
  if (!tx.found) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Transaction not found</h1>
        <p className="mt-2 break-all font-mono text-sm text-muted">{tx.signature}</p>
        <p className="mt-3 text-sm text-muted">It may still be unconfirmed, or the signature is wrong.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Transaction</p>
          <h1 className="mt-1 text-2xl font-semibold">{tx.err ? "Failed" : "Success"}</h1>
          <p className="mt-2 break-all font-mono text-xs text-muted">{tx.signature}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tx.err ? "bg-down text-bg" : "bg-up text-bg"}`}>
          {tx.err ? "Failed" : "Confirmed"}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Block">
          <Link to="/block/$slot" params={{ slot: String(tx.slot) }} className="font-mono text-sm hover:text-accent">
            {slotFmt(tx.slot)}
          </Link>
        </Field>
        <Field label="Time">
          <span className="text-sm">{clock(tx.time)}</span>
        </Field>
        <Field label="Fee">
          <span className="font-mono text-sm tabular-nums">{lamportsToSol(tx.feeLamports)} SOL</span>
        </Field>
        <Field label="Compute">
          <span className="font-mono text-sm tabular-nums">
            {tx.computeUnits == null ? "—" : tx.computeUnits.toLocaleString("en-US")}
            <span className="text-muted"> · {tx.version}</span>
          </span>
        </Field>
      </section>

      {tx.err ? <p className="break-all rounded-xl border border-line bg-surface px-4 py-3 font-mono text-xs text-down">{tx.err}</p> : null}

      <Panel title="Balance changes">
        <ul className="divide-y divide-line">
          {tx.solChanges.map((row) => (
            <li key={`sol-${row.address}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <Addr address={row.address} />
                {row.feePayer ? <span className="ml-2 text-xs text-muted">fee payer</span> : null}
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                <Delta value={row.delta} /> <span className="text-muted">SOL</span>
              </span>
            </li>
          ))}
          {tx.tokenChanges.map((row) => (
            <li key={`${row.owner}-${row.mint}-${row.delta}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <Addr address={row.owner || row.mint} />
                <span className="mt-1 block text-xs text-muted">
                  mint <Addr address={row.mint} />
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                <Delta value={row.delta} />
              </span>
            </li>
          ))}
          {!tx.solChanges.length && !tx.tokenChanges.length ? (
            <li className="px-4 py-6 text-sm text-muted">No balance changes parsed.</li>
          ) : null}
        </ul>
      </Panel>

      <Panel title={`${tx.instructions.length} instructions`}>
        <ol className="divide-y divide-line">
          {tx.instructions.map((ix) => (
            <li key={ix.index} className="grid gap-1 px-4 py-3 sm:grid-cols-[2rem_1fr]">
              <span className="font-mono text-xs text-muted">{ix.index + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{ix.program}</p>
                <p className="text-sm text-muted">{ix.summary}</p>
                {ix.programId ? (
                  <p className="mt-1 break-all font-mono text-xs text-muted">{ix.programId}</p>
                ) : null}
                {ix.inner ? <p className="text-xs text-muted">{ix.inner} inner</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title={`Accounts · ${tx.accounts.length}`}>
        <ul className="divide-y divide-line">
          {tx.accounts.map((account) => (
            <li key={account.index} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="w-6 font-mono text-xs text-muted">{account.index}</span>
              <Addr address={account.address} />
              {account.signer ? <Badge>Signer</Badge> : null}
              {account.writable ? <Badge>Writable</Badge> : null}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={tx.logCount > tx.logs.length ? `Logs · ${tx.logs.length} of ${tx.logCount}` : "Logs"}
        action={<CopyButton value={tx.logs.join("\n")} label="Copy logs" />}
      >
        <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-5 text-muted">
          {tx.logs.join("\n") || "No logs"}
        </pre>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{children}</span>;
}
