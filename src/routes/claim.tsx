import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { claimMine, linkMyWallet, loadMyClaim, useAccount, writeAccount } from "@/lib/account-client";
import { countTransfer } from "@/lib/airdrop-client";
import { useWallet } from "@/lib/wallet";
import { shortAddr, usd } from "@/lib/format";

export const Route = createFileRoute("/claim")({
  component: ClaimPage,
  head: () => ({ meta: [{ title: "Claim · T3X" }] }),
});

type ClaimView = Awaited<ReturnType<typeof loadMyClaim>>;

const PENDING_KEY = "t3x-pending-fill";

function ClaimPage() {
  const account = useAccount();
  const wallet = useWallet();
  const [view, setView] = useState<ClaimView | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setView(await loadMyClaim());
  }

  useEffect(() => {
    if (!account) return;
    let alive = true;
    void (async () => {
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (raw) {
          sessionStorage.removeItem(PENDING_KEY);
          const saved = JSON.parse(raw) as { tx: string; chain: string; kind: string; symbol: string; amount: string; address: string };
          const savedResult = await countTransfer(saved);
          if (alive && !savedResult) setNote("Last transfer counted.");
          if (alive && savedResult) setError(savedResult);
        }
        const next = await loadMyClaim();
        if (alive) setView(next);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load claims.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [account?.id]);

  async function linkCurrent() {
    setError("");
    setBusy(true);
    try {
      if (wallet.solAddress) await linkMyWallet(wallet.solAddress, "solana");
      if (wallet.evmAddress) await linkMyWallet(wallet.evmAddress, "evm");
      if (!wallet.solAddress && !wallet.evmAddress) {
        setError("Connect a wallet first, then link it here.");
        return;
      }
      await refresh();
      setNote("Wallet linked to this account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link the wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const result = await claimMine();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote(`${result.units} T3X unit${result.units === 1 ? "" : "s"} recorded. T3X will be paid once it becomes available.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to claim T3X</h1>
        <p className="text-sm text-pretty text-muted">Every full $20 is recorded. T3X will be paid once it becomes available.</p>
        <a href="https://t3x.futuret3ch.com.au/login" className="inline-flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-bg">
          Register or sign in
        </a>
      </div>
    );
  }

  const toward = view?.toward ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Airdrop</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Every $20 earns T3X</h1>
          <p className="mt-2 text-sm text-pretty text-muted">
            Signed in as {account.username || account.email}. Swap or bridge, then the volume lands here. T3X will be paid once it becomes available. The same list is public on the claims page.
          </p>
        </div>
        <button type="button" onClick={() => writeAccount(null)} className="h-9 shrink-0 rounded-lg border border-line px-3 text-xs font-semibold">
          Sign out
        </button>
      </div>

      <section className="rounded-xl border border-accent/40 bg-accent/10 p-4">
        <p className="text-sm font-semibold">T3X will be paid once it becomes available.</p>
        <p className="mt-1 text-sm text-pretty text-muted">
          A claim records what you have earned. It is not a payment yet. The public list is on{" "}
          <a className="text-accent" href="https://t3x.futuret3ch.com.au/claims">
            the T3x claims page
          </a>
          .
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-muted uppercase">Ready to claim</p>
            <p className="mt-1 font-mono text-4xl font-medium tabular-nums">{view?.ready ?? 0}</p>
          </div>
          <p className="text-right text-sm text-muted">
            {usd(view?.total ?? 0)} tracked
            <br />
            {usd(toward)} of the next $20
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (toward / 20) * 100)}%` }} />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy || !view?.ready} onClick={() => void claim()} className="h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-50">
            {busy ? "Working…" : "Claim T3X"}
          </button>
          <button type="button" disabled={busy} onClick={() => void linkCurrent()} className="h-11 flex-1 rounded-lg border border-line text-sm font-semibold">
            Link connected wallet
          </button>
        </div>
        {note ? <p className="mt-3 text-sm text-up">{note}</p> : null}
        {error ? <p className="mt-3 text-sm text-pretty text-down">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <header className="flex h-11 items-center justify-between border-b border-line px-4">
          <h2 className="text-sm font-semibold">Linked wallets</h2>
          <Link to="/router" className="text-xs text-accent">
            Trade
          </Link>
        </header>
        <ul className="divide-y divide-line">
          {!view?.wallets.length ? <li className="px-4 py-3 text-sm text-muted">No wallet linked yet.</li> : null}
          {view?.wallets.map((row) => (
            <li key={row.address} className="flex h-11 items-center justify-between px-4 text-sm">
              <span className="font-mono">{shortAddr(row.address, 6)}</span>
              <span className="text-xs tracking-wide text-muted uppercase">{row.kind}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <header className="flex h-11 items-center border-b border-line px-4">
          <h2 className="text-sm font-semibold">Counted transfers</h2>
        </header>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {!view?.fills.length ? <li className="px-4 py-3 text-sm text-muted">None yet. A swap or bridge of any size adds toward the next $20.</li> : null}
          {view?.fills.map((row) => (
            <li key={row.id} className="flex h-12 items-center justify-between gap-3 px-4 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{row.amount} {row.symbol}</span>
                <span className="ml-2 text-xs text-muted">{row.chain}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums">{usd(Number(row.usd))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
