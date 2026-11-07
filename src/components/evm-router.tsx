import { useEffect, useState, type FormEvent } from "react";
import { CopyButton } from "@/components/bits";
import { chainMeta, type ChainId } from "@/lib/chains";
import { useWallet } from "@/lib/wallet";

type EvmQuote = {
  tool: string;
  symbol: string;
  amount: string;
  minAmount: string;
  steps: { label: string }[];
  transaction: { to: string; data: string; value: string; gasLimit: string; chainId: number } | null;
  error?: string;
};

export function EvmRouter({ chain }: { chain: ChainId }) {
  const meta = chainMeta(chain);
  const wallet = useWallet();
  const [input, setInput] = useState(meta.symbol);
  const [output, setOutput] = useState(meta.stable?.symbol ?? "");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("50");
  const [walletAddress, setWalletAddress] = useState("");
  const [quote, setQuote] = useState<EvmQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet.evmAddress) setWalletAddress((current) => current || wallet.evmAddress || "");
  }, [wallet.evmAddress]);

  async function quoteNow(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setQuote(null);
    try {
      const params = new URLSearchParams({
        chain,
        input,
        output,
        amount,
        slippageBps: slippage || "50",
        user: walletAddress.trim(),
      });
      const response = await fetch(`/api/evm-quote?${params.toString()}`);
      const body = (await response.json()) as EvmQuote;
      if (!response.ok || body.error || !body.amount) throw new Error(body.error || "Quote failed");
      setQuote(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  const txText = quote?.transaction ? JSON.stringify(quote.transaction, null, 2) : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <form className="rounded-xl border border-line bg-surface p-4" onSubmit={(event) => void quoteNow(event)}>
        <label className="block text-xs font-medium tracking-wide text-muted uppercase" htmlFor="evm-amount">
          You pay
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="evm-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-base text-fg outline-none focus-visible:border-accent"
          />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Pay token"
            className="h-12 w-28 rounded-lg border border-line bg-bg px-2 font-mono text-sm outline-none focus-visible:border-accent"
          />
        </div>
        <label className="mt-4 block text-xs font-medium tracking-wide text-muted uppercase" htmlFor="evm-output">
          You receive
        </label>
        <input
          id="evm-output"
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          placeholder={meta.stable ? meta.stable.symbol : "0x token"}
          className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-base outline-none focus-visible:border-accent md:text-sm"
        />
        <p className="mt-2 text-xs text-muted">
          {meta.stable ? `${meta.symbol} or ${meta.stable.symbol}, or paste a token address.` : `${meta.symbol}, or paste token addresses.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["10", "50", "100"].map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => setSlippage(bps)}
              className={`h-9 rounded-lg border px-3 text-xs font-medium ${slippage === bps ? "border-accent text-accent" : "border-line text-muted"}`}
            >
              {Number(bps) / 100}% slip
            </button>
          ))}
        </div>
        <label className="mt-4 block text-xs font-medium tracking-wide text-muted uppercase" htmlFor="evm-wallet">
          Your wallet, optional
        </label>
        <input
          id="evm-wallet"
          value={walletAddress}
          onChange={(event) => setWalletAddress(event.target.value)}
          placeholder="0x… or use the connected wallet"
          spellCheck={false}
          className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-base outline-none focus-visible:border-accent md:text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-4 h-11 w-full rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-60"
        >
          {busy ? "Quoting…" : "Get route"}
        </button>
        {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}
      </form>
      <section className="rounded-xl border border-line bg-surface p-4">
        {!quote ? (
          <p className="text-sm text-muted">
            Quotes come from LI.FI on this chain. T3X does not sign or send the transaction.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs tracking-wide text-muted uppercase">{quote.tool}</p>
              <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
                {quote.amount} <span className="text-lg text-muted">{quote.symbol}</span>
              </p>
              <p className="mt-1 text-sm text-muted">Min {quote.minAmount}</p>
            </div>
            <ol className="flex flex-col gap-2">
              {quote.steps.map((step, index) => (
                <li key={`${step.label}-${index}`} className="rounded-lg border border-line bg-bg px-3 py-3 text-sm">
                  {step.label}
                </li>
              ))}
            </ol>
            {txText ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs tracking-wide text-muted uppercase">Transaction</p>
                  <CopyButton value={txText} label="Copy" />
                </div>
                {wallet.evmAddress && quote.transaction ? (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      setSending(true);
                      setError(null);
                      void wallet
                        .sendEvm(quote.transaction!)
                        .then(setSent)
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "The wallet did not send it."))
                        .finally(() => setSending(false));
                    }}
                    className="mb-3 h-11 w-full rounded-lg bg-accent text-sm font-semibold text-bg disabled:opacity-60"
                  >
                    {sending ? "Waiting for the wallet…" : "Approve in wallet"}
                  </button>
                ) : null}
                {sent ? <p className="mb-2 break-all text-sm text-muted">Sent {sent}</p> : null}
                <pre className="max-h-48 overflow-auto break-all rounded-lg bg-bg p-3 font-mono text-xs text-muted">{txText}</pre>
              </div>
            ) : (
              <p className="text-sm text-muted">Add your wallet address and quote again to build the unsigned transaction.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
