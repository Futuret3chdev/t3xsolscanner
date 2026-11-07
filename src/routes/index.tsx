import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AirdropBanner } from "@/components/airdrop-banner";
import { Change, Panel, Pending } from "@/components/bits";
import { SavedScans } from "@/components/extras";
import { ScanBand } from "@/components/shell";
import { WalletBag } from "@/components/wallet-bag";
import { CHAINS, type HomeView, parseChain, type ChainId } from "@/lib/chains";
import { ago, compact, shortAddr, slotFmt, usd } from "@/lib/format";
import { addressName } from "@/lib/names";
import { getChainHome } from "@/lib/server-fns";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({ chain: parseChain(search.chain) }),
  loaderDeps: ({ search }) => ({ chain: search.chain }),
  loader: ({ deps }) => getChainHome({ data: { chain: deps.chain } }),
  pendingComponent: () => <Pending label="Reading the chain…" />,
  component: Home,
  head: () => ({ meta: [{ title: "Explorer · T3X Sol Scanner" }] }),
});

function Home() {
  const initial = Route.useLoaderData();
  const { chain } = Route.useSearch();
  const [data, setData] = useState(initial);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void fetch(`/api/network?chain=${chain}`)
        .then((response) => response.json())
        .then((next: HomeView) => {
          if (next && Array.isArray(next.stats)) setData(next);
        })
        .catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(id);
  }, [chain]);

  const blocks = Array.from({ length: 6 }, (_, index) => data.blocks[index] ?? null);
  const txs = Array.from({ length: 6 }, (_, index) => data.txs[index] ?? null);
  const markets = data.markets.slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase">
              <span className="live-dot inline-block size-2 shrink-0 rounded-full bg-accent" />
              Mainnet
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{data.name}, as it lands.</h1>
          </div>
          <p className="shrink-0 text-xs text-muted sm:text-sm">Every 12s</p>
        </div>
        <AirdropBanner />
        <div className="chain-row -mx-4 flex h-[4.75rem] items-stretch gap-2 overflow-x-auto px-4">
          {CHAINS.map((item) => {
            const active = item.id === chain;
            const label = item.name.replace(" Chain", "").replace("Berachain", "Bera");
            return (
              <Link
                key={item.id}
                to="/"
                search={{ chain: item.id }}
                title={item.name}
                className={`flex w-16 shrink-0 flex-col items-center justify-between rounded-xl px-1 py-1.5 ${
                  active ? "bg-accent text-bg" : "border border-line bg-surface text-fg"
                }`}
              >
                <span className="w-full truncate text-center text-[10px] font-semibold leading-none">{label}</span>
                <img src={`/chains/${item.id}.png`} alt="" width={36} height={36} className="size-9 rounded-lg bg-bg object-contain" />
              </Link>
            );
          })}
        </div>
      </div>

      {data.warning ? <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{data.warning}</p> : <div className="hidden" />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.stats.map((stat) => (
          <div key={stat.label} className="min-h-[7.5rem] rounded-xl border border-line bg-surface p-4">
            <p className="truncate text-xs font-medium tracking-wide text-muted uppercase">{stat.label}</p>
            <p className="mt-2 truncate font-mono text-2xl font-medium tabular-nums">{stat.value}</p>
            {stat.meter != null ? (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, stat.meter)}%` }} />
              </div>
            ) : null}
            <p className="mt-2 truncate text-xs text-muted">
              {stat.change != null ? (
                <>
                  <Change value={stat.change} /> {stat.hint}
                </>
              ) : (
                stat.hint
              )}
            </p>
          </div>
        ))}
      </section>

      <ScanBand />
      <WalletBag />
      <SavedScans />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel title="Latest blocks">
            <ul className="divide-y divide-line">
              {blocks.map((block, index) => (
                <li key={block?.id ?? `block-${index}`} className="grid h-16 grid-cols-2 items-center gap-2 px-4 sm:grid-cols-4">
                  {block ? (
                    <>
                      <div className="min-w-0">
                        <BlockLink chain={data.chain} id={block.id} label={block.label} kind={data.kind} />
                        <p className="text-xs text-muted" suppressHydrationWarning>
                          {ago(block.time)}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-sm tabular-nums">{block.txCount.toLocaleString("en-US")}</p>
                        <p className="text-xs text-muted">txns</p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-xs text-muted">{data.kind === "evm" ? "Miner" : "Leader"}</p>
                        <p className="truncate font-mono text-sm">{block.meta ? (addressName(block.meta) ?? shortAddr(block.meta, 6)) : "—"}</p>
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <Panel title="Recent transactions">
            <ul className="divide-y divide-line">
              {txs.map((tx, index) => (
                <li key={tx?.id ?? `tx-${index}`} className="flex h-14 items-center justify-between gap-3 px-4">
                  {tx ? (
                    <>
                      <TxLink chain={data.chain} id={tx.id} kind={data.kind} />
                      <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                        {ago(tx.time)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title={data.marketTitle}>
        <ul className="grid sm:grid-cols-2">
          {markets.map((token) => (
            <li key={token.address} className="h-24 border-t border-line px-4 py-3">
              <Link
                to={data.kind === "evm" ? "/c/$chain/address/$address" : "/address/$address"}
                params={data.kind === "evm" ? { chain: data.chain, address: token.address } : { address: token.address }}
                className="flex items-center justify-between gap-3 hover:text-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{token.symbol}</span>
                  <span className="block truncate text-xs text-muted">{token.name}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular-nums">{usd(token.priceUsd, 4)}</span>
                  <span className="text-xs">
                    <Change value={token.changeH24} />
                  </span>
                </span>
              </Link>
              <p className="mt-1 truncate text-xs text-muted">
                Liq {usd(token.liquidityUsd, 0)} · Vol {compact(token.volumeH24)}
              </p>
            </li>
          ))}
          {markets.length === 0 ? <li className="h-16 px-4 py-4 text-sm text-muted">No markets yet.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

function BlockLink({ chain, id, label, kind }: { chain: ChainId; id: string; label: string; kind: "solana" | "evm" }) {
  const className = "font-mono text-sm text-fg hover:text-accent";
  if (kind === "evm") {
    return (
      <Link to="/c/$chain/block/$id" params={{ chain, id }} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <Link to="/block/$slot" params={{ slot: id }} className={className}>
      {label}
    </Link>
  );
}

function TxLink({ chain, id, kind }: { chain: ChainId; id: string; kind: "solana" | "evm" }) {
  const className = "truncate font-mono text-sm text-fg hover:text-accent";
  if (kind === "evm") {
    return (
      <Link to="/c/$chain/tx/$hash" params={{ chain, hash: id }} className={className}>
        {shortAddr(id, 8)}
      </Link>
    );
  }
  return (
    <Link to="/tx/$sig" params={{ sig: id }} className={className}>
      {shortAddr(id, 8)}
    </Link>
  );
}
