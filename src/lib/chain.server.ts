import { formatUnits, toBaseUnits } from "@/lib/format";
import { SOL_MINT, TOKENS, knownToken, programName, type TokenInfo } from "@/lib/labels";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

const BLOCK_CFG = {
  encoding: "json",
  transactionDetails: "signatures",
  rewards: false,
  maxSupportedTransactionVersion: 1,
  commitment: "confirmed",
} as const;

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

export async function rpc<T>(method: string, params: unknown[] = [], timeoutMs = 12000): Promise<T> {
  let last: unknown;
  for (const url of RPCS) {
    try {
      const json = (await rpcCall(url, { jsonrpc: "2.0", id: 1, method, params }, timeoutMs)) as {
        result?: T;
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message || "RPC error");
      return json.result as T;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Solana RPC failed");
}

async function rpcBatch(calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  const body = calls.map((call, index) => ({
    jsonrpc: "2.0",
    id: index,
    method: call.method,
    params: call.params,
  }));
  for (const url of RPCS) {
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

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export type NetworkView = {
  slot: number;
  blockHeight: number;
  epoch: number;
  epochProgress: number;
  slotsLeft: number;
  slotsPerSec: number | null;
  tps: number | null;
  solPrice: number | null;
  solChange24h: number | null;
};

export async function loadNetwork(): Promise<NetworkView> {
  return cached("network", 4000, async () => {
    const [epoch, samples, priceJson] = await Promise.all([
      rpc<{
        absoluteSlot: number;
        blockHeight: number;
        epoch: number;
        slotIndex: number;
        slotsInEpoch: number;
      }>("getEpochInfo", [{ commitment: "confirmed" }]),
      rpc<
        { numTransactions: number; numSlots: number; samplePeriodSecs: number }[]
      >("getRecentPerformanceSamples", [1]).catch(() => []),
      fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`, {
        signal: AbortSignal.timeout(8000),
      })
        .then((response) => response.json())
        .catch(() => null),
    ]);
    const sample = samples[0];
    const priceRow = rec(rec(priceJson)?.[SOL_MINT]);
    const progress = epoch.slotsInEpoch > 0 ? (epoch.slotIndex / epoch.slotsInEpoch) * 100 : 0;
    return {
      slot: epoch.absoluteSlot,
      blockHeight: epoch.blockHeight,
      epoch: epoch.epoch,
      epochProgress: progress,
      slotsLeft: Math.max(0, epoch.slotsInEpoch - epoch.slotIndex),
      slotsPerSec: sample && sample.samplePeriodSecs > 0 ? sample.numSlots / sample.samplePeriodSecs : null,
      tps: sample && sample.samplePeriodSecs > 0 ? sample.numTransactions / sample.samplePeriodSecs : null,
      solPrice: num(priceRow?.usdPrice),
      solChange24h: num(priceRow?.priceChange24h),
    };
  });
}

export type BlockRow = {
  slot: number;
  time: number | null;
  txCount: number;
  leader: string;
  parentSlot: number;
  height: number | null;
  signatures: string[];
};

type RawBlock = {
  blockTime?: number | null;
  blockHeight?: number | null;
  parentSlot?: number;
  signatures?: string[];
} | null;

export async function loadBlocks(): Promise<{ blocks: BlockRow[]; warning: string | null }> {
  return cached("blocks", 5000, async () => {
    const network = await loadNetwork();
    const tip = Math.max(0, network.slot - 2);
    const span = 10;
    const start = Math.max(0, tip - span + 1);
    const slots: number[] = [];
    for (let slot = tip; slot >= start; slot -= 1) slots.push(slot);
    const [blocks, leaders] = await Promise.all([
      rpcBatch(
        slots.map((slot) => ({
          method: "getBlock",
          params: [slot, BLOCK_CFG],
        })),
      ),
      rpc<string[]>("getSlotLeaders", [start, tip - start + 1]).catch(() => [] as string[]),
    ]);
    const rows: BlockRow[] = [];
    slots.forEach((slot, index) => {
      const block = blocks[index] as RawBlock;
      if (!block || !Array.isArray(block.signatures)) return;
      rows.push({
        slot,
        time: block.blockTime ?? null,
        txCount: block.signatures.length,
        leader: leaders[slot - start] ?? "",
        parentSlot: block.parentSlot ?? slot - 1,
        height: block.blockHeight ?? null,
        signatures: block.signatures.slice(0, 8),
      });
    });
    return {
      blocks: rows.slice(0, 8),
      warning: rows.length ? null : "Latest blocks are not available from the public RPC yet. Try again in a moment.",
    };
  });
}

export type BlockDetail = BlockRow & {
  blockhash: string | null;
  found: boolean;
};

export async function loadBlock(slot: number): Promise<BlockDetail> {
  return cached(`block:${slot}`, 20000, async () => {
    const [block, leaders] = await Promise.all([
      rpc<RawBlock & { blockhash?: string }>("getBlock", [slot, BLOCK_CFG]).catch(() => null),
      rpc<string[]>("getSlotLeaders", [slot, 1]).catch(() => [] as string[]),
    ]);
    if (!block) {
      return {
        found: false,
        slot,
        time: null,
        txCount: 0,
        leader: leaders[0] ?? "",
        parentSlot: slot - 1,
        height: null,
        signatures: [],
        blockhash: null,
      };
    }
    const signatures = Array.isArray(block.signatures) ? block.signatures : [];
    return {
      found: true,
      slot,
      time: block.blockTime ?? null,
      txCount: signatures.length,
      leader: leaders[0] ?? "",
      parentSlot: block.parentSlot ?? slot - 1,
      height: block.blockHeight ?? null,
      signatures: signatures.slice(0, 40),
      blockhash: block.blockhash ?? null,
    };
  });
}

type ParsedIx = {
  programId?: string;
  program?: string;
  parsed?: { type?: string; info?: Record<string, unknown> };
  accounts?: string[];
};

type TxResult = {
  slot: number;
  blockTime: number | null;
  version?: number | "legacy";
  meta: {
    fee?: number;
    err?: unknown;
    computeUnitsConsumed?: number;
    logMessages?: string[];
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: TokenBal[];
    postTokenBalances?: TokenBal[];
    innerInstructions?: { index: number; instructions: unknown[] }[];
  } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys?: { pubkey: string; signer?: boolean; writable?: boolean }[] | string[];
      recentBlockhash?: string;
      instructions?: ParsedIx[];
    };
  };
};

type TokenBal = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string };
};

function accountKey(keys: TxResult["transaction"]["message"]["accountKeys"], index: number) {
  const key = keys?.[index];
  if (!key) return { address: "", signer: false, writable: false };
  if (typeof key === "string") return { address: key, signer: index === 0, writable: false };
  return { address: key.pubkey, signer: Boolean(key.signer), writable: Boolean(key.writable) };
}

function ixSummary(ix: ParsedIx): string {
  const type = ix.parsed?.type;
  const info = ix.parsed?.info ?? {};
  if (type === "transfer" && typeof info.lamports === "number") {
    return `Transfer ${formatUnits(BigInt(info.lamports), 9)} SOL`;
  }
  if (type === "transferChecked") {
    const token = rec(info.tokenAmount);
    const amount = str(token?.uiAmountString) ?? str(token?.amount) ?? "";
    return `Transfer ${amount}`.trim();
  }
  if (type === "setComputeUnitLimit" && typeof info.units === "number") {
    return `CU limit ${info.units.toLocaleString("en-US")}`;
  }
  if (type === "setComputeUnitPrice") {
    return `Priority ${String(info.microLamports ?? "")} µ-lamports`;
  }
  if (type) return type.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const count = ix.accounts?.length ?? 0;
  return count ? `Raw instruction · ${count} accounts` : "Raw instruction";
}

export type TxView =
  | { found: false; signature: string }
  | {
      found: true;
      signature: string;
      slot: number;
      time: number | null;
      feeLamports: number;
      computeUnits: number | null;
      err: string | null;
      version: string;
      recentBlockhash: string | null;
      logs: string[];
      logCount: number;
      accounts: { index: number; address: string; signer: boolean; writable: boolean }[];
      solChanges: { address: string; delta: string; feePayer: boolean }[];
      tokenChanges: { mint: string; owner: string; delta: string; decimals: number }[];
      instructions: { index: number; program: string; programId: string; summary: string; inner: number }[];
    };

export async function loadTx(signature: string): Promise<TxView> {
  return cached(`tx:${signature}`, 30000, async () => {
    const result = await rpc<TxResult | null>("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" },
    ]).catch(() => null);
    if (!result) return { found: false, signature };
    const keys = result.transaction.message.accountKeys ?? [];
    const accounts = (Array.isArray(keys) ? keys : []).map((_, index) => ({
      index,
      ...accountKey(keys, index),
    }));
    const feePayer = accounts.find((account) => account.signer)?.address ?? accounts[0]?.address ?? "";
    const pre = result.meta?.preBalances ?? [];
    const post = result.meta?.postBalances ?? [];
    const solChanges = accounts
      .map((account, index) => {
        const delta = BigInt(post[index] ?? 0) - BigInt(pre[index] ?? 0);
        if (delta === 0n) return null;
        return {
          address: account.address,
          delta: formatUnits(delta, 9),
          feePayer: account.address === feePayer,
        };
      })
      .filter((row): row is { address: string; delta: string; feePayer: boolean } => row !== null);

    const tokenMap = new Map<string, { mint: string; owner: string; pre: bigint; post: bigint; decimals: number }>();
    const fold = (rows: TokenBal[] | undefined, side: "pre" | "post") => {
      for (const row of rows ?? []) {
        const id = `${row.accountIndex}:${row.mint}`;
        const current = tokenMap.get(id) ?? {
          mint: row.mint,
          owner: row.owner ?? accountKey(keys, row.accountIndex).address,
          pre: 0n,
          post: 0n,
          decimals: row.uiTokenAmount?.decimals ?? 0,
        };
        const amount = BigInt(row.uiTokenAmount?.amount ?? "0");
        if (side === "pre") current.pre = amount;
        else current.post = amount;
        tokenMap.set(id, current);
      }
    };
    fold(result.meta?.preTokenBalances, "pre");
    fold(result.meta?.postTokenBalances, "post");
    const tokenChanges = [...tokenMap.values()]
      .map((row) => {
        const delta = row.post - row.pre;
        if (delta === 0n) return null;
        return {
          mint: row.mint,
          owner: row.owner,
          delta: formatUnits(delta, row.decimals),
          decimals: row.decimals,
        };
      })
      .filter((row): row is { mint: string; owner: string; delta: string; decimals: number } => row !== null);

    const innerCounts = new Map<number, number>();
    for (const group of result.meta?.innerInstructions ?? []) {
      innerCounts.set(group.index, group.instructions?.length ?? 0);
    }
    const instructions = (result.transaction.message.instructions ?? []).map((ix, index) => {
      const programId = ix.programId || "";
      return {
        index,
        programId,
        program: ix.program || programName(programId) || "Program",
        summary: ixSummary(ix),
        inner: innerCounts.get(index) ?? 0,
      };
    });
    const logs = result.meta?.logMessages ?? [];
    return {
      found: true,
      signature,
      slot: result.slot,
      time: result.blockTime,
      feeLamports: result.meta?.fee ?? 0,
      computeUnits: result.meta?.computeUnitsConsumed ?? null,
      err: result.meta?.err ? JSON.stringify(result.meta.err) : null,
      version: result.version === undefined || result.version === "legacy" ? "legacy" : `v${result.version}`,
      recentBlockhash: result.transaction.message.recentBlockhash ?? null,
      logs: logs.slice(0, 40),
      logCount: logs.length,
      accounts: accounts.slice(0, 40),
      solChanges,
      tokenChanges,
      instructions,
    };
  });
}

export type Holding = {
  mint: string;
  symbol: string;
  amount: string;
  ui: number;
  valueUsd: number | null;
};

export type HolderRow = {
  account: string;
  owner: string;
  amount: string;
  share: number | null;
};

export type SigRow = {
  signature: string;
  slot: number;
  time: number | null;
  ok: boolean;
};

export type AccountView =
  | { found: false; address: string; note: string }
  | {
      found: true;
      kind: "wallet" | "mint" | "token" | "account";
      address: string;
      lamports: number;
      ownerProgram: string;
      ownerProgramId: string;
      executable: boolean;
      title: string;
      symbol: string | null;
      name: string | null;
      decimals: number | null;
      supply: string | null;
      mintAuthority: string | null;
      freezeAuthority: string | null;
      tokenMint: string | null;
      tokenOwner: string | null;
      tokenAmount: string | null;
      priceUsd: number | null;
      changeH24: number | null;
      liquidityUsd: number | null;
      volumeH24: number | null;
      marketCap: number | null;
      holdings: Holding[];
      holdingsNote: string | null;
      holders: HolderRow[];
      signatures: SigRow[];
      portfolioUsd: number | null;
    };

async function jupPrices(ids: string[]): Promise<Record<string, { usd: number; change: number | null }>> {
  if (!ids.length) return {};
  try {
    const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids.slice(0, 40).join(",")}`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = (await response.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
    const out: Record<string, { usd: number; change: number | null }> = {};
    for (const id of ids) {
      const row = json?.[id];
      if (typeof row?.usdPrice === "number") {
        out[id] = { usd: row.usdPrice, change: typeof row.priceChange24h === "number" ? row.priceChange24h : null };
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function market(mint: string) {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = (await response.json()) as {
      pairs?: {
        chainId?: string;
        priceUsd?: string;
        priceChange?: { h24?: number };
        liquidity?: { usd?: number };
        volume?: { h24?: number };
        marketCap?: number;
        fdv?: number;
        baseToken?: { symbol?: string; name?: string; address?: string };
      }[];
    };
    const pairs = (json.pairs ?? [])
      .filter((pair) => pair.chainId === "solana" && pair.baseToken?.address === mint)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const pair = pairs[0];
    if (!pair) return null;
    return {
      symbol: pair.baseToken?.symbol ?? null,
      name: pair.baseToken?.name ?? null,
      priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
      changeH24: pair.priceChange?.h24 ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
      volumeH24: pair.volume?.h24 ?? null,
      marketCap: pair.marketCap ?? pair.fdv ?? null,
    };
  } catch {
    return null;
  }
}

async function recentSigs(address: string): Promise<SigRow[]> {
  try {
    const rows = await rpc<
      { signature: string; slot: number; blockTime: number | null; err: unknown }[]
    >("getSignaturesForAddress", [address, { limit: 12, commitment: "confirmed" }]);
    return rows.map((row) => ({
      signature: row.signature,
      slot: row.slot,
      time: row.blockTime,
      ok: !row.err,
    }));
  } catch {
    return [];
  }
}

export async function loadAccount(address: string): Promise<AccountView> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { found: false, address, note: "That does not look like a Solana address." };
  }
  return cached(`acct:${address}`, 15000, async () => {
    const info = await rpc<{
      value: {
        lamports: number;
        owner: string;
        executable: boolean;
        data:
          | { parsed?: { type?: string; info?: Record<string, unknown> }; space?: number; program?: string }
          | [string, string];
      } | null;
    }>("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "confirmed" }]);

    if (!info.value) {
      return { found: false, address, note: "No account at this address on mainnet." };
    }

    const data = info.value.data;
    const parsed = !Array.isArray(data) ? data.parsed : undefined;
    const parsedInfo = parsed?.info ?? {};
    const base = {
      found: true as const,
      address,
      lamports: info.value.lamports,
      ownerProgramId: info.value.owner,
      ownerProgram: programName(info.value.owner) ?? "Program",
      executable: info.value.executable,
      title: programName(address) ?? shortTitle(address),
      symbol: null as string | null,
      name: null as string | null,
      decimals: null as number | null,
      supply: null as string | null,
      mintAuthority: null as string | null,
      freezeAuthority: null as string | null,
      tokenMint: null as string | null,
      tokenOwner: null as string | null,
      tokenAmount: null as string | null,
      priceUsd: null as number | null,
      changeH24: null as number | null,
      liquidityUsd: null as number | null,
      volumeH24: null as number | null,
      marketCap: null as number | null,
      holdings: [] as Holding[],
      holdingsNote: null as string | null,
      holders: [] as HolderRow[],
      signatures: [] as SigRow[],
      portfolioUsd: null as number | null,
    };

    if (parsed?.type === "mint") {
      const decimals = num(parsedInfo.decimals) ?? 0;
      const supplyRaw = str(parsedInfo.supply) ?? "0";
      const quote = await market(address);
      const holders = await loadHolders(address, supplyRaw, decimals);
      return {
        ...base,
        kind: "mint",
        title: quote?.name || quote?.symbol || "Token mint",
        symbol: quote?.symbol ?? knownToken(address)?.symbol ?? null,
        name: quote?.name ?? knownToken(address)?.name ?? null,
        decimals,
        supply: formatUnits(BigInt(supplyRaw), decimals, 4),
        mintAuthority: str(parsedInfo.mintAuthority),
        freezeAuthority: str(parsedInfo.freezeAuthority),
        priceUsd: quote?.priceUsd ?? null,
        changeH24: quote?.changeH24 ?? null,
        liquidityUsd: quote?.liquidityUsd ?? null,
        volumeH24: quote?.volumeH24 ?? null,
        marketCap: quote?.marketCap ?? null,
        holders,
        signatures: await recentSigs(address),
      };
    }

    if (parsed?.type === "account") {
      const mint = str(parsedInfo.mint) ?? "";
      const tokenAmount = rec(parsedInfo.tokenAmount);
      const decimals = num(tokenAmount?.decimals) ?? 0;
      const raw = str(tokenAmount?.amount) ?? "0";
      const known = knownToken(mint);
      return {
        ...base,
        kind: "token",
        title: known?.name ?? "Token account",
        symbol: known?.symbol ?? null,
        tokenMint: mint,
        tokenOwner: str(parsedInfo.owner),
        tokenAmount: formatUnits(BigInt(raw), decimals, 6),
        decimals,
        signatures: await recentSigs(address),
      };
    }

    const [signatures, wallet] = await Promise.all([recentSigs(address), loadWalletTokens(address)]);
    const solPrice = (await jupPrices([SOL_MINT]))[SOL_MINT]?.usd ?? null;
    const solUi = info.value.lamports / 1_000_000_000;
    const portfolio =
      solPrice == null && wallet.holdings.every((holding) => holding.valueUsd == null)
        ? null
        : solUi * (solPrice ?? 0) +
          wallet.holdings.reduce((sum, holding) => sum + (holding.valueUsd ?? 0), 0);
    return {
      ...base,
      kind: "wallet",
      title: programName(address) ?? "Wallet",
      holdings: wallet.holdings,
      holdingsNote: wallet.note,
      signatures,
      priceUsd: solPrice,
      portfolioUsd: portfolio,
    };
  });
}

function shortTitle(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

async function loadHolders(mint: string, supplyRaw: string, decimals: number): Promise<HolderRow[]> {
  try {
    const largest = await rpc<{ value: { address: string; amount: string; decimals: number }[] }>(
      "getTokenLargestAccounts",
      [mint],
    );
    const rows = (largest.value ?? []).slice(0, 8);
    if (!rows.length) return [];
    const accounts = await rpc<{
      value: ({ data?: { parsed?: { info?: { owner?: string } } } } | null)[];
    }>("getMultipleAccounts", [rows.map((row) => row.address), { encoding: "jsonParsed" }]);
    const supply = BigInt(supplyRaw || "0");
    return rows.map((row, index) => {
      const owner = accounts.value?.[index]?.data?.parsed?.info?.owner ?? "";
      const amount = BigInt(row.amount || "0");
      const share = supply > 0n ? Number((amount * 10000n) / supply) / 100 : null;
      return {
        account: row.address,
        owner,
        amount: formatUnits(amount, row.decimals || decimals, 4),
        share,
      };
    });
  } catch {
    return [];
  }
}

async function loadWalletTokens(owner: string): Promise<{ holdings: Holding[]; note: string | null }> {
  const programs = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ];
  const bags: { mint: string; amount: string; decimals: number }[] = [];
  let note: string | null = null;
  for (const programId of programs) {
    try {
      const result = await rpc<{
        value: {
          account: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number } } } } };
        }[];
      }>(
        "getTokenAccountsByOwner",
        [owner, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }],
        8000,
      );
      for (const row of result.value ?? []) {
        const info = row.account.data?.parsed?.info;
        const uiRaw = info?.tokenAmount?.amount ?? "0";
        if (!info?.mint || uiRaw === "0") continue;
        bags.push({
          mint: info.mint,
          amount: uiRaw,
          decimals: info.tokenAmount?.decimals ?? 0,
        });
      }
    } catch {
      note = "Some token accounts could not be listed from the public RPC.";
    }
  }
  bags.sort((a, b) => {
    const delta = BigInt(b.amount) - BigInt(a.amount);
    if (delta > 0n) return 1;
    if (delta < 0n) return -1;
    return 0;
  });
  const top = bags.slice(0, 12);
  const prices = await jupPrices(top.map((row) => row.mint));
  const holdings = top.map((row) => {
    const ui = Number(formatUnits(BigInt(row.amount), row.decimals, 8));
    const known = knownToken(row.mint);
    const px = prices[row.mint]?.usd ?? null;
    return {
      mint: row.mint,
      symbol: known?.symbol ?? `${row.mint.slice(0, 4)}…`,
      amount: formatUnits(BigInt(row.amount), row.decimals, 4),
      ui,
      valueUsd: px == null ? null : ui * px,
    };
  });
  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return { holdings, note };
}

export type TrendingToken = {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  changeH24: number | null;
  liquidityUsd: number | null;
  volumeH24: number | null;
};

export async function loadTrending(): Promise<TrendingToken[]> {
  return cached("trending", 60000, async () => {
    const boosts = (await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(8000),
    }).then((response) => response.json())) as { chainId?: string; tokenAddress?: string }[];
    const addresses = (Array.isArray(boosts) ? boosts : [])
      .filter((row) => row.chainId === "solana" && row.tokenAddress)
      .map((row) => row.tokenAddress as string)
      .slice(0, 8);
    if (!addresses.length) return [];
    const pairs = (await fetch(`https://api.dexscreener.com/tokens/v1/solana/${addresses.join(",")}`, {
      signal: AbortSignal.timeout(8000),
    }).then((response) => response.json())) as {
      baseToken?: { address?: string; symbol?: string; name?: string };
      priceUsd?: string;
      priceChange?: { h24?: number };
      liquidity?: { usd?: number };
      volume?: { h24?: number };
    }[];
    const best = new Map<string, TrendingToken>();
    for (const pair of Array.isArray(pairs) ? pairs : []) {
      const address = pair.baseToken?.address;
      if (!address) continue;
      const liquidityUsd = pair.liquidity?.usd ?? 0;
      const prev = best.get(address);
      if (prev && (prev.liquidityUsd ?? 0) > liquidityUsd) continue;
      best.set(address, {
        address,
        symbol: pair.baseToken?.symbol || "—",
        name: pair.baseToken?.name || "Token",
        priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
        changeH24: pair.priceChange?.h24 ?? null,
        liquidityUsd,
        volumeH24: pair.volume?.h24 ?? null,
      });
    }
    return addresses.map((address) => best.get(address)).filter((row): row is TrendingToken => Boolean(row));
  });
}

export type QuoteView = {
  input: { symbol: string; mint: string; decimals: number; amount: string; amountRaw: string };
  output: { symbol: string; mint: string; decimals: number; amount: string; amountRaw: string; minAmount: string };
  priceImpactPct: number | null;
  swapUsdValue: number | null;
  contextSlot: number | null;
  slippageBps: number;
  route: { percent: number; label: string; amm: string }[];
  candidates: { dex: string; amount: string; amountRaw: string; labels: string[] }[];
};

const CANDIDATE_DEXES = ["Whirlpool", "Raydium", "Meteora", "Phoenix"];

async function resolveToken(input: string): Promise<TokenInfo> {
  const known = TOKENS.find(
    (token) => token.symbol.toLowerCase() === input.toLowerCase() || token.mint === input,
  );
  if (known) return known;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) {
    throw new Error("Unknown token. Use a symbol such as SOL or USDC, or paste a mint.");
  }
  return cached(`mintmeta:${input}`, 600000, async () => {
    const info = await rpc<{
      value: { data?: { parsed?: { type?: string; info?: { decimals?: number } } } } | null;
    }>("getAccountInfo", [input, { encoding: "jsonParsed" }]);
    const decimals = info.value?.data?.parsed?.info?.decimals;
    if (info.value?.data?.parsed?.type !== "mint" || typeof decimals !== "number") {
      throw new Error("That mint could not be read.");
    }
    const quote = await market(input);
    return {
      symbol: quote?.symbol || `${input.slice(0, 4)}…`,
      name: quote?.name || "Token",
      mint: input,
      decimals,
    };
  });
}

type JupQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  swapUsdValue?: string;
  contextSlot?: number;
  routePlan?: {
    percent?: number;
    swapInfo?: { label?: string; ammKey?: string };
  }[];
  error?: string;
};

async function jupQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number,
  dex?: string,
): Promise<JupQuote | null> {
  const url = new URL("https://lite-api.jup.ag/swap/v1/quote");
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount);
  url.searchParams.set("slippageBps", String(slippageBps));
  if (dex) url.searchParams.set("dexes", dex);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const json = (await response.json()) as JupQuote;
  if (!response.ok || json.error || !json.outAmount) return null;
  return json;
}

function presentQuote(
  quote: JupQuote,
  input: TokenInfo,
  output: TokenInfo,
  amountRaw: string,
  slippageBps: number,
  candidates: QuoteView["candidates"],
): QuoteView {
  const impact = quote.priceImpactPct ? Number(quote.priceImpactPct) * 100 : null;
  return {
    input: {
      symbol: input.symbol,
      mint: input.mint,
      decimals: input.decimals,
      amount: formatUnits(BigInt(amountRaw), input.decimals, 6),
      amountRaw,
    },
    output: {
      symbol: output.symbol,
      mint: output.mint,
      decimals: output.decimals,
      amount: formatUnits(BigInt(quote.outAmount), output.decimals, 6),
      amountRaw: quote.outAmount,
      minAmount: formatUnits(BigInt(quote.otherAmountThreshold || quote.outAmount), output.decimals, 6),
    },
    priceImpactPct: impact != null && Number.isFinite(impact) ? impact : null,
    swapUsdValue: quote.swapUsdValue ? Number(quote.swapUsdValue) : null,
    contextSlot: quote.contextSlot ?? null,
    slippageBps,
    route: (quote.routePlan ?? []).map((step) => ({
      percent: step.percent ?? 100,
      label: step.swapInfo?.label || "Pool",
      amm: step.swapInfo?.ammKey || "",
    })),
    candidates,
  };
}

export async function loadQuote(args: {
  input: string;
  output: string;
  amount: string;
  slippageBps: number;
}): Promise<QuoteView> {
  const slippageBps = Math.min(5000, Math.max(1, Math.round(args.slippageBps || 50)));
  const [input, output] = await Promise.all([resolveToken(args.input), resolveToken(args.output)]);
  if (input.mint === output.mint) throw new Error("Choose two different tokens.");
  const amountRaw = toBaseUnits(args.amount, input.decimals);
  const key = `q:${input.mint}:${output.mint}:${amountRaw}:${slippageBps}`;
  return cached(key, 6000, async () => {
    const [best, ...rest] = await Promise.all([
      jupQuote(input.mint, output.mint, amountRaw, slippageBps),
      ...CANDIDATE_DEXES.map((dex) =>
        jupQuote(input.mint, output.mint, amountRaw, slippageBps, dex).catch(() => null),
      ),
    ]);
    if (!best) throw new Error("No route for that pair and size.");
    const candidates = CANDIDATE_DEXES.map((dex, index) => {
      const row = rest[index];
      if (!row) return null;
      return {
        dex,
        amount: formatUnits(BigInt(row.outAmount), output.decimals, 6),
        amountRaw: row.outAmount,
        labels: (row.routePlan ?? []).map((step) => step.swapInfo?.label || dex),
      };
    }).filter((row): row is QuoteView["candidates"][number] => row !== null);
    candidates.sort((a, b) => (BigInt(b.amountRaw) > BigInt(a.amountRaw) ? 1 : -1));
    return presentQuote(best, input, output, amountRaw, slippageBps, candidates);
  });
}

export async function buildSwap(args: {
  input: string;
  output: string;
  amount: string;
  slippageBps: number;
  userPublicKey: string;
}): Promise<{ swapTransaction: string; lastValidBlockHeight: number | null; quote: QuoteView }> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(args.userPublicKey)) {
    throw new Error("Paste the wallet that will sign. T3X never broadcasts.");
  }
  const slippageBps = Math.min(5000, Math.max(1, Math.round(args.slippageBps || 50)));
  const [input, output] = await Promise.all([resolveToken(args.input), resolveToken(args.output)]);
  const amountRaw = toBaseUnits(args.amount, input.decimals);
  const raw = await jupQuote(input.mint, output.mint, amountRaw, slippageBps);
  if (!raw) throw new Error("No route for that pair and size.");
  const response = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse: raw,
      userPublicKey: args.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const json = (await response.json()) as {
    swapTransaction?: string;
    lastValidBlockHeight?: number;
    error?: string;
  };
  if (!response.ok || !json.swapTransaction) {
    throw new Error(json.error || "Could not build the unsigned transaction.");
  }
  const quote = presentQuote(raw, input, output, amountRaw, slippageBps, []);
  return {
    swapTransaction: json.swapTransaction,
    lastValidBlockHeight: json.lastValidBlockHeight ?? null,
    quote,
  };
}
