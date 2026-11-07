import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { programName } from "@/lib/labels";
import { shortAddr } from "@/lib/format";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Pending({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function Addr({
  address,
  to,
  className = "",
}: {
  address: string;
  to?: "address" | "tx";
  className?: string;
}) {
  const label = programName(address) ?? shortAddr(address);
  const cls = `font-mono text-sm text-fg underline-offset-4 hover:text-accent hover:underline ${className}`;
  if (!address) return <span className="text-muted">—</span>;
  if (to === "tx") {
    return (
      <Link to="/tx/$sig" params={{ sig: address }} className={cls}>
        {shortAddr(address, 6)}
      </Link>
    );
  }
  return (
    <Link to="/address/$address" params={{ address }} className={cls} title={address}>
      {label}
    </Link>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-xs font-medium text-muted hover:text-fg"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function Delta({ value }: { value: string }) {
  const negative = value.trim().startsWith("-");
  const positive = value !== "0" && !negative;
  return (
    <span className={negative ? "text-down" : positive ? "text-up" : "text-muted"}>
      {positive ? `+${value}` : value}
    </span>
  );
}

export function Change({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-muted">—</span>;
  const text = `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  return <span className={value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted"}>{text}</span>;
}
