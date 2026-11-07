import { NATIVE_TOKEN, chainMeta, isEvmChain, parseChain, type ChainId } from "@/lib/chains";
import { formatUnits } from "@/lib/format";

const PLACEHOLDER = "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0";

export type EvmQuote = {
  chain: ChainId;
  tool: string;
  symbol: string;
  amount: string;
  minAmount: string;
  steps: { label: string }[];
  transaction: { to: string; data: string; value: string; gasLimit: string; chainId: number } | null;
};

function parseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("Amount must be a positive number.");
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) throw new Error("Too many decimal places.");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

function resolveToken(chain: ChainId, raw: string): { address: string; decimals: number; symbol: string } {
  const meta = chainMeta(chain);
  const value = raw.trim();
  if (!value || value.toLowerCase() === meta.symbol.toLowerCase() || value.toLowerCase() === "native") {
    return { address: NATIVE_TOKEN, decimals: 18, symbol: meta.symbol };
  }
  if (meta.stable && value.toLowerCase() === meta.stable.symbol.toLowerCase()) {
    return meta.stable;
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return { address: value, decimals: 18, symbol: "Token" };
  throw new Error(
    meta.stable
      ? `Use ${meta.symbol}, ${meta.stable.symbol}, or a token address.`
      : `Use ${meta.symbol} or a token address.`,
  );
}

export async function loadEvmQuote(args: {
  chain: string;
  input: string;
  output: string;
  amount: string;
  slippageBps: number;
  user?: string;
}): Promise<EvmQuote> {
  const chain = parseChain(args.chain);
  if (!isEvmChain(chain)) throw new Error("Pick an EVM chain.");
  const meta = chainMeta(chain);
  if (!meta.chainId) throw new Error("This chain has no quote id.");
  const input = resolveToken(chain, args.input);
  const output = resolveToken(chain, args.output);
  if (input.address.toLowerCase() === output.address.toLowerCase()) throw new Error("Pick two different tokens.");
  const fromAmount = parseUnits(args.amount, input.decimals);
  if (fromAmount <= 0n) throw new Error("Amount must be greater than zero.");
  const user = args.user && /^0x[0-9a-fA-F]{40}$/.test(args.user) ? args.user : "";
  const slippage = Math.min(0.5, Math.max(0.0001, (args.slippageBps || 50) / 10_000));
  const params = new URLSearchParams({
    fromChain: String(meta.chainId),
    toChain: String(meta.chainId),
    fromToken: input.address,
    toToken: output.address,
    fromAmount: fromAmount.toString(),
    fromAddress: user || PLACEHOLDER,
    slippage: String(slippage),
  });
  const response = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
  });
  const json = (await response.json()) as {
    message?: string;
    tool?: string;
    estimate?: { toAmount?: string; toAmountMin?: string };
    action?: { toToken?: { symbol?: string; decimals?: number } };
    includedSteps?: { tool?: string; type?: string }[];
    transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string };
  };
  if (!response.ok || !json.estimate?.toAmount) {
    throw new Error(json.message || "No route for that pair.");
  }
  const decimals = json.action?.toToken?.decimals ?? output.decimals;
  const tx = json.transactionRequest;
  return {
    chain,
    tool: json.tool || "route",
    symbol: json.action?.toToken?.symbol || output.symbol,
    amount: formatUnits(BigInt(json.estimate.toAmount), decimals, 6),
    minAmount: formatUnits(BigInt(json.estimate.toAmountMin || json.estimate.toAmount), decimals, 6),
    steps: (json.includedSteps ?? [])
      .map((step) => ({ label: step.tool || step.type || "step" }))
      .filter((step) => step.label !== "feeCollection"),
    transaction:
      user && tx?.to && tx.data
        ? {
            to: tx.to,
            data: tx.data,
            value: tx.value || "0x0",
            gasLimit: tx.gasLimit || "0x0",
            chainId: meta.chainId ?? 1,
          }
        : null,
  };
}
