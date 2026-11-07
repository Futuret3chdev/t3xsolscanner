import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Change, CopyButton, Panel, Pending } from "@/components/bits";
import { ChainBalances, WatchButton } from "@/components/extras";
import { chainMeta, parseChain } from "@/lib/chains";
import { addressName } from "@/lib/names";
import { compact, usd } from "@/lib/format";
import { getEvmAccount } from "@/lib/server-fns";

export const Route = createFileRoute("/c/$chain/address/$address")({
  loader: ({ params }) => getEvmAccount({ data: { chain: params.chain, address: params.address } }),
  pendingComponent: () => <Pending label="Scanning account…" />,
  component: EvmAddressPage,
  head: ({ params }) => ({
    meta: [{ title: `Account · ${chainMeta(parseChain(params.chain)).name} · T3X` }],
  }),
});

function EvmAddressPage() {
  const account = Route.useLoaderData();
  const chain = chainMeta(account.chain);
  const kind = account.kind === "token" ? "Token" : account.kind === "contract" ? "Contract" : "Wallet";

  if (!account.found) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Nothing here</h1>
        <p className="mt-2 break-all font-mono text-xs text-muted">{account.address}</p>
        <p className="mt-3 text-sm text-muted">The public RPC did not return this account.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            {chain.name} · {kind}
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">
            {addressName(account.address) ?? (account.token ? account.token.symbol : kind)}
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-muted">{account.address}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <WatchButton chain={chain.id} kind="address" id={account.address} label={`${chain.name} · ${addressName(account.address) ?? account.address.slice(0, 6)}`} />
          <CopyButton value={account.address} label="Copy" />
        </div>
      </div>
      <section className="grid grid-cols-2 gap-3">
        <Meta label={chain.symbol} value={account.balance} hint="Native balance" />
        <Meta label="Nonce" value={account.nonce.toLocaleString("en-US")} hint="Transactions sent" />
        {account.token ? (
          <>
            <Meta label="Price" value={usd(account.token.priceUsd, 4)} hintNode={<Change value={account.token.changeH24} />} />
            <Meta label="Liquidity" value={usd(account.token.liquidityUsd, 0)} hint={`Vol ${compact(account.token.volumeH24)}`} />
          </>
        ) : null}
      </section>
      <ChainBalances address={account.address} current={chain.id} />
      <Panel title={account.token ? account.token.name : "What this is"}>
        <p className="px-4 py-4 text-sm text-pretty text-muted">
          {account.token
            ? "Price and liquidity come from the deepest DexScreener pool. This is not a full token-holder index."
            : account.kind === "contract"
              ? "This address has bytecode. No priced pool was found, so only the native balance is shown."
              : "Wallet balances here are the native coin only. Token holdings need an indexer, which the public RPC does not provide."}
        </p>
      </Panel>
    </div>
  );
}

function Meta({
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
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <p className="truncate text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 truncate font-mono text-lg tabular-nums">{value}</p>
      <p className="mt-2 truncate text-xs text-muted">{hintNode ?? hint}</p>
    </div>
  );
}
