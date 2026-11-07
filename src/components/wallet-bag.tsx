import { useEffect, useState } from "react";
import { lamportsToSol, usd } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import type { ChainId } from "@/lib/chains";

type Holding = { mint: string; symbol: string; amount: string; ui: number; valueUsd: number | null };
type SolBag = { lamports: number; holdings: Holding[]; portfolioUsd: number | null };
type EvmRow = { chain: ChainId; name: string; symbol: string; balance: string | null };

export function sliceBalance(balance: number, pct: 25 | 50 | 100, native = false): string {
  if (!Number.isFinite(balance) || balance <= 0) return "0";
  let value = (balance * pct) / 100;
  if (native && pct === 100) {
    const reserve = Math.min(Math.max(balance * 0.01, balance > 1 ? 0.002 : 0.0005), balance * 0.05);
    value = Math.max(0, balance - reserve);
  }
  if (value <= 0) return "0";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function useWalletBag() {
  const wallet = useWallet();
  const [sol, setSol] = useState<SolBag | null>(null);
  const [evm, setEvm] = useState<EvmRow[] | null>(null);
  const [solState, setSolState] = useState<"idle" | "loading" | "ready">("idle");
  const [evmState, setEvmState] = useState<"idle" | "loading" | "ready">("idle");

  useEffect(() => {
    if (!wallet.solAddress) {
      setSol(null);
      setSolState("idle");
      return;
    }
    let alive = true;
    setSolState("loading");
    void fetch(`/api/account?address=${wallet.solAddress}`)
      .then((response) => response.json())
      .then((body: { found?: boolean; kind?: string; lamports?: number; holdings?: Holding[]; portfolioUsd?: number | null }) => {
        if (!alive) return;
        if (!body.found || body.kind !== "wallet") {
          setSol(null);
        } else {
          setSol({
            lamports: body.lamports ?? 0,
            holdings: Array.isArray(body.holdings) ? body.holdings : [],
            portfolioUsd: body.portfolioUsd ?? null,
          });
        }
        setSolState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setSol(null);
        setSolState("ready");
      });
    return () => {
      alive = false;
    };
  }, [wallet.solAddress]);

  useEffect(() => {
    if (!wallet.evmAddress) {
      setEvm(null);
      setEvmState("idle");
      return;
    }
    let alive = true;
    setEvmState("loading");
    void fetch(`/api/balances?address=${wallet.evmAddress}`)
      .then((response) => response.json())
      .then((body: EvmRow[]) => {
        if (!alive) return;
        setEvm(Array.isArray(body) ? body : []);
        setEvmState("ready");
      })
      .catch(() => {
        if (!alive) return;
        setEvm([]);
        setEvmState("ready");
      });
    return () => {
      alive = false;
    };
  }, [wallet.evmAddress]);

  const connected = Boolean(wallet.solAddress || wallet.evmAddress);
  const loading = solState === "loading" || evmState === "loading";

  function solAsset(symbol: string): { ui: number; native: boolean } | null {
    if (!sol) return null;
    if (symbol.toUpperCase() === "SOL") return { ui: sol.lamports / 1e9, native: true };
    const hit = sol.holdings.find((row) => row.symbol.toUpperCase() === symbol.toUpperCase());
    return { ui: hit?.ui ?? 0, native: false };
  }

  function evmAsset(chain: ChainId, symbol: string, nativeSymbol: string): { ui: number; native: boolean } | null {
    if (!evm) return null;
    if (symbol.toUpperCase() !== nativeSymbol.toUpperCase()) return null;
    const row = evm.find((item) => item.chain === chain);
    const ui = Number(row?.balance ?? "0");
    return { ui: Number.isFinite(ui) ? ui : 0, native: true };
  }

  return { connected, loading, sol, evm, solAsset, evmAsset };
}

export function WalletBag({ compact = false }: { compact?: boolean }) {
  const bag = useWalletBag();
  if (!bag.connected) return null;
  const rows: { key: string; label: string; amount: string; extra: string }[] = [];
  if (bag.sol) {
    rows.push({
      key: "sol",
      label: "SOL",
      amount: lamportsToSol(bag.sol.lamports),
      extra: "Solana",
    });
    for (const holding of bag.sol.holdings) {
      rows.push({
        key: holding.mint,
        label: holding.symbol,
        amount: holding.amount,
        extra: holding.valueUsd != null ? usd(holding.valueUsd) : "Solana",
      });
    }
  }
  for (const row of bag.evm ?? []) {
    if (!row.balance || row.balance === "0") continue;
    rows.push({
      key: row.chain,
      label: row.symbol,
      amount: row.balance,
      extra: row.name,
    });
  }
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
        <h2 className="text-sm font-semibold">In this wallet</h2>
        <span className="truncate text-xs text-muted">
          {bag.sol?.portfolioUsd != null ? usd(bag.sol.portfolioUsd) : bag.loading ? "Looking up…" : "Connected"}
        </span>
      </header>
      <ul className={`${compact ? "max-h-36" : "h-40"} divide-y divide-line overflow-y-auto`}>
        {bag.loading && !rows.length ? <li className="px-4 py-3 text-sm text-muted">Looking up balances…</li> : null}
        {!bag.loading && !rows.length ? <li className="px-4 py-3 text-sm text-muted">No balance found yet.</li> : null}
        {rows.map((row) => (
          <li key={row.key} className="flex h-10 items-center justify-between gap-3 px-4">
            <span className="min-w-0 truncate text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="ml-2 text-xs text-muted">{row.extra}</span>
            </span>
            <span className="shrink-0 font-mono text-sm tabular-nums">{row.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AmountPercents({
  balance,
  native = false,
  onPick,
}: {
  balance: number | null;
  native?: boolean;
  onPick: (amount: string) => void;
}) {
  const ready = balance != null && balance > 0;
  return (
    <div className="mt-2 flex h-9 gap-2">
      {([25, 50, 100] as const).map((pct) => (
        <button
          key={pct}
          type="button"
          disabled={!ready}
          onClick={() => onPick(sliceBalance(balance ?? 0, pct, native))}
          className="h-9 flex-1 rounded-lg border border-line text-xs font-semibold text-fg disabled:opacity-40"
        >
          {pct}%
        </button>
      ))}
    </div>
  );
}
