import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Addr, Change, CopyButton, Panel, Pending } from "@/components/bits";
import { WatchButton } from "@/components/extras";
import { ago, lamportsToSol, slotFmt, usd } from "@/lib/format";
import { getAccount } from "@/lib/server-fns";

export const Route = createFileRoute("/address/$address")({
  loader: ({ params }) => getAccount({ data: { address: params.address } }),
  pendingComponent: () => <Pending label="Scanning account…" />,
  component: AddressPage,
  head: () => ({ meta: [{ title: "Account · T3X" }] }),
});

function AddressPage() {
  const account = Route.useLoaderData();
  if (!account.found) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Nothing here</h1>
        <p className="mt-2 break-all font-mono text-sm text-muted">{account.address}</p>
        <p className="mt-3 text-sm text-muted">{account.note}</p>
      </div>
    );
  }

  const kindLabel =
    account.kind === "mint" ? "Token" : account.kind === "token" ? "Token account" : account.kind === "wallet" ? "Wallet" : "Account";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">{kindLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">
            {account.symbol ? `${account.name ?? account.title} · ${account.symbol}` : account.title}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-muted">{account.address}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <WatchButton chain="solana" kind="address" id={account.address} label={account.symbol ?? account.title} />
          <CopyButton value={account.address} label="Copy address" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {account.kind === "wallet" ? (
          <>
            <Metric label="Portfolio" value={usd(account.portfolioUsd)} hint="Priced holdings only" />
            <Metric label="SOL" value={lamportsToSol(account.lamports)} hint={usd(account.priceUsd == null ? null : (account.lamports / 1e9) * account.priceUsd)} />
          </>
        ) : null}
        {account.kind === "mint" ? (
          <>
            <Metric label="Price" value={usd(account.priceUsd, 6)} hintNode={<Change value={account.changeH24} />} />
            <Metric label="Market cap" value={usd(account.marketCap, 0)} />
            <Metric label="Liquidity" value={usd(account.liquidityUsd, 0)} />
            <Metric label="24h volume" value={usd(account.volumeH24, 0)} />
          </>
        ) : null}
        {account.kind !== "mint" ? (
          <Metric label="Owner program" value={account.ownerProgram} hint={account.executable ? "Executable" : "Not executable"} />
        ) : (
          <Metric label="Decimals" value={account.decimals == null ? "—" : String(account.decimals)} hint={`Supply ${account.supply ?? "—"}`} />
        )}
        {account.kind === "token" ? (
          <Metric label="Amount" value={account.tokenAmount ?? "—"} hint={account.symbol ?? "tokens"} />
        ) : null}
      </section>

      {account.kind === "mint" ? (
        <Panel title="Signals">
          <ul className="grid gap-px bg-line sm:grid-cols-3">
            <Signal
              label="Mint authority"
              value={account.mintAuthority ? "Active — supply can change" : "Disabled — supply is fixed"}
              hot={Boolean(account.mintAuthority)}
            />
            <Signal
              label="Freeze authority"
              value={account.freezeAuthority ? "Active — accounts can be frozen" : "None"}
              hot={Boolean(account.freezeAuthority)}
            />
            <Signal
              label="Top holders"
              value={topShare(account.holders)}
              hot={topHot(account.holders)}
            />
          </ul>
          {account.mintAuthority ? (
            <p className="border-t border-line px-4 py-3 text-sm text-muted">
              Mint authority <Addr address={account.mintAuthority} />
            </p>
          ) : null}
        </Panel>
      ) : null}

      {account.kind === "token" && account.tokenMint ? (
        <Panel title="This token account">
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            <p className="text-sm">
              Mint <Addr address={account.tokenMint} />
            </p>
            <p className="text-sm">
              Owner {account.tokenOwner ? <Addr address={account.tokenOwner} /> : "—"}
            </p>
          </div>
        </Panel>
      ) : null}

      {account.kind === "wallet" ? (
        <Panel title="Holdings" action={account.holdingsNote ? <span className="text-xs text-muted">{account.holdingsNote}</span> : null}>
          <ul className="divide-y divide-line">
            <li className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">SOL</span>
              <span className="text-right font-mono text-sm tabular-nums">
                {lamportsToSol(account.lamports)}
                <span className="ml-3 text-muted">{usd(account.priceUsd == null ? null : (account.lamports / 1e9) * account.priceUsd)}</span>
              </span>
            </li>
            {account.holdings.map((holding) => (
              <li key={holding.mint} className="flex items-center justify-between gap-3 px-4 py-3">
                <Addr address={holding.mint} />
                <span className="text-right font-mono text-sm tabular-nums">
                  <span className="mr-2 text-muted">{holding.symbol}</span>
                  {holding.amount}
                  <span className="ml-3 text-muted">{usd(holding.valueUsd)}</span>
                </span>
              </li>
            ))}
            {!account.holdings.length ? <li className="px-4 py-4 text-sm text-muted">No priced token accounts with a balance.</li> : null}
          </ul>
        </Panel>
      ) : null}

      {account.holders.length ? (
        <Panel title="Largest holders">
          <ul className="divide-y divide-line">
            {account.holders.map((holder) => (
              <li key={holder.account} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Addr address={holder.owner || holder.account} />
                  <span className="font-mono text-sm tabular-nums">
                    {holder.amount}
                    {holder.share != null ? <span className="ml-2 text-muted">{holder.share.toFixed(2)}%</span> : null}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, holder.share ?? 0)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Recent signatures">
        <ul className="divide-y divide-line">
          {account.signatures.map((sig) => (
            <li key={sig.signature} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Addr address={sig.signature} to="tx" />
              <span className="text-xs text-muted">
                {sig.ok ? "ok" : "failed"} · {ago(sig.time)} · {slotFmt(sig.slot)}
              </span>
            </li>
          ))}
          {!account.signatures.length ? <li className="px-4 py-6 text-sm text-muted">No recent signatures.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}

function topShare(holders: { share: number | null }[]): string {
  if (!holders.length) return "Unavailable";
  const top = holders[0]?.share;
  if (top == null) return "Unavailable";
  const sum = holders.reduce((total, row) => total + (row.share ?? 0), 0);
  return `Largest ${top.toFixed(1)}% · top ${holders.length} hold ${sum.toFixed(1)}%`;
}

function topHot(holders: { share: number | null }[]): boolean {
  return (holders[0]?.share ?? 0) >= 20;
}

function Metric({
  label,
  value,
  hint,
  hintNode,
}: {
  label: string;
  value: string;
  hint?: string;
  hintNode?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 truncate font-mono text-lg tabular-nums">{value}</p>
      {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
      {hintNode ? <p className="mt-1 text-xs">{hintNode}</p> : null}
    </div>
  );
}

function Signal({ label, value, hot }: { label: string; value: string; hot: boolean }) {
  return (
    <li className="bg-surface px-4 py-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-2 text-sm ${hot ? "text-accent" : "text-fg"}`}>{value}</p>
    </li>
  );
}
