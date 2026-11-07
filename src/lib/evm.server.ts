import { chainMeta, evmChainList, type ChainId, type MarketToken } from "@/lib/chains";
import { formatUnits } from "@/lib/format";

type CacheEntry = { at: number; data: unknown };
const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = fn()
    .then((data) => {
      mem.set(key, { at: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch((error: unknown) => {
      inflight.delete(key);
      throw error;
    });
  inflight.set(key, promise);
  return promise;
}

async function rpcCall(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);
  return response.json();
}

async function evm<T>(chain: ChainId, method: string, params: unknown[] = []): Promise<T> {
  const meta = chainMeta(chain);
  let last: unknown;
  for (const url of meta.rpcs) {
    try {
      const json = (await rpcCall(url, { jsonrpc: "2.0", id: 1, method, params }, 12000)) as {
        result?: T;
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message || "RPC error");
      return json.result as T;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error(`${meta.name} RPC failed`);
}

async function evmBatch(chain: ChainId, calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  const meta = chainMeta(chain);
  const body = calls.map((call, index) => ({ jsonrpc: "2.0", id: index, method: call.method, params: call.params }));
  for (const url of meta.rpcs) {
    try {
      const json = (await rpcCall(url, body, 18000)) as { id: number; result?: unknown; error?: unknown }[];
      if (!Array.isArray(json)) throw new Error("RPC batch rejected");
      const byId = new Map(json.map((row) => [row.id, row]));
      return calls.map((_, index) => {
        const row = byId.get(index);
        if (!row || row.error) return null;
        return row.result ?? null;
      });
    } catch {
      continue;
    }
  }
  return calls.map(() => null);
}

function hexQty(value: unknown): bigint {
  if (typeof value !== "string" || !value.startsWith("0x")) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function hexNum(value: unknown): number {
  const qty = hexQty(value);
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(qty > max ? max : qty);
}

export function gweiLabel(wei: bigint): string {
  const whole = wei / 1_000_000_000n;
  const frac = wei % 1_000_000_000n;
  const digits = whole >= 100n ? 0 : whole >= 1n ? 2 : 4;
  const padded = frac.toString().padStart(9, "0").slice(0, digits).replace(/0+$/, "");
  const body = padded ? `${whole.toString()}.${padded}` : whole.toString();
  return `${body} gwei`;
}

type RpcBlock = {
  number?: string;
  timestamp?: string;
  transactions?: string[];
  miner?: string;
  gasUsed?: string;
  gasLimit?: string;
  hash?: string;
  parentHash?: string;
};

function asBlock(value: unknown): RpcBlock | null {
  if (!value || typeof value !== "object") return null;
  return value as RpcBlock;
}

export type EvmHead = {
  number: number;
  gasPrice: bigint;
  blocks: {
    number: number;
    time: number | null;
    txCount: number;
    miner: string;
    hash: string;
    txs: string[];
    gasUsed: bigint;
    gasLimit: bigint;
  }[];
};

export async function loadEvmHead(chain: ChainId): Promise<EvmHead> {
  return cached(`evm-head:${chain}`, 5000, async () => {
    const [tipHex, gasHex] = await Promise.all([
      evm<string>(chain, "eth_blockNumber"),
      evm<string>(chain, "eth_gasPrice").catch(() => "0x0"),
    ]);
    const tip = hexNum(tipHex);
    const ids = Array.from({ length: 8 }, (_, index) => Math.max(0, tip - index));
    const raw = await evmBatch(
      chain,
      ids.map((number) => ({
        method: "eth_getBlockByNumber",
        params: [`0x${number.toString(16)}`, false],
      })),
    );
    const blocks = raw
      .map((row, index) => {
        const block = asBlock(row);
        if (!block?.hash) return null;
        const txs = Array.isArray(block.transactions) ? block.transactions.filter((tx) => typeof tx === "string") : [];
        return {
          number: hexNum(block.number) || ids[index]!,
          time: block.timestamp ? hexNum(block.timestamp) : null,
          txCount: txs.length,
          miner: typeof block.miner === "string" ? block.miner : "",
          hash: block.hash,
          txs,
          gasUsed: hexQty(block.gasUsed),
          gasLimit: hexQty(block.gasLimit),
        };
      })
      .filter((row): row is EvmHead["blocks"][number] => row !== null);
    return { number: tip, gasPrice: hexQty(gasHex), blocks };
  });
}

type DexPair = {
  baseToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
};

export async function loadDexTokens(dexChain: string, addresses: string[]): Promise<MarketToken[]> {
  const unique = [...new Set(addresses.map((address) => address.trim()).filter(Boolean))].slice(0, 8);
  if (!unique.length) return [];
  return cached(`dex:${dexChain}:${unique.join(",")}`, 60000, async () => {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/${dexChain}/${unique.join(",")}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const pairs = (await response.json()) as DexPair[];
    const best = new Map<string, MarketToken>();
    for (const pair of Array.isArray(pairs) ? pairs : []) {
      const address = pair.baseToken?.address;
      if (!address) continue;
      const liquidityUsd = pair.liquidity?.usd ?? 0;
      const prev = best.get(address.toLowerCase());
      if (prev && (prev.liquidityUsd ?? 0) > liquidityUsd) continue;
      best.set(address.toLowerCase(), {
        address,
        symbol: pair.baseToken?.symbol || "—",
        name: pair.baseToken?.name || "Token",
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
        changeH24: pair.priceChange?.h24 ?? null,
        liquidityUsd,
        volumeH24: pair.volume?.h24 ?? null,
      });
    }
    return unique
      .map((address) => best.get(address.toLowerCase()))
      .filter((row): row is MarketToken => Boolean(row));
  });
}

export async function loadNativeQuote(chain: ChainId): Promise<{ usd: number | null; change: number | null }> {
  const meta = chainMeta(chain);
  return cached(`native:${chain}`, 30000, async () => {
    const fromDex = meta.wrapped ? await loadDexTokens(meta.dex, [meta.wrapped]).catch(() => []) : [];
    const dex = fromDex[0];
    if (dex?.priceUsd) return { usd: dex.priceUsd, change: dex.changeH24 };
    if (!meta.llama) return { usd: null, change: null };
    const response = await fetch(`https://coins.llama.fi/prices/current/${meta.llama}`, {
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!response?.ok) return { usd: null, change: null };
    const json = (await response.json()) as { coins?: Record<string, { price?: number }> };
    const price = json.coins?.[meta.llama]?.price;
    return { usd: typeof price === "number" ? price : null, change: null };
  });
}

export async function loadEvmMarkets(chain: ChainId): Promise<{ title: string; tokens: MarketToken[] }> {
  const meta = chainMeta(chain);
  return cached(`markets:${chain}`, 60000, async () => {
    const boosts = (await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(8000),
    })
      .then((response) => response.json())
      .catch(() => [])) as { chainId?: string; tokenAddress?: string }[];
    const boosted = (Array.isArray(boosts) ? boosts : [])
      .filter((row) => row.chainId === meta.dex && row.tokenAddress)
      .map((row) => row.tokenAddress as string)
      .slice(0, 4);
    if (boosted.length) {
      const tokens = await loadDexTokens(meta.dex, boosted).catch(() => []);
      if (tokens.length) return { title: "Boosted tokens", tokens };
    }
    const tokens = await loadDexTokens(meta.dex, meta.markets).catch(() => []);
    return { title: "Active markets", tokens };
  });
}

export type EvmBlockView = {
  found: boolean;
  chain: ChainId;
  number: number;
  time: number | null;
  txCount: number;
  gasUsed: string;
  gasLimit: string;
  miner: string;
  hash: string;
  parent: number | null;
  txs: string[];
};

export async function loadEvmBlock(chain: ChainId, id: string): Promise<EvmBlockView> {
  const number = Number(id);
  return cached(`evm-block:${chain}:${number}`, 20000, async () => {
    const empty: EvmBlockView = {
      found: false,
      chain,
      number,
      time: null,
      txCount: 0,
      gasUsed: "—",
      gasLimit: "—",
      miner: "",
      hash: "",
      parent: number > 0 ? number - 1 : null,
      txs: [],
    };
    const block = asBlock(
      await evm<unknown>(chain, "eth_getBlockByNumber", [`0x${number.toString(16)}`, false]).catch(() => null),
    );
    if (!block?.hash) return empty;
    const txs = Array.isArray(block.transactions) ? block.transactions.filter((tx) => typeof tx === "string") : [];
    return {
      found: true,
      chain,
      number: hexNum(block.number) || number,
      time: block.timestamp ? hexNum(block.timestamp) : null,
      txCount: txs.length,
      gasUsed: hexQty(block.gasUsed).toLocaleString("en-US"),
      gasLimit: hexQty(block.gasLimit).toLocaleString("en-US"),
      miner: block.miner ?? "",
      hash: block.hash,
      parent: number > 0 ? number - 1 : null,
      txs: txs.slice(0, 30),
    };
  });
}

type RpcTx = {
  hash?: string;
  blockNumber?: string | null;
  from?: string;
  to?: string | null;
  value?: string;
  gasPrice?: string;
  nonce?: string;
  input?: string;
};

type RpcReceipt = {
  status?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  blockNumber?: string;
};

export type EvmTxView = {
  found: boolean;
  chain: ChainId;
  hash: string;
  ok: boolean | null;
  block: number | null;
  time: number | null;
  from: string;
  to: string;
  value: string;
  symbol: string;
  fee: string | null;
  gas: string | null;
  nonce: string | null;
  action: string;
  detail: string;
};

export async function loadEvmTx(chain: ChainId, hash: string): Promise<EvmTxView> {
  const meta = chainMeta(chain);
  return cached(`evm-tx:${chain}:${hash.toLowerCase()}`, 30000, async () => {
    const empty: EvmTxView = {
      found: false,
      chain,
      hash,
      ok: null,
      block: null,
      time: null,
      from: "",
      to: "",
      value: "0",
      symbol: meta.symbol,
      fee: null,
      gas: null,
      nonce: null,
      action: "Unknown",
      detail: "",
    };
    const tx = (await evm<RpcTx | null>(chain, "eth_getTransactionByHash", [hash]).catch(() => null)) ?? null;
    if (!tx?.hash) return empty;
    const receipt = tx.blockNumber
      ? await evm<RpcReceipt | null>(chain, "eth_getTransactionReceipt", [hash]).catch(() => null)
      : null;
    const block = tx.blockNumber
      ? asBlock(await evm<unknown>(chain, "eth_getBlockByNumber", [tx.blockNumber, false]).catch(() => null))
      : null;
    const gasUsed = hexQty(receipt?.gasUsed);
    const price = hexQty(receipt?.effectiveGasPrice ?? tx.gasPrice);
    const fee = gasUsed > 0n && price > 0n ? formatUnits(gasUsed * price, 18, 6) : null;
    const described = await describeCall(tx.input, hexQty(tx.value), meta.symbol);
    return {
      found: true,
      chain,
      hash: tx.hash,
      ok: receipt?.status == null ? null : receipt.status === "0x1",
      block: tx.blockNumber ? hexNum(tx.blockNumber) : null,
      time: block?.timestamp ? hexNum(block.timestamp) : null,
      from: tx.from ?? "",
      to: tx.to ?? "",
      value: formatUnits(hexQty(tx.value), 18, 6),
      symbol: meta.symbol,
      fee,
      gas: receipt?.gasUsed ? gasUsed.toLocaleString("en-US") : null,
      nonce: tx.nonce ? hexQty(tx.nonce).toString() : null,
      action: described.action,
      detail: described.detail,
    };
  });
}

export type EvmAccountView = {
  found: boolean;
  chain: ChainId;
  address: string;
  kind: "wallet" | "contract" | "token";
  balance: string;
  symbol: string;
  nonce: number;
  token: MarketToken | null;
};

export async function loadEvmAccount(chain: ChainId, address: string): Promise<EvmAccountView> {
  const meta = chainMeta(chain);
  return cached(`evm-acct:${chain}:${address.toLowerCase()}`, 15000, async () => {
    const [balanceHex, code, nonceHex, markets] = await Promise.all([
      evm<string>(chain, "eth_getBalance", [address, "latest"]).catch(() => null),
      evm<string>(chain, "eth_getCode", [address, "latest"]).catch(() => "0x"),
      evm<string>(chain, "eth_getTransactionCount", [address, "latest"]).catch(() => "0x0"),
      loadDexTokens(meta.dex, [address]).catch(() => []),
    ]);
    if (balanceHex == null) {
      return {
        found: false,
        chain,
        address,
        kind: "wallet",
        balance: "0",
        symbol: meta.symbol,
        nonce: 0,
        token: null,
      };
    }
    const token = markets[0] ?? null;
    const isContract = typeof code === "string" && code !== "0x" && code.length > 2;
    return {
      found: true,
      chain,
      address,
      kind: token ? "token" : isContract ? "contract" : "wallet",
      balance: formatUnits(hexQty(balanceHex), 18, 6),
      symbol: meta.symbol,
      nonce: hexNum(nonceHex),
      token,
    };
  });
}

const MAX_UINT = (1n << 256n) - 1n;

function callWords(input: string): bigint[] {
  const hex = input.startsWith("0x") ? input.slice(2) : input;
  const body = hex.slice(8);
  const words: bigint[] = [];
  for (let index = 0; index + 64 <= body.length; index += 64) {
    words.push(BigInt(`0x${body.slice(index, index + 64)}`));
  }
  return words;
}

function wordAddress(word: bigint): string {
  return `0x${word.toString(16).padStart(40, "0").slice(-40)}`;
}

function amountLabel(raw: bigint): string {
  if (raw === MAX_UINT) return "unlimited";
  return formatUnits(raw, 18, 6);
}

const KNOWN_CALLS: Record<string, string> = {
  a9059cbb: "Transfer",
  "23b872dd": "Transfer",
  "095ea7b3": "Approve",
  "39509351": "Increase allowance",
  "2e1a7d4d": "Withdraw",
  d0e30db0: "Deposit",
  b6b55f25: "Deposit",
  "3ccfd60b": "Withdraw",
  a22cb465: "Set approval for all",
  "42842e0e": "Transfer NFT",
  f242432a: "Safe transfer",
  "38ed1739": "Swap",
  "7ff36ab5": "Swap",
  "18cbafe5": "Swap",
  "04e45aaf": "Swap",
  "414bf389": "Swap",
  "5ae401dc": "Multicall",
  ac9650d8: "Multicall",
  "3593564c": "Universal router",
  "791ac947": "Swap",
  e8e33700: "Add liquidity",
  "02751cec": "Remove liquidity",
};

async function signatureName(selector: string): Promise<string | null> {
  return cached(`sig:${selector}`, 86_400_000, async () => {
    const response = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { results?: { text_signature?: string }[] };
    const text = json.results?.find((row) => row.text_signature)?.text_signature;
    if (!text) return null;
    return text.split("(")[0] ?? null;
  }).catch(() => null);
}

async function describeCall(
  input: string | undefined,
  value: bigint,
  symbol: string,
): Promise<{ action: string; detail: string }> {
  const native = value > 0n ? `${formatUnits(value, 18, 6)} ${symbol}` : "";
  const data = input ?? "0x";
  if (data === "0x" || data === "0x0" || data.length < 10) {
    return { action: native ? "Transfer" : "Call", detail: native || "No value" };
  }
  const selector = data.slice(2, 10).toLowerCase();
  const words = callWords(data);
  if (selector === "a9059cbb" && words.length >= 2) {
    return { action: "Transfer", detail: `${amountLabel(words[1]!)} tokens to ${wordAddress(words[0]!)}` };
  }
  if (selector === "23b872dd" && words.length >= 3) {
    return { action: "Transfer", detail: `${amountLabel(words[2]!)} tokens to ${wordAddress(words[1]!)}` };
  }
  if (selector === "095ea7b3" && words.length >= 2) {
    return { action: "Approve", detail: `${amountLabel(words[1]!)} for ${wordAddress(words[0]!)}` };
  }
  if (selector === "d0e30db0") return { action: "Wrap", detail: native || "Deposit" };
  if (selector === "2e1a7d4d" && words[0] != null) return { action: "Unwrap", detail: amountLabel(words[0]) };
  const known = KNOWN_CALLS[selector];
  if (known) return { action: known, detail: native || `Selector 0x${selector}` };
  const lookedUp = await signatureName(selector);
  if (lookedUp) {
    const action = lookedUp
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
    return { action, detail: native || `0x${selector}` };
  }
  return { action: "Contract call", detail: native || `0x${selector}` };
}

async function quick<T>(chain: ChainId, method: string, params: unknown[]): Promise<T> {
  const meta = chainMeta(chain);
  let last: unknown;
  for (const url of meta.rpcs) {
    try {
      const json = (await rpcCall(url, { jsonrpc: "2.0", id: 1, method, params }, 7000)) as {
        result?: T;
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message || "RPC error");
      return json.result as T;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("RPC failed");
}

export type GasRow = { chain: ChainId; name: string; symbol: string; gas: string | null };

export async function loadGasBoard(): Promise<GasRow[]> {
  return cached("gas-board", 20000, async () => {
    return Promise.all(
      evmChainList().map(async (chain) => {
        try {
          const hex = await quick<string>(chain.id, "eth_gasPrice", []);
          return { chain: chain.id, name: chain.name, symbol: chain.symbol, gas: gweiLabel(hexQty(hex)) };
        } catch {
          return { chain: chain.id, name: chain.name, symbol: chain.symbol, gas: null };
        }
      }),
    );
  });
}

export type BalanceRow = { chain: ChainId; name: string; symbol: string; balance: string | null };

export async function loadEvmBalances(address: string): Promise<BalanceRow[]> {
  return cached(`balances:${address.toLowerCase()}`, 20000, async () => {
    return Promise.all(
      evmChainList().map(async (chain) => {
        try {
          const hex = await quick<string>(chain.id, "eth_getBalance", [address, "latest"]);
          return { chain: chain.id, name: chain.name, symbol: chain.symbol, balance: formatUnits(hexQty(hex), 18, 6) };
        } catch {
          return { chain: chain.id, name: chain.name, symbol: chain.symbol, balance: null };
        }
      }),
    );
  });
}
