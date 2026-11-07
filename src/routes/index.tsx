import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Addr, Change, Panel, Pending } from "@/components/bits";
import { ScanBand } from "@/components/shell";
import { ago, compact, slotFmt, usd } from "@/lib/format";
import { getBlocks, getNetwork, getTrending } from "@/lib/server-fns";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [network, feed, trending] = await Promise.all([
      getNetwork(),
      getBlocks(),
      getTrending().catch(() => []),
    ]);
    return { network, feed, trending };
  },
  pendingComponent: () => <Pending label="Reading mainnet…" />,
  component: Home,
  head: () => ({ meta: [{ title: "Explorer · T3X Sol Scanner" }] }),
});

function Home() {
  const { network, feed, trending } = Route.useLoaderData();
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void router.invalidate();
    }, 12000);
    return () => window.clearInterval(id);
  }, [router]);

  const latest = feed.blocks[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase">
            <span className="live-dot inline-block size-2 rounded-full bg-accent" />
            Mainnet
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">Solana, as it lands.</h1>
        </div>
        <p className="text-sm text-muted">Refreshes every 12 seconds</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Slot"
          value={slotFmt(network.slot)}
          hint={`Height ${slotFmt(network.blockHeight)}`}
        />
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Epoch {network.epoch}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
            {network.epochProgress.toFixed(1)}%
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, network.epochProgress)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">{slotFmt(network.slotsLeft)} slots left</p>
        </div>
        <Stat
          label="TPS"
          value={network.tps == null ? "—" : Math.round(network.tps).toLocaleString("en-US")}
          hint="Last 60 seconds"
        />
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">SOL</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{usd(network.solPrice)}</p>
          <p className="mt-2 text-xs">
            <Change value={network.solChange24h} /> <span className="text-muted">24h</span>
          </p>
        </div>
      </section>

      <ScanBand />

      {feed.warning ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{feed.warning}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel title="Latest blocks">
            <ul className="divide-y divide-line">
              {feed.blocks.map((block) => (
                <li key={block.slot} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
                  <div>
                    <Link
                      to="/block/$slot"
                      params={{ slot: String(block.slot) }}
                      className="font-mono text-sm text-fg hover:text-accent"
                    >
                      {slotFmt(block.slot)}
                    </Link>
                    <p className="text-xs text-muted">{ago(block.time)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm tabular-nums">{block.txCount.toLocaleString("en-US")}</p>
                    <p className="text-xs text-muted">txns</p>
                  </div>
                  <div className="col-span-2 min-w-0 sm:col-span-2">
                    <p className="text-xs text-muted">Leader</p>
                    {block.leader ? <Addr address={block.leader} /> : <span className="text-sm text-muted">—</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <Panel
            title="Recent transactions"
            action={
              latest ? (
                <Link to="/block/$slot" params={{ slot: String(latest.slot) }} className="text-xs text-muted hover:text-fg">
                  From {slotFmt(latest.slot)}
                </Link>
              ) : null
            }
          >
            <ul className="divide-y divide-line">
              {(latest?.signatures ?? []).map((sig) => (
                <li key={sig} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Addr address={sig} to="tx" />
                  <span className="shrink-0 text-xs text-muted">{ago(latest?.time)}</span>
                </li>
              ))}
              {!latest ? <li className="px-4 py-6 text-sm text-muted">No transactions yet.</li> : null}
            </ul>
          </Panel>
        </div>
      </div>

      {trending.length ? (
        <Panel title="Boosted tokens">
          <ul className="grid sm:grid-cols-2">
            {trending.map((token) => (
              <li key={token.address} className="border-t border-line px-4 py-3">
                <Link
                  to="/address/$address"
                  params={{ address: token.address }}
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
                <p className="mt-1 text-xs text-muted">
                  Liq {usd(token.liquidityUsd, 0)} · Vol {compact(token.volumeH24)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">Need a route, not a receipt?</h2>
          <p className="text-sm text-muted">Compare the winning venue against Raydium, Orca, Meteora, and Phoenix.</p>
        </div>
        <Link to="/router" className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg">
          Open router
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}
