import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { chainMeta, parseChain, type ChainId } from "@/lib/chains";
import { shortAddr } from "@/lib/format";
import { isWatched, pushRecent, readRecent, readWatch, toggleWatch, type ScanItem, type ScanKind } from "@/lib/memory";
import { addressName } from "@/lib/names";

function scanFromPath(pathname: string): Omit<ScanItem, "at"> | null {
  const evm = pathname.match(/^\/c\/([^/]+)\/(address|tx|block)\/([^/]+)/);
  if (evm?.[1] && evm[2] && evm[3]) {
    const chain = parseChain(decodeURIComponent(evm[1]));
    const kind = evm[2] === "tx" ? "tx" : evm[2] === "block" ? "block" : "address";
    const id = decodeURIComponent(evm[3]);
    const meta = chainMeta(chain);
    const name = kind === "address" ? addressName(id) : null;
    return {
      chain,
      kind,
      id,
      label: name ? `${meta.name} · ${name}` : `${meta.name} ${kind} ${shortAddr(id, 4)}`,
    };
  }
  const sol = pathname.match(/^\/(address|tx|block)\/([^/]+)/);
  if (sol?.[1] && sol[2]) {
    const kind = sol[1] === "tx" ? "tx" : sol[1] === "block" ? "block" : "address";
    const id = decodeURIComponent(sol[2]);
    const name = kind === "address" ? addressName(id) : null;
    return { chain: "solana", kind, id, label: name ? `Solana · ${name}` : `Solana ${kind} ${shortAddr(id, 4)}` };
  }
  return null;
}

export function MemoryTracker() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const item = scanFromPath(pathname);
    if (item) pushRecent(item);
  }, [pathname]);
  return null;
}

function ScanLink({ item }: { item: ScanItem }) {
  const className = "inline-flex h-9 max-w-full shrink-0 items-center truncate rounded-full border border-line bg-surface px-3 text-sm";
  if (item.chain === "solana") {
    if (item.kind === "block") {
      return (
        <Link to="/block/$slot" params={{ slot: item.id }} className={className}>
          {item.label}
        </Link>
      );
    }
    if (item.kind === "tx") {
      return (
        <Link to="/tx/$sig" params={{ sig: item.id }} className={className}>
          {item.label}
        </Link>
      );
    }
    return (
      <Link to="/address/$address" params={{ address: item.id }} className={className}>
        {item.label}
      </Link>
    );
  }
  const chain = item.chain;
  if (item.kind === "block") {
    return (
      <Link to="/c/$chain/block/$id" params={{ chain, id: item.id }} className={className}>
        {item.label}
      </Link>
    );
  }
  if (item.kind === "tx") {
    return (
      <Link to="/c/$chain/tx/$hash" params={{ chain, hash: item.id }} className={className}>
        {item.label}
      </Link>
    );
  }
  return (
    <Link to="/c/$chain/address/$address" params={{ chain, address: item.id }} className={className}>
      {item.label}
    </Link>
  );
}

function Row({ title, items }: { title: string; items: ScanItem[] }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{title}</p>
      <div className="chain-row mt-2 flex gap-2 overflow-x-auto">
        {items.map((item) => (
          <ScanLink key={`${item.chain}:${item.kind}:${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function SavedScans() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [recent, setRecent] = useState<ScanItem[] | null>(null);
  const [watch, setWatch] = useState<ScanItem[] | null>(null);
  useEffect(() => {
    setRecent(readRecent());
    setWatch(readWatch());
  }, [pathname]);
  if (!recent?.length && !watch?.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <Row title="Watching" items={watch ?? []} />
      <Row title="Recent" items={recent ?? []} />
    </section>
  );
}

export function WatchButton({
  chain,
  kind,
  id,
  label,
}: {
  chain: string;
  kind: ScanKind;
  id: string;
  label: string;
}) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setOn(isWatched({ chain, kind, id }));
    setReady(true);
  }, [chain, kind, id]);
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => setOn(toggleWatch({ chain, kind, id, label }))}
      className={`inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium ${on ? "border-accent text-accent" : "border-line text-muted"}`}
    >
      {on ? "Watching" : "Watch"}
    </button>
  );
}

type GasRow = { chain: ChainId; name: string; gas: string | null };

export function GasBoard() {
  const [rows, setRows] = useState<GasRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void fetch("/api/gas")
        .then((response) => response.json())
        .then((body: GasRow[]) => {
          if (alive && Array.isArray(body)) setRows(body);
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return (
    <div className="h-10">
      <div className="chain-row flex h-10 items-center gap-2 overflow-x-auto">
        {(rows ?? []).map((row) => (
          <Link
            key={row.chain}
            to="/"
            search={{ chain: row.chain }}
            className="inline-flex h-9 w-36 shrink-0 items-center justify-between rounded-full border border-line bg-surface px-3 text-xs"
          >
            <span className="truncate text-muted">{row.name}</span>
            <span className="font-mono tabular-nums">{row.gas ?? "—"}</span>
          </Link>
        ))}
        {!rows ? <span className="text-xs text-muted">Loading gas across chains…</span> : null}
      </div>
    </div>
  );
}

type BalanceRow = { chain: ChainId; name: string; symbol: string; balance: string | null };

export function ChainBalances({ address, current }: { address: string; current: ChainId }) {
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch(`/api/balances?address=${address}`)
      .then((response) => response.json())
      .then((body: BalanceRow[]) => {
        if (alive && Array.isArray(body)) setRows(body);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [address]);
  const ordered = (rows ?? []).slice().sort((a, b) => {
    const av = a.balance && a.balance !== "0" ? 1 : 0;
    const bv = b.balance && b.balance !== "0" ? 1 : 0;
    return bv - av;
  });
  const shown = ordered.filter((row) => row.balance && row.balance !== "0");
  const hidden = ordered.length - shown.length;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Same address, every EVM chain</h2>
      </header>
      {!rows ? <p className="px-4 py-4 text-sm text-muted">Checking native balances…</p> : null}
      {rows && !shown.length ? <p className="px-4 py-4 text-sm text-muted">No native balance on the other networks.</p> : null}
      <ul className="divide-y divide-line">
        {shown.map((row) => (
          <li key={row.chain}>
            <Link
              to="/c/$chain/address/$address"
              params={{ chain: row.chain, address }}
              className={`flex h-12 items-center justify-between gap-3 px-4 ${row.chain === current ? "text-accent" : ""}`}
            >
              <span className="truncate text-sm">{row.name}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                {row.balance} {row.symbol}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && shown.length ? <p className="px-4 py-3 text-xs text-muted">0 on {hidden} other chains</p> : null}
    </section>
  );
}
