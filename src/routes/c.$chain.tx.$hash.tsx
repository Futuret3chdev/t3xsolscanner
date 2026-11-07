import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CopyButton, Panel, Pending } from "@/components/bits";
import { chainMeta, parseChain } from "@/lib/chains";
import { clock, shortAddr, slotFmt } from "@/lib/format";
import { addressName } from "@/lib/names";
import { getEvmTx } from "@/lib/server-fns";

export const Route = createFileRoute("/c/$chain/tx/$hash")({
  loader: ({ params }) => getEvmTx({ data: { chain: params.chain, hash: params.hash } }),
  pendingComponent: () => <Pending label="Loading transaction…" />,
  component: EvmTxPage,
  head: ({ params }) => ({
    meta: [{ title: `Transaction · ${chainMeta(parseChain(params.chain)).name} · T3X` }],
  }),
});

function EvmTxPage() {
  const tx = Route.useLoaderData();
  const chain = chainMeta(tx.chain);

  if (!tx.found) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Transaction not found</h1>
        <p className="mt-2 break-all font-mono text-xs text-muted">{tx.hash}</p>
        <p className="mt-3 text-sm text-muted">It may still be pending, or the hash is for a different chain.</p>
      </div>
    );
  }

  const status = tx.ok == null ? "Pending" : tx.ok ? "Success" : "Failed";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">{chain.name}</p>
          <h1 className="mt-1 text-2xl font-semibold">{tx.action}</h1>
          <p className="mt-1 break-all text-sm text-muted">{status}{tx.detail ? ` · ${tx.detail}` : ""}</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{tx.hash}</p>
        </div>
        <CopyButton value={tx.hash} label="Copy hash" />
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Block">
          {tx.block == null ? (
            <span className="text-sm text-muted">Pending</span>
          ) : (
            <Link
              to="/c/$chain/block/$id"
              params={{ chain: chain.id, id: String(tx.block) }}
              className="font-mono text-sm hover:text-accent"
            >
              {slotFmt(tx.block)}
            </Link>
          )}
        </Field>
        <Field label="Time">
          <span className="text-sm">{clock(tx.time)}</span>
        </Field>
        <Field label="Value">
          <span className="font-mono text-sm tabular-nums">
            {tx.value} {tx.symbol}
          </span>
        </Field>
        <Field label="Fee">
          <span className="font-mono text-sm tabular-nums">{tx.fee ? `${tx.fee} ${tx.symbol}` : "—"}</span>
        </Field>
      </section>
      <Panel title="Parties">
        <dl className="divide-y divide-line">
          <Row label="From" address={tx.from} chain={chain.id} />
          <Row label="To" address={tx.to} chain={chain.id} />
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            <div>
              <dt className="text-xs text-muted uppercase">Nonce</dt>
              <dd className="mt-1 font-mono text-sm">{tx.nonce ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase">Gas used</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">{tx.gas ?? "—"}</dd>
            </div>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <div className="mt-2 truncate">{children}</div>
    </div>
  );
}

function Row({ label, address, chain }: { label: string; address: string; chain: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-xs text-muted uppercase">{label}</dt>
      <dd className="min-w-0 truncate">
        {address ? (
          <Link
            to="/c/$chain/address/$address"
            params={{ chain, address }}
            className="font-mono text-sm hover:text-accent"
          >
            {shortAddr(address, 6)}
            {addressName(address) ? <span className="ml-2 font-sans text-xs text-muted">{addressName(address)}</span> : null}
          </Link>
        ) : (
          <span className="text-sm text-muted">Contract creation</span>
        )}
      </dd>
    </div>
  );
}
