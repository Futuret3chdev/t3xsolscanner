import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

const UNIT = 20;

const GECKO: Record<string, string> = {
  SOL: "solana",
  ETH: "ethereum",
  BNB: "binancecoin",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  XDAI: "dai",
  MNT: "mantle",
  CELO: "celo",
  S: "sonic-3",
  BERA: "berachain-bera",
  FRXETH: "frax-ether",
  SEI: "sei-network",
  CRO: "crypto-com-chain",
};

const prices = new Map<string, { at: number; usd: number }>();

async function priceUsd(symbol: string): Promise<number | null> {
  const key = symbol.toUpperCase();
  if (key === "USDC" || key === "USDT" || key === "USD") return 1;
  const id = GECKO[key];
  if (!id) return null;
  const hit = prices.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.usd;
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return hit?.usd ?? null;
    const body = (await response.json()) as Record<string, { usd?: number }>;
    const usd = body[id]?.usd;
    if (typeof usd !== "number") return hit?.usd ?? null;
    prices.set(id, { at: Date.now(), usd });
    return usd;
  } catch {
    return hit?.usd ?? null;
  }
}

type FillInput = {
  tx: string;
  chain: string;
  kind: string;
  symbol: string;
  amount: string;
  address: string;
};

function fillInput(value: unknown): FillInput {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    tx: String(row.tx ?? "").trim().slice(0, 120),
    chain: String(row.chain ?? "").trim().slice(0, 32),
    kind: String(row.kind ?? "swap").trim().slice(0, 16),
    symbol: String(row.symbol ?? "").trim().slice(0, 16),
    amount: String(row.amount ?? "").trim().slice(0, 40),
    address: String(row.address ?? "").trim().slice(0, 80),
  };
}

export const recordFill = createServerFn({ method: "POST" })
  .validator(fillInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.tx || !data.chain || !data.symbol || !data.amount) {
      return { ok: false as const, error: "Missing transaction details." };
    }
    const qty = Number(data.amount);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false as const, error: "Amount is not valid." };
    const unit = await priceUsd(data.symbol);
    if (unit == null) return { ok: false as const, error: "Could not price this transfer, so it was not counted." };
    const usd = qty * unit;
    const sql = await getSql();
    await sql`
      insert into airdrop_fills (user_id, tx_hash, chain, kind, symbol, amount, address, usd)
      values (${context.userId}, ${data.tx}, ${data.chain}, ${data.kind}, ${data.symbol}, ${data.amount}, ${data.address}, ${usd})
      on conflict (user_id, tx_hash) do nothing
    `;
    if (data.address) {
      const kind = data.address.startsWith("0x") ? "evm" : "solana";
      await sql`
        insert into airdrop_wallets (user_id, address, kind)
        values (${context.userId}, ${data.address}, ${kind})
        on conflict (user_id, address) do nothing
      `;
    }
    return { ok: true as const, usd };
  });

export const linkWallet = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      address: String(row.address ?? "").trim().slice(0, 80),
      kind: String(row.kind ?? "").trim().slice(0, 16),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.address) return { ok: false as const };
    const kind = data.kind === "solana" || data.address.startsWith("0x") === false ? (data.kind === "evm" ? "evm" : "solana") : "evm";
    const sql = await getSql();
    await sql`
      insert into airdrop_wallets (user_id, address, kind)
      values (${context.userId}, ${data.address}, ${kind})
      on conflict (user_id, address) do nothing
    `;
    return { ok: true as const };
  });

type FillRow = { id: number; tx_hash: string; chain: string; kind: string; symbol: string; amount: string; usd: string; created_at: string };
type WalletRow = { address: string; kind: string };
type ClaimRow = { id: number; units: number; status: string; created_at: string };

export const loadClaim = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const fills = await sql<FillRow>`
      select id, tx_hash, chain, kind, symbol, amount, usd::text as usd, created_at::text as created_at
      from airdrop_fills where user_id = ${context.userId} order by id desc limit 40
    `;
    const wallets = await sql<WalletRow>`
      select address, kind from airdrop_wallets where user_id = ${context.userId} order by created_at
    `;
    const claims = await sql<ClaimRow>`
      select id, units, status, created_at::text as created_at
      from airdrop_claims where user_id = ${context.userId} order by id desc limit 20
    `;
    const total = fills.reduce((sum, row) => sum + Number(row.usd || 0), 0);
    const earned = Math.floor(total / UNIT);
    const claimed = claims.reduce((sum, row) => sum + Number(row.units || 0), 0);
    return {
      total,
      earned,
      claimed,
      ready: Math.max(0, earned - claimed),
      toward: total % UNIT,
      fills,
      wallets,
      claims,
    };
  });

export const claimUnits = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const totals = await sql<{ usd: string }>`select coalesce(sum(usd), 0)::text as usd from airdrop_fills where user_id = ${context.userId}`;
    const claimedRows = await sql<{ units: number }>`select coalesce(sum(units), 0) as units from airdrop_claims where user_id = ${context.userId}`;
    const earned = Math.floor(Number(totals[0]?.usd ?? 0) / UNIT);
    const claimed = Number(claimedRows[0]?.units ?? 0);
    const ready = earned - claimed;
    if (ready < 1) return { ok: false as const, error: "You need another full $20 before the next T3X claim." };
    await sql`insert into airdrop_claims (user_id, units, status) values (${context.userId}, ${ready}, 'pending')`;
    return { ok: true as const, units: ready };
  });
