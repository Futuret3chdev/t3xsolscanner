import { createServerFn } from "@tanstack/react-start";
import mysql from "mysql2/promise";

const AUTH = "https://auth.futuret3ch.com.au";
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

type Fill = {
  id: string;
  tx: string;
  chain: string;
  kind: string;
  symbol: string;
  amount: string;
  address: string;
  usd: number;
  created_at: string;
};
type Wallet = { address: string; kind: string };
type Claim = { id: string; units: number; status: string; created_at: string };
type Ledger = { fills: Fill[]; wallets: Wallet[]; claims: Claim[] };

const emptyLedger = (): Ledger => ({ fills: [], wallets: [], claims: [] });

async function authJson(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  const response = await fetch(`${AUTH}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(12000),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Account server rejected that.");
  }
  return body;
}

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

function asLedger(raw: unknown): Ledger {
  if (!raw || typeof raw !== "object") return emptyLedger();
  const row = raw as Partial<Ledger>;
  return {
    fills: Array.isArray(row.fills) ? row.fills : [],
    wallets: Array.isArray(row.wallets) ? row.wallets : [],
    claims: Array.isArray(row.claims) ? row.claims : [],
  };
}

let pool: mysql.Pool | null = null;

function db() {
  const host = process.env.HG_MYSQL_HOST;
  const user = process.env.HG_MYSQL_USER;
  const password = process.env.HG_MYSQL_PASSWORD;
  const database = process.env.HG_MYSQL_DATABASE;
  if (!host || !user || !password || !database) throw new Error("Claim database is not configured.");
  pool ??= mysql.createPool({
    host,
    user,
    password,
    database,
    connectionLimit: 2,
    connectTimeout: 10000,
    waitForConnections: true,
  });
  return pool;
}

async function accountId(token: string): Promise<string> {
  const me = await authJson("/me", { method: "GET", token });
  const id = typeof me.id === "string" ? me.id : "";
  if (!id) throw new Error("Sign in again.");
  return id;
}

async function readLedger(token: string): Promise<Ledger> {
  const userId = await accountId(token);
  const conn = db();
  const [fills] = await conn.query(
    "SELECT id, tx, chain, kind, symbol, amount, address, usd, created_at FROM t3x_fills WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  );
  const [wallets] = await conn.query("SELECT address, kind FROM t3x_wallets WHERE user_id = ?", [userId]);
  const [claims] = await conn.query("SELECT id, units, status, created_at FROM t3x_claims WHERE user_id = ? ORDER BY created_at ASC", [userId]);
  return asLedger({ fills, wallets, claims });
}

async function writeLedger(token: string, ledger: Ledger) {
  const userId = await accountId(token);
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM t3x_fills WHERE user_id = ?", [userId]);
    await conn.query("DELETE FROM t3x_wallets WHERE user_id = ?", [userId]);
    await conn.query("DELETE FROM t3x_claims WHERE user_id = ?", [userId]);
    for (const row of ledger.fills) {
      await conn.query(
        "INSERT INTO t3x_fills (id, user_id, tx, chain, kind, symbol, amount, address, usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [row.id, userId, row.tx, row.chain, row.kind, row.symbol, row.amount, row.address, row.usd, row.created_at],
      );
    }
    for (const row of ledger.wallets) {
      await conn.query("INSERT INTO t3x_wallets (user_id, address, kind) VALUES (?, ?, ?)", [userId, row.address, row.kind]);
    }
    for (const row of ledger.claims) {
      await conn.query("INSERT INTO t3x_claims (id, user_id, units, status, created_at) VALUES (?, ?, ?, ?, ?)", [
        row.id,
        userId,
        row.units,
        row.status,
        row.created_at,
      ]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function viewOf(ledger: Ledger) {
  const total = ledger.fills.reduce((sum, row) => sum + Number(row.usd || 0), 0);
  const earned = Math.floor(total / UNIT);
  const claimed = ledger.claims.reduce((sum, row) => sum + Number(row.units || 0), 0);
  return {
    total,
    earned,
    claimed,
    ready: Math.max(0, earned - claimed),
    toward: total % UNIT,
    fills: ledger.fills.slice().reverse().slice(0, 40),
    wallets: ledger.wallets,
    claims: ledger.claims.slice().reverse().slice(0, 20),
  };
}

function tokenOf(value: unknown): string {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return String(row.token ?? "").trim();
}

export const registerAccount = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      email: String(row.email ?? "").trim().toLowerCase(),
      phone: String(row.phone ?? "").trim(),
      password: String(row.password ?? ""),
    };
  })
  .handler(async ({ data }) => {
    if (!data.email || !data.phone || data.password.length < 8) {
      return { ok: false as const, error: "Email, phone, and a password of at least 8 characters are required." };
    }
    const signup = await authJson("/signup", {
      method: "POST",
      body: JSON.stringify({ email: data.email, phone: data.phone, password: data.password }),
    });
    const code = typeof signup.demoVerificationCode === "string" ? signup.demoVerificationCode : "";
    if (!code) return { ok: false as const, error: "Account was created but could not be verified." };
    const verified = await authJson("/verify", {
      method: "POST",
      body: JSON.stringify({ email: data.email, code }),
    });
    const user = verified.user as { id?: string; email?: string; phone?: string } | undefined;
    const token = typeof verified.token === "string" ? verified.token : "";
    if (!token || !user?.id) return { ok: false as const, error: "Account was created but sign-in did not start." };
    return { ok: true as const, token, user: { id: user.id, email: user.email || data.email, phone: user.phone || data.phone } };
  });

export const loginAccount = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return { email: String(row.email ?? "").trim(), password: String(row.password ?? "") };
  })
  .handler(async ({ data }) => {
    if (!data.email || !data.password) return { ok: false as const, error: "Email and password are required." };
    const body = await authJson("/login", {
      method: "POST",
      body: JSON.stringify({ emailOrPhone: data.email, password: data.password }),
    });
    const user = body.user as { id?: string; email?: string; phone?: string } | undefined;
    const token = typeof body.token === "string" ? body.token : "";
    if (!token || !user?.id) return { ok: false as const, error: "Sign-in did not return an account." };
    return { ok: true as const, token, user: { id: user.id, email: user.email || data.email, phone: user.phone || "" } };
  });

export const loadRemoteClaim = createServerFn({ method: "POST" })
  .validator((value: unknown) => ({ token: tokenOf(value) }))
  .handler(async ({ data }) => {
    if (!data.token) throw new Error("Sign in first.");
    return viewOf(await readLedger(data.token));
  });

export const recordRemoteFill = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      token: String(row.token ?? "").trim(),
      tx: String(row.tx ?? "").trim().slice(0, 120),
      chain: String(row.chain ?? "").trim().slice(0, 32),
      kind: String(row.kind ?? "swap").trim().slice(0, 16),
      symbol: String(row.symbol ?? "").trim().slice(0, 16),
      amount: String(row.amount ?? "").trim().slice(0, 40),
      address: String(row.address ?? "").trim().slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const, error: "Sign in so this transfer counts toward T3X." };
    const qty = Number(data.amount);
    if (!data.tx || !Number.isFinite(qty) || qty <= 0) return { ok: false as const, error: "Amount is not valid." };
    const unit = await priceUsd(data.symbol);
    if (unit == null) return { ok: false as const, error: "Could not price this transfer, so it was not counted." };
    const ledger = await readLedger(data.token);
    if (ledger.fills.some((row) => row.tx === data.tx)) return { ok: true as const, usd: unit * qty };
    ledger.fills.push({
      id: data.tx,
      tx: data.tx,
      chain: data.chain,
      kind: data.kind,
      symbol: data.symbol,
      amount: data.amount,
      address: data.address,
      usd: qty * unit,
      created_at: new Date().toISOString(),
    });
    if (data.address && !ledger.wallets.some((row) => row.address === data.address)) {
      ledger.wallets.push({ address: data.address, kind: data.address.startsWith("0x") ? "evm" : "solana" });
    }
    await writeLedger(data.token, ledger);
    return { ok: true as const, usd: qty * unit };
  });

export const linkRemoteWallet = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      token: String(row.token ?? "").trim(),
      address: String(row.address ?? "").trim().slice(0, 80),
      kind: String(row.kind ?? "").trim().slice(0, 16),
    };
  })
  .handler(async ({ data }) => {
    if (!data.token || !data.address) return { ok: false as const };
    const ledger = await readLedger(data.token);
    if (!ledger.wallets.some((row) => row.address === data.address)) {
      ledger.wallets.push({ address: data.address, kind: data.kind === "evm" || data.address.startsWith("0x") ? "evm" : "solana" });
      await writeLedger(data.token, ledger);
    }
    return { ok: true as const };
  });

export const claimRemoteUnits = createServerFn({ method: "POST" })
  .validator((value: unknown) => ({ token: tokenOf(value) }))
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const, error: "Sign in first." };
    const ledger = await readLedger(data.token);
    const view = viewOf(ledger);
    if (view.ready < 1) return { ok: false as const, error: "You need another full $20 before the next T3X claim." };
    ledger.claims.push({
      id: `${Date.now()}`,
      units: view.ready,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    await writeLedger(data.token, ledger);
    return { ok: true as const, units: view.ready };
  });
