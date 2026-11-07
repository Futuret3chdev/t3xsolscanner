import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CopyButton } from "@/components/bits";
import { BridgePanel } from "@/components/bridge";
import { AirdropBanner } from "@/components/airdrop-banner";
import { EvmRouter } from "@/components/evm-router";
import { CHAINS, type ChainId } from "@/lib/chains";
import { slotFmt, usd } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { TOKENS } from "@/lib/labels";
import { AmountPercents, useWalletBag, WalletBag } from "@/components/wallet-bag";
import { countTransfer } from "@/lib/airdrop-client";

export const Route = createFileRoute("/router")({
  component: RouterPage,
  head: () => ({ meta: [{ title: "Router · T3X Sol Scanner" }] }),
});

type QuoteResponse = {
  output: {
    amount: string;
    amountRaw: string;
    symbol: string;
    minAmount: string;
  };
  swapUsdValue: number | null;
  priceImpactPct: number | null;
  contextSlot: number | null;
  route: { percent: number; label: string; amm: string }[];
  candidates: { dex: string; amount: string; amountRaw: string; labels: string[] }[];
};

function RouterPage() {
  const connected = useWallet();
  const bag = useWalletBag();
  const [mode, setMode] = useState<"swap" | "bridge">("swap");
  const [network, setNetwork] = useState<ChainId>("solana");
  const [input, setInput] = useState("SOL");
  const [output, setOutput] = useState("USDC");
  const [amount, setAmount] = useState("1");
  const [slippage, setSlippage] = useState("50");
  const [wallet, setWallet] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (connected.solAddress) setWallet((current) => current || connected.solAddress || "");
  }, [connected.solAddress]);

  const curl = useMemo(() => {
    const params = new URLSearchParams({ input, output, amount, slippageBps: slippage || "50" });
    return `curl "$ORIGIN/api/quote?${params.toString()}"`;
  }, [input, output, amount, slippage]);

  async function quoteNow(next = { input, output, amount, slippage }) {
    setBusy(true);
    setError(null);
    setTx(null);
    try {
      const params = new URLSearchParams({
        input: next.input,
        output: next.output,
        amount: next.amount,
        slippageBps: next.slippage || "50",
      });
      const response = await fetch(`/api/quote?${params.toString()}`);
      const body = (await response.json()) as QuoteResponse & { error?: string };
      if (!response.ok || body.error || !body.output) {
        throw new Error(body.error || "Quote failed");
      }
      setQuote(body);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Quote failed");
    } finally {
      setBusy(false);
    }
  }

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const response = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input,
          output,
          amount,
          slippageBps: Number(slippage || "50"),
          userPublicKey: wallet.trim(),
        }),
      });
      const body = (await response.json()) as { swapTransaction?: string; error?: string };
      if (!response.ok || !body.swapTransaction) throw new Error(body.error || "Could not build");
      setTx(body.swapTransaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build");
    } finally {
      setBuilding(false);
    }
  }

  const bestRaw = quote ? BigInt(quote.output.amountRaw) : 0n;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Router</p>
        <h1 className="mt-1 max-w-2xl text-3xl font-semibold tracking-tight text-balance">
          One size. Every venue priced beside the winner.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-pretty text-muted">
          Solana quotes come from Jupiter. Other chains quote through LI.FI. Bridge moves funds across chains, and the
          transaction is sent only after your wallet approves it.
        </p>
        <div className="mt-3">
          <AirdropBanner />
        </div>
      </div>
      <WalletBag />
      <div className="flex h-11 gap-2">
        {(["swap", "bridge"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`h-11 rounded-lg px-4 text-sm font-semibold ${mode === item ? "bg-accent text-bg" : "border border-line text-muted"}`}
          >
            {item === "swap" ? "Swap" : "Bridge"}
          </button>
        ))}
      </div>
      {mode === "bridge" ? <BridgePanel /> : null}
      {mode === "swap" ? (
      <>
      <label className="sr-only" htmlFor="router-chain">
        Network
      </label>
      <select
        id="router-chain"
        value={network}
        onChange={(event) => setNetwork(event.target.value as ChainId)}
        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base outline-none focus-visible:border-accent md:max-w-xs md:text-sm"
      >
        {CHAINS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {network !== "solana" ? <EvmRouter key={network} chain={network} /> : null}
      {network === "solana" ? (
      <>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <form
          className="rounded-xl border border-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void quoteNow();
          }}
        >
          <label className="text-xs font-medium tracking-wide text-muted uppercase" htmlFor="amount">
            You pay
            {bag.solAsset(input) ? (
              <span className="ml-2 normal-case tracking-normal text-muted">{bag.solAsset(input)?.ui.toLocaleString("en-US", { maximumFractionDigits: 6 })} {input}</span>
            ) : null}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-lg text-fg outline-none focus-visible:border-accent"
            />
            <TokenSelect id="input-token" value={input} onChange={setInput} />
          </div>
          <AmountPercents
            balance={connected.solAddress ? (bag.solAsset(input)?.ui ?? null) : null}
            native={bag.solAsset(input)?.native}
            onPick={setAmount}
          />
          <div className="my-3 flex justify-center">
            <button
              type="button"
              aria-label="Swap direction"
              className="inline-flex size-11 items-center justify-center rounded-full border border-line text-muted hover:text-fg"
              onClick={() => {
                setInput(output);
                setOutput(input);
              }}
            >
              <ArrowLeftRight className="size-4" />
            </button>
          </div>
          <label className="text-xs font-medium tracking-wide text-muted uppercase" htmlFor="output-token">
            You receive
          </label>
          <div className="mt-2">
            <TokenSelect id="output-token" value={output} onChange={setOutput} wide />
          </div>
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
              Quote a pair to see the winning split and what each venue would have returned on its own.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs tracking-wide text-muted uppercase">Best route</p>
                <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
                  {quote.output.amount} <span className="text-lg text-muted">{quote.output.symbol}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  Min {quote.output.minAmount} {quote.output.symbol}
                  {quote.swapUsdValue != null ? ` · ${usd(quote.swapUsdValue)}` : ""}
                  {quote.priceImpactPct != null ? ` · impact ${quote.priceImpactPct.toFixed(3)}%` : ""}
                </p>
                {quote.contextSlot ? (
                  <Link
                    to="/block/$slot"
                    params={{ slot: String(quote.contextSlot) }}
                    className="mt-1 inline-block text-xs text-muted hover:text-accent"
                  >
                    Quoted at slot {slotFmt(quote.contextSlot)}
                  </Link>
                ) : null}
              </div>
              <ol className="flex flex-col gap-2">
                {quote.route.every((step) => step.percent >= 99)
                  ? quote.route.map((step, index) => (
                      <li key={`${step.amm}-${index}`} className="rounded-lg border border-line bg-bg px-3 py-3">
                        <p className="text-xs text-muted">Hop {index + 1}</p>
                        <p className="font-medium">{step.label}</p>
                        {step.amm ? <p className="mt-1 break-all font-mono text-xs text-muted">{step.amm}</p> : null}
                      </li>
                    ))
                  : quote.route.map((step, index) => (
                      <li key={`${step.amm}-${index}`} className="rounded-lg border border-line bg-bg px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{step.label}</span>
                          <span className="font-mono text-sm tabular-nums text-accent">{step.percent}%</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                          <div className="h-full bg-accent" style={{ width: `${Math.min(100, step.percent)}%` }} />
                        </div>
                        {step.amm ? <p className="mt-2 break-all font-mono text-xs text-muted">{step.amm}</p> : null}
                      </li>
                    ))}
              </ol>
              {quote.candidates.length ? (
                <div>
                  <p className="text-xs tracking-wide text-muted uppercase">Same size, one venue</p>
                  <ul className="mt-2 divide-y divide-line">
                    {quote.candidates.map((row) => {
                      const worse = BigInt(row.amountRaw) < bestRaw;
                      return (
                        <li key={row.dex} className="flex items-center justify-between gap-3 py-2">
                          <span>
                            <span className="block text-sm font-medium">{row.dex}</span>
                            <span className="text-xs text-muted">{row.labels.join(" → ")}</span>
                          </span>
                          <span className={`font-mono text-sm tabular-nums ${worse ? "text-muted" : "text-up"}`}>
                            {row.amount}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Build an unsigned transaction</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Paste the signer. T3X returns a base64 transaction and stops there — review it in your wallet before you
          sign. We do not submit it.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Signer public key"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-sm outline-none focus-visible:border-accent"
          />
          <button
            type="button"
            onClick={() => void build()}
            disabled={building || !wallet.trim()}
            className="h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:border-accent disabled:opacity-50"
          >
            {building ? "Building…" : "Build"}
          </button>
        </div>
        {tx ? (
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap justify-end gap-2">
              {connected.solAddress ? (
                <button
                  type="button"
                  disabled={signing}
                  onClick={() => {
                    setSigning(true);
                    setError(null);
                    void connected
                      .sendSolana(tx)
                      .then(async (sig) => {
                        setTx(null);
                        const note = await countTransfer({
                          tx: sig,
                          chain: "solana",
                          kind: "swap",
                          symbol: input,
                          amount,
                          address: connected.solAddress || wallet.trim(),
                        });
                        if (note) setError(note);
                      })
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The wallet did not send it."))
                      .finally(() => setSigning(false));
                  }}
                  className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-bg disabled:opacity-60"
                >
                  {signing ? "Waiting for the wallet…" : "Sign in wallet"}
                </button>
              ) : null}
              <CopyButton value={tx} label="Copy transaction" />
            </div>
            <pre className="max-h-40 overflow-auto break-all rounded-lg bg-bg p-3 font-mono text-xs text-muted">{tx}</pre>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-line bg-bg p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs tracking-wide text-muted uppercase">GET /api/quote</p>
          <CopyButton value={curl.replace("$ORIGIN", typeof window === "undefined" ? "" : window.location.origin)} label="Copy curl" />
        </div>
        <pre className="overflow-auto font-mono text-xs text-muted">{curl}</pre>
      </section>
      </>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function TokenSelect({
  id,
  value,
  onChange,
  wide = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const known = TOKENS.some((token) => token.symbol === value);
  return (
    <select
      id={id}
      value={known ? value : "CUSTOM"}
      onChange={(event) => {
        if (event.target.value !== "CUSTOM") onChange(event.target.value);
      }}
      className={`h-12 rounded-lg border border-line bg-bg px-2 text-sm font-semibold text-fg outline-none ${wide ? "w-full" : ""}`}
    >
      {TOKENS.map((token) => (
        <option key={token.mint} value={token.symbol}>
          {token.symbol}
        </option>
      ))}
      {!known ? <option value="CUSTOM">{value}</option> : null}
    </select>
  );
}
