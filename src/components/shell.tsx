import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { classifyQuery } from "@/lib/labels";

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 5.1 25.7 10.7v10.6L16 26.9 6.3 21.3V10.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="9.6" y="14.7" width="12.8" height="2.6" rx="0.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.35" className="fill-bg" />
    </svg>
  );
}

function NavLinks() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const items = [
    { to: "/", label: "Explorer" },
    { to: "/router", label: "Router" },
    { to: "/docs", label: "API" },
  ] as const;
  return (
    <>
      {items.map((item) => {
        const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-surface text-fg" : "text-muted hover:text-fg"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function SearchForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = classifyQuery(query);
    if (result.kind === "slot") navigate({ to: "/block/$slot", params: { slot: result.value } });
    else if (result.kind === "tx") navigate({ to: "/tx/$sig", params: { sig: result.value } });
    else if (result.kind === "address") navigate({ to: "/address/$address", params: { address: result.value } });
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-1 gap-2">
      <label className="sr-only" htmlFor={autoFocus ? "scan-main" : "scan-nav"}>
        Scan a wallet, mint, signature, or slot
      </label>
      <input
        id={autoFocus ? "scan-main" : "scan-nav"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Wallet, mint, signature, or slot"
        autoFocus={autoFocus}
        spellCheck={false}
        className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-sm text-fg outline-none placeholder:font-sans placeholder:text-muted focus-visible:border-accent"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-bg"
      >
        Scan
      </button>
    </form>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Mark className="size-8 text-accent" />
              <span className="text-base font-semibold tracking-tight">T3X</span>
              <span className="hidden text-sm text-muted sm:inline">Sol Scanner</span>
            </Link>
            <nav className="flex items-center md:hidden">
              <NavLinks />
            </nav>
          </div>
          <SearchForm />
          <nav className="hidden items-center md:flex">
            <NavLinks />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-8 w-full max-w-6xl px-4 py-8 text-sm text-muted">
        <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>T3X Sol Scanner · Futuret3ch</p>
          <p className="max-w-xl text-pretty">
            Mainnet reads use public Solana RPC. Swap routes are quoted by Jupiter. Nothing is signed or sent
            unless you copy a transaction into your own wallet.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function ScanBand() {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 md:p-6">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">Scanner</p>
      <h2 className="mt-2 max-w-xl text-2xl font-semibold text-balance">
        Paste a wallet, mint, signature, or slot.
      </h2>
      <p className="mt-2 max-w-xl text-sm text-pretty text-muted">
        Authorities, top holders, balances, and the transactions inside a block — read from Solana mainnet.
      </p>
      <div className="mt-4">
        <SearchForm autoFocus />
      </div>
    </section>
  );
}
