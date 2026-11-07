import { NATIVE_TOKEN, chainMeta, parseChain, type ChainId } from "@/lib/chains";
import { formatUnits } from "@/lib/format";

const SOLANA_LIFI = 1151111081099710;
const SOL_NATIVE = "11111111111111111111111111111111";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const EVM_PLACEHOLDER = "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0";
const SOL_PLACEHOLDER = "So11111111111111111111111111111111111111112";

export type BridgeTx =
  | { kind: "evm"; to: string; data: string; value: string; gasLimit: string; chainId: number }
  | { kind: "solana"; data: string };

export type BridgeQuote = {
  fromChain: ChainId;
  toChain: ChainId;
  tool: string;
  symbol: string;
  amount: string;
  minAmount: string;
  steps: { label: string }[];
  transaction: BridgeTx | null;
};

type LifiQuote = {
  message?: string;
  tool?: string;
  estimate?: { toAmount?: string; toAmountMin?: string };
  action?: { toToken?: { symbol?: string; decimals?: number } };
  includedSteps?: { tool?: string; type?: string }[];
  transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string; chainId?: number };
};

function parseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("Amount must be a positive number.");
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) throw new Error("Too many decimal places.");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

function lifiId(chain: ChainId): number {
  return chain === "solana" ? SOLANA_LIFI : (chainMeta(chain).chainId ?? 0);
}

function token(chain: ChainId, kind: "native" | "stable"): { address: string; decimals: number; symbol: string } {
  const meta = chainMeta(chain);
  if (kind === "native") {
    if (meta.kind === "solana") return { address: SOL_NATIVE, decimals: 9, symbol: "SOL" };
    return { address: NATIVE_TOKEN, decimals: 18, symbol: meta.symbol };
  }
  if (meta.kind === "solana") return { address: SOL_USDC, decimals: 6, symbol: "USDC" };
  if (!meta.stable) throw new Error(`${meta.name} has no listed stablecoin. Bridge the native coin instead.`);
  return meta.stable;
}

function looksEvm(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function looksSol(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function fetchLifi(params: URLSearchParams): Promise<{ ok: boolean; json: LifiQuote }> {
  const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
    signal: AbortSignal.timeout(20000),
  });
  const json = (await response.json()) as LifiQuote;
  return { ok: response.ok && Boolean(json.estimate?.toAmount), json };
}

export async function loadBridgeQuote(args: {
  fromChain: string;
  toChain: string;
  asset?: string;
  amount: string;
  slippageBps?: number;
  fromAddress?: string;
  toAddress?: string;
}): Promise<BridgeQuote> {
  const fromChain = parseChain(args.fromChain);
  const toChain = parseChain(args.toChain);
  if (fromChain === toChain) throw new Error("Pick two different chains. Same-chain swaps stay on the swap tab.");
  const asset = args.asset === "stable" ? "stable" : "native";
  const fromToken = token(fromChain, asset);
  const toToken = token(toChain, asset);
  const fromAmount = parseUnits(args.amount, fromToken.decimals);
  if (fromAmount <= 0n) throw new Error("Amount must be greater than zero.");

  const fromIsSol = fromChain === "solana";
  const toIsSol = toChain === "solana";
  const givenFrom = args.fromAddress?.trim() ?? "";
  const givenTo = args.toAddress?.trim() ?? "";
  const fromOk = fromIsSol ? looksSol(givenFrom) : looksEvm(givenFrom);
  const toOk = toIsSol ? looksSol(givenTo) : looksEvm(givenTo);
  const fromAddress = fromOk ? givenFrom : fromIsSol ? SOL_PLACEHOLDER : EVM_PLACEHOLDER;
  const toAddress = toOk
    ? givenTo
    : toIsSol
      ? fromIsSol && fromOk
        ? givenFrom
        : SOL_PLACEHOLDER
      : fromOk && !fromIsSol
        ? givenFrom
        : EVM_PLACEHOLDER;

  const slippage = Math.min(0.5, Math.max(0.0001, (args.slippageBps || 50) / 10_000));
  const params = new URLSearchParams({
    fromChain: String(lifiId(fromChain)),
    toChain: String(lifiId(toChain)),
    fromToken: fromToken.address,
    toToken: toToken.address,
    fromAmount: fromAmount.toString(),
    fromAddress,
    toAddress,
    slippage: String(slippage),
  });
  if (fromIsSol || toIsSol) params.set("denyBridges", "near");
  let { ok, json } = await fetchLifi(params);
  if (!ok && params.has("denyBridges")) {
    params.delete("denyBridges");
    ({ ok, json } = await fetchLifi(params));
  }
  if (!ok || !json.estimate?.toAmount) {
    const text = (json.message || "").trim();
    throw new Error(
      !text || /unexpected error/i.test(text)
        ? `No bridge from ${chainMeta(fromChain).name} to ${chainMeta(toChain).name} for that amount. Try a different amount.`
        : text,
    );
  }

  const decimals = json.action?.toToken?.decimals ?? toToken.decimals;
  const tx = json.transactionRequest;
  let transaction: BridgeTx | null = null;
  if (fromOk && tx?.data) {
    if (fromIsSol) transaction = { kind: "solana", data: tx.data };
    else if (tx.to) {
      transaction = {
        kind: "evm",
        to: tx.to,
        data: tx.data,
        value: tx.value || "0x0",
        gasLimit: tx.gasLimit || "0x0",
        chainId: tx.chainId || lifiId(fromChain),
      };
    }
  }

  return {
    fromChain,
    toChain,
    tool: json.tool || "bridge",
    symbol: json.action?.toToken?.symbol || toToken.symbol,
    amount: formatUnits(BigInt(json.estimate.toAmount), decimals, 6),
    minAmount: formatUnits(BigInt(json.estimate.toAmountMin || json.estimate.toAmount), decimals, 6),
    steps: (json.includedSteps ?? [])
      .map((step) => ({ label: step.tool || step.type || "step" }))
      .filter((step) => step.label !== "feeCollection"),
    transaction,
  };
}
