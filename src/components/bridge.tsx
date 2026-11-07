import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CHAINS, chainMeta, type ChainId } from "@/lib/chains";
import { shortAddr } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

type BridgeQuote = {
  tool: string;
  symbol: string;
  amount: string;
  minAmount: string;
  fromChain: ChainId;
  toChain: ChainId;
  steps: { label: string }[];
  transaction:
    | { kind: "evm"; to: string; data: string; value: string; gasLimit: string; chainId: number }
    | { kind: "solana"; data: string }
    | null;
  error?: string;
};

export function BridgePanel() {
  const wallet = useWallet();
  const [fromChain, setFromChain] = useState<ChainId>("ethereum");
  const [toChain, setToChain] = useState<ChainId>("base");
  const [asset, setAsset] = useState<"native" | "stable">("native");
  const [amount, setAmount] = useState("0.01");
  const [toAddress, setToAddress] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = chainMeta(fromChain);
  const to = chainMeta(toChain);
  const fromAddress = from.kind === "solana" ? wallet.solAddress : wallet.evmAddress;
  const sameFamily = from.kind === to.kind;
  const receive = toAddress.trim() || (sameFamily ? fromAddress ?? "" : to.kind === "solana" ? wallet.solAddress ?? "" : wallet.evmAddress ?? "");

  async function quoteNow(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    setHash("");
    setQuote(null);
    try {
      const params = new URLSearchParams({
        fromChain,
        toChain,
        asset,
        amount,
        slippageBps: "50",
        fromAddress: fromAddress ?? "",
        toAddress: receive,
      });
      const response = await fetch(`/api/bridge?${params.toString()}`);
      const body = (await response.json()) as BridgeQuote;
      if (!response.ok || body.error || !body.amount) throw new Error(body.error || "No route");
      setQuote(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No route");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!quote?.transaction) return;
    setSending(true);
    setError(null);
    try {
      const tx = quote.transaction;
      const sent = tx.kind === "evm" ? await wallet.sendEvm(tx) : await wallet.sendSolana(tx.data);
      setHash(sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The wallet did not send it.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form className="rounded-xl border border-line bg-surface p-4" onSubmit={(event) => void quoteNow(event)}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <ChainSelect id="bridge-from" label="From" value={fromChain} onChange={setFromChain} />
          <button
            type="button"
            aria-label="Swap bridge direction"
            className="mb-0.5 inline-flex size-11 items-center justify-center rounded-full border border-line text-sm text-muted"
            onClick={() => {
              setFromChain(toChain);
              setToChain(fromChain);
              setQuote(null);
            }}
          >
            ↔
          </button>
          <ChainSelect id="bridge-to" label="To" value={toChain} onChange={setToChain} />
        </div>
        <label className="mt-4 block text-xs font-medium tracking-wide text-muted uppercase" htmlFor="bridge-amount">
          You bridge
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="bridge-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-base outline-none focus-visible:border-accent"
          />
          <select
            value={asset}
            onChange={(event) => setAsset(event.target.value === "stable" ? "stable" : "native")}
            className="h-12 rounded-lg border border-line bg-bg px-2 text-sm font-semibold"
          >
            <option value="native">{from.symbol}</option>
            <option value="stable">Stable</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-muted">
          {fromAddress ? `Paying from ${shortAddr(fromAddress, 4)}` : `Connect a ${from.kind === "solana" ? "Solana" : "EVM"} wallet to send this.`}
        </p>
        <label className="mt-4 block text-xs font-medium tracking-wide text-muted uppercase" htmlFor="bridge-receive">
          Receive at
        </label>
        <input
          id="bridge-receive"
          value={toAddress}
          onChange={(event) => setToAddress(event.target.value)}
          placeholder={receive || (to.kind === "solana" ? "Solana address" : "0x address")}
          spellCheck={false}
          className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-base outline-none focus-visible:border-accent md:text-sm"
        />
        <p className="mt-2 text-xs text-muted">
          {toAddress.trim() ? "Sending to this address." : "Leave blank to use the connected wallet on that side."}
        </p>
        <button type="submit" disabled={busy} className="mt-4 h-11 w-full rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-60">
          {busy ? "Finding a bridge…" : "Get bridge"}
        </button>
        {error && !quote ? <p className="mt-3 text-sm text-pretty text-down">{error}</p> : null}
      </form>
      <section className="rounded-xl border border-line bg-surface p-4">
        {!quote ? (
          <p className="text-sm text-pretty text-muted">
            Bridge across the chains in the scanner. Your wallet has to approve the transaction. T3X never holds the keys.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs tracking-wide text-muted uppercase">{quote.tool}</p>
              <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
                {quote.amount} <span className="text-lg text-muted">{quote.symbol}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Min {quote.minAmount} on {chainMeta(quote.toChain).name}
              </p>
              <p className="mt-1 text-sm text-pretty text-muted">
                Leaves from {chainMeta(quote.fromChain).name}. That wallet needs the amount plus gas.
              </p>
            </div>
            <ol className="flex flex-col gap-2">
              {quote.steps.map((step, index) => (
                <li key={`${step.label}-${index}`} className="rounded-lg border border-line bg-bg px-3 py-3 text-sm">
                  {step.label}
                </li>
              ))}
            </ol>
            {quote.transaction ? (
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                className="h-11 rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-60"
              >
                {sending ? "Waiting for the wallet…" : "Approve bridge in wallet"}
              </button>
            ) : (
              <p className="text-sm text-muted">Connect the paying wallet, then quote again to build the transaction.</p>
            )}
            {error && quote ? <p className="text-sm text-pretty text-down">{error}</p> : null}
            {hash ? (
              <p className="break-all text-sm">
                Sent.{" "}
                {quote.transaction?.kind === "solana" ? (
                  <Link to="/tx/$sig" params={{ sig: hash }} className="text-accent">
                    View transaction
                  </Link>
                ) : (
                  <Link to="/c/$chain/tx/$hash" params={{ chain: quote.fromChain, hash }} className="text-accent">
                    View transaction
                  </Link>
                )}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function ChainSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: ChainId;
  onChange: (chain: ChainId) => void;
}) {
  return (
    <label className="min-w-0 text-xs font-medium tracking-wide text-muted uppercase" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ChainId)}
        className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-2 text-base text-fg normal-case md:text-sm"
      >
        {CHAINS.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.name}
          </option>
        ))}
      </select>
    </label>
  );
}
