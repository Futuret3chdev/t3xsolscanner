import { createFileRoute, Link } from "@tanstack/react-router";
import { CopyButton, Panel, Pending } from "@/components/bits";
import { chainMeta, parseChain, isEvmChain } from "@/lib/chains";
import { ago, clock, shortAddr, slotFmt } from "@/lib/format";
import { addressName } from "@/lib/names";
import { getEvmBlock } from "@/lib/server-fns";

export const Route = createFileRoute("/c/$chain/block/$id")({
  loader: ({ params }) => getEvmBlock({ data: { chain: params.chain, id: params.id } }),
  pendingComponent: () => <Pending label="Loading block…" />,
  component: EvmBlockPage,
  head: ({ params }) => ({
    meta: [{ title: `Block ${params.id} · ${chainMeta(parseChain(params.chain)).name} · T3X` }],
  }),
});

function EvmBlockPage() {
  const { chain: chainId } = Route.useParams();
  const chain = chainMeta(parseChain(chainId));
  const block = Route.useLoaderData();

  if (!isEvmChain(chain.id)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Use the Solana block page</h1>
        <Link to="/block/$slot" params={{ slot: block.number ? String(block.number) : "0" }} className="mt-3 inline-block text-sm text-accent">
          Open slot
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">{chain.name} block</p>
        <h1 className="mt-1 font-mono text-2xl font-medium tabular-nums sm:text-3xl">{slotFmt(block.number)}</h1>
        <p className="mt-1 text-sm text-muted">
          {block.found ? `${ago(block.time)} · ${clock(block.time)}` : "Not available from the public RPC"}
        </p>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Meta label="Transactions" value={block.txCount.toLocaleString("en-US")} />
        <Meta label="Gas used" value={block.gasUsed} />
        <Meta label="Gas limit" value={block.gasLimit} />
        <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-wide text-muted uppercase">Parent</p>
          {block.parent == null ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : (
            <Link
              to="/c/$chain/block/$id"
              params={{ chain: chain.id, id: String(block.parent) }}
              className="mt-2 inline-block font-mono text-sm hover:text-accent"
            >
              {slotFmt(block.parent)}
            </Link>
          )}
        </div>
      </section>
      <Panel title="Block hash">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <p className="min-w-0 break-all font-mono text-xs text-muted">{block.hash || "—"}</p>
          {block.hash ? <CopyButton value={block.hash} /> : null}
        </div>
      </Panel>
      <Panel title="Fee recipient">
        <div className="px-4 py-3">
          {block.miner ? (
            <Link
              to="/c/$chain/address/$address"
              params={{ chain: chain.id, address: block.miner }}
              className="font-mono text-sm hover:text-accent"
            >
              {addressName(block.miner) ?? shortAddr(block.miner, 8)}
            </Link>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </div>
      </Panel>
      <Panel title="Transactions">
        <ul className="divide-y divide-line">
          {block.txs.map((hash) => (
            <li key={hash} className="px-4 py-3">
              <Link
                to="/c/$chain/tx/$hash"
                params={{ chain: chain.id, hash }}
                className="font-mono text-sm hover:text-accent"
              >
                {shortAddr(hash, 8)}
              </Link>
            </li>
          ))}
          {!block.txs.length ? <li className="px-4 py-6 text-sm text-muted">No transactions in this block.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 truncate font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}
