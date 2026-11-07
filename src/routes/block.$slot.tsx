import { createFileRoute, Link } from "@tanstack/react-router";
import { Addr, Panel, Pending } from "@/components/bits";
import { ago, clock, slotFmt } from "@/lib/format";
import { getBlock } from "@/lib/server-fns";

export const Route = createFileRoute("/block/$slot")({
  loader: ({ params }) => getBlock({ data: { slot: Number(params.slot) } }),
  pendingComponent: () => <Pending label="Loading block…" />,
  component: BlockPage,
  head: ({ params }) => ({ meta: [{ title: `Block ${params.slot} · T3X` }] }),
});

function BlockPage() {
  const block = Route.useLoaderData();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Block</p>
        <h1 className="mt-1 font-mono text-3xl font-medium tabular-nums">{slotFmt(block.slot)}</h1>
        <p className="mt-1 text-sm text-muted">
          {block.found ? `${ago(block.time)} · ${clock(block.time)}` : "Not available from the public RPC"}
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Meta label="Transactions" value={block.txCount.toLocaleString("en-US")} />
        <Meta label="Height" value={slotFmt(block.height)} />
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-wide text-muted uppercase">Leader</p>
          <div className="mt-2">{block.leader ? <Addr address={block.leader} /> : <span className="text-muted">—</span>}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-wide text-muted uppercase">Parent</p>
          <Link
            to="/block/$slot"
            params={{ slot: String(block.parentSlot) }}
            className="mt-2 inline-block font-mono text-sm hover:text-accent"
          >
            {slotFmt(block.parentSlot)}
          </Link>
        </div>
      </section>
      {block.blockhash ? (
        <p className="break-all font-mono text-xs text-muted">Blockhash {block.blockhash}</p>
      ) : null}
      <Panel title={block.txCount > block.signatures.length ? `Transactions · showing ${block.signatures.length} of ${block.txCount}` : "Transactions"}>
        <ul className="divide-y divide-line">
          {block.signatures.map((sig, index) => (
            <li key={sig} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 font-mono text-xs text-muted">{index + 1}</span>
              <Addr address={sig} to="tx" className="break-all" />
            </li>
          ))}
          {!block.signatures.length ? <li className="px-4 py-6 text-sm text-muted">No signatures in this response.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-mono text-lg tabular-nums">{value}</p>
    </div>
  );
}
