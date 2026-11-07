import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/bits";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({ meta: [{ title: "API · T3X Sol Scanner" }] }),
});

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/network",
    detail: "Slot, block height, epoch progress, TPS, and the SOL price.",
  },
  {
    method: "GET",
    path: "/api/blocks",
    detail: "Recent confirmed blocks with leader, time, and a handful of signatures.",
  },
  {
    method: "GET",
    path: "/api/block?slot=466000000",
    detail: "One block. Up to 40 signatures, plus the leader.",
  },
  {
    method: "GET",
    path: "/api/tx?sig=SIGNATURE",
    detail: "Parsed transaction: fee, balance changes, instructions, logs.",
  },
  {
    method: "GET",
    path: "/api/account?address=ADDRESS",
    detail: "Wallet, mint, or token account. Mints include authorities and largest holders.",
  },
  {
    method: "GET",
    path: "/api/trending",
    detail: "Boosted Solana tokens with price, liquidity, and 24h change.",
  },
  {
    method: "GET",
    path: "/api/quote?input=SOL&output=USDC&amount=0.1&slippageBps=50",
    detail: "Best route plus single-venue quotes. input and output accept a symbol or a mint. amount is in UI units.",
  },
  {
    method: "POST",
    path: "/api/swap",
    detail: 'Body: { "input", "output", "amount", "slippageBps", "userPublicKey" }. Returns an unsigned base64 transaction. T3X does not send it.',
  },
];

function DocsPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">API</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Same data the scanner uses.</h1>
        <p className="mt-2 max-w-2xl text-sm text-pretty text-muted">
          No key. JSON in, JSON out. These routes are the public face of the explorer and the router. Chain reads
          can lag a slot or two on the shared mainnet RPC.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {ENDPOINTS.map((endpoint) => {
          const sample =
            endpoint.method === "POST"
              ? `curl -X POST ${origin}${endpoint.path.split(" ")[0]} \\\n  -H 'content-type: application/json' \\\n  -d '{"input":"SOL","output":"USDC","amount":"0.1","slippageBps":50,"userPublicKey":"YOUR_WALLET"}'`
              : `curl ${origin}${endpoint.path.startsWith("/api/quote") ? "/api/quote?input=SOL&output=USDC&amount=0.1&slippageBps=50" : endpoint.path.split(" ")[0] === "/api/block?slot=466000000" ? endpoint.path : endpoint.path.includes("SIGNATURE") || endpoint.path.includes("ADDRESS") ? endpoint.path : endpoint.path}`;
          const href = endpoint.path.includes("?") || endpoint.method === "POST" ? endpoint.path : endpoint.path;
          return (
            <li key={endpoint.path} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-bg px-2 py-1 font-mono text-xs text-accent">{endpoint.method}</span>
                <code className="break-all font-mono text-sm">{href}</code>
              </div>
              <p className="mt-2 text-sm text-pretty text-muted">{endpoint.detail}</p>
              <div className="mt-3 flex justify-end">
                <CopyButton value={sample} label="Copy curl" />
              </div>
              <pre className="mt-2 overflow-auto font-mono text-xs leading-5 text-muted">{sample}</pre>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
