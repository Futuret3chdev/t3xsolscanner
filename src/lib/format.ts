export function shortAddr(value: string, size = 4): string {
  if (!value) return "—";
  if (value.length <= size * 2 + 1) return value;
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export function slotFmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.trunc(n).toLocaleString("en-US");
}

export function ago(unix: number | null | undefined): string {
  if (!unix) return "—";
  const delta = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export function clock(unix: number | null | undefined): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function usd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) {
    return `${value < 0 ? "-" : ""}$${abs.toPrecision(2)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: abs >= 1000 ? 0 : digits,
  }).format(value);
}

export function compact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function lamportsToSol(lamports: number): string {
  const sign = lamports < 0 ? "-" : "";
  const abs = Math.abs(lamports) / 1_000_000_000;
  if (abs === 0) return "0";
  if (abs < 0.000001) return `${sign}${abs.toExponential(2)}`;
  return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
}

export function formatUnits(raw: bigint, decimals: number, maxFrac = 6): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(Math.max(0, decimals));
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFrac)
    .replace(/0+$/, "");
  const body = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function toBaseUnits(amount: string, decimals: number): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a positive amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Too many decimals for this token (max ${decimals})`);
  }
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
  if (raw <= 0n) throw new Error("Amount must be greater than zero");
  return raw.toString();
}
