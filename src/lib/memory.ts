export type ScanKind = "address" | "tx" | "block";

export type ScanItem = {
  chain: string;
  kind: ScanKind;
  id: string;
  label: string;
  at: number;
};

const RECENT_KEY = "t3x-recent";
const WATCH_KEY = "t3x-watch";

function keyOf(item: Pick<ScanItem, "chain" | "kind" | "id">): string {
  return `${item.chain}:${item.kind}:${item.id}`;
}

function read(storageKey: string): ScanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as ScanItem[];
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && item.id && item.chain && item.kind);
  } catch {
    return [];
  }
}

function write(storageKey: string, items: ScanItem[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function readRecent(): ScanItem[] {
  return read(RECENT_KEY);
}

export function readWatch(): ScanItem[] {
  return read(WATCH_KEY);
}

export function pushRecent(item: Omit<ScanItem, "at">) {
  const next = [ { ...item, at: Date.now() }, ...readRecent().filter((row) => keyOf(row) !== keyOf(item)) ].slice(0, 8);
  write(RECENT_KEY, next);
}

export function isWatched(item: Pick<ScanItem, "chain" | "kind" | "id">): boolean {
  return readWatch().some((row) => keyOf(row) === keyOf(item));
}

export function toggleWatch(item: Omit<ScanItem, "at">): boolean {
  const current = readWatch();
  const exists = current.some((row) => keyOf(row) === keyOf(item));
  const next = exists
    ? current.filter((row) => keyOf(row) !== keyOf(item))
    : [{ ...item, at: Date.now() }, ...current].slice(0, 24);
  write(WATCH_KEY, next);
  return !exists;
}
