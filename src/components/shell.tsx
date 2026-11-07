import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { classifyQuery, parseChain, chainMeta, type ChainMeta } from "@/lib/chains";
import { ConnectButton } from "@/components/connect";
import { MemoryTracker } from "@/components/extras";
import { WalletProvider } from "@/lib/wallet";
import { useAccount, writeAccount } from "@/lib/account-client";

function NavLinks() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const items = [
    { to: "/", label: "Explorer" },
    { to: "/router", label: "Router" },
    { to: "/claim", label: "Claim" },
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
            className={`whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium sm:px-3 ${active ? "bg-surface text-fg" : "text-muted hover:text-fg"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function useActiveChain(): ChainMeta {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search });
  const fromPath = pathname.match(/^\/c\/([^/]+)/);
  if (fromPath?.[1]) return chainMeta(parseChain(decodeURIComponent(fromPath[1])));
  if (search && typeof search === "object" && "chain" in search) {
    return chainMeta(parseChain((search as { chain?: unknown }).chain));
  }
  return chainMeta("solana");
}

function SearchForm() {
  const navigate = useNavigate();
  const chain = useActiveChain();
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = classifyQuery(query, chain.id);
    if (result.kind === "home") return;
    if (result.kind === "invalid") {
      setError(result.message);
      return;
    }
    setError("");
    if (chain.kind === "solana") {
      if (result.kind === "block") navigate({ to: "/block/$slot", params: { slot: result.value } });
      else if (result.kind === "tx") navigate({ to: "/tx/$sig", params: { sig: result.value } });
      else navigate({ to: "/address/$address", params: { address: result.value } });
      return;
    }
    if (result.kind === "block") navigate({ to: "/c/$chain/block/$id", params: { chain: chain.id, id: result.value } });
    else if (result.kind === "tx") navigate({ to: "/c/$chain/tx/$hash", params: { chain: chain.id, hash: result.value } });
    else navigate({ to: "/c/$chain/address/$address", params: { chain: chain.id, address: result.value } });
  }

  const placeholder =
    chain.kind === "evm" ? `${chain.name} address, hash, or block` : "Wallet, mint, signature, or slot";

  return (
    <div className="relative min-w-0 flex-1">
      <form onSubmit={onSubmit} className="flex min-w-0 gap-2">
        <label className="sr-only" htmlFor={fieldId}>
          {placeholder}
        </label>
        <input
          id={fieldId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError("");
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="search"
          aria-invalid={error ? true : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-base text-fg outline-none placeholder:font-sans placeholder:text-muted focus-visible:border-accent md:text-sm"
        />
        <button type="submit" className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-bg">
          Scan
        </button>
      </form>
      {error ? (
        <p className="absolute top-full left-0 z-30 mt-1 max-w-full truncate text-xs text-down">{error}</p>
      ) : null}
    </div>
  );
}

function AuthSlot() {
  const account = useAccount();
  if (!account) {
    return (
      <Link to="/login" search={{ next: "/claim" }} className="inline-flex h-9 items-center rounded-lg px-2 text-xs font-semibold text-fg">
        Sign in
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => writeAccount(null)} className="inline-flex h-9 max-w-28 items-center truncate rounded-lg px-2 text-xs font-semibold text-fg">
      {account.email.split("@")[0]}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
    <div className="min-h-screen bg-bg text-fg">
      <MemoryTracker />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="flex h-10 shrink-0 items-center justify-between gap-2">
            <Link to="/" search={{ chain: "solana" }} className="flex items-center gap-2">
              <img src="/logo.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-full object-cover" />
              <span className="text-base font-semibold tracking-tight">T3X</span>
              <span className="hidden text-sm text-muted sm:inline">Scanner</span>
            </Link>
            <div className="flex items-center gap-2">
              <AuthSlot />
              <ConnectButton />
            </div>
          </div>
          <nav className="chain-row -mx-4 flex h-10 items-center gap-1 overflow-x-auto px-4 md:hidden">
            <NavLinks />
          </nav>
          <SearchForm />
          <nav className="hidden shrink-0 items-center md:flex">
            <NavLinks />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto mt-8 w-full max-w-6xl px-4 py-8 text-sm text-muted">
        <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>T3X Scanner · Futuret3ch</p>
          <a href="/how.mp4?v=1" className="text-fg" download>
            How airdrops work
          </a>
          <p className="max-w-xl text-pretty">
            Solana plus 24 EVM networks. Swap quotes are Jupiter on Solana and LI.FI elsewhere. Bridges are sent only
            after your own wallet approves them.
          </p>
        </div>
      </footer>
    </div>
    </WalletProvider>
  );
}

export function ScanBand() {
  const chain = useActiveChain();
  return (
    <section className="rounded-xl border border-line bg-surface p-4 md:p-6">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">Scanner</p>
      <h2 className="mt-2 max-w-xl text-xl font-semibold text-balance sm:text-2xl">
        {chain.kind === "evm"
          ? `Paste a ${chain.name} address, hash, or block.`
          : "Paste a wallet, mint, signature, or slot."}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-pretty text-muted">
        {chain.kind === "evm"
          ? "Native balance, contract check, and the transactions inside a block."
          : "Authorities, top holders, balances, and the transactions inside a block."}
      </p>
      <div className="mt-4">
        <SearchForm />
      </div>
    </section>
  );
}
