export function AirdropBanner() {
  return (
    <a
      href="/how.mp4?v=1"
      className="flex h-[4.75rem] items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface px-3"
    >
      <img src="/logo.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">Transact over $20. Earn T3X airdrops.</span>
        <span className="mt-0.5 block truncate text-xs text-muted">Swap or bridge on any chain. Your wallet signs. Watch how.</span>
      </span>
      <span className="hidden shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg sm:inline">Watch</span>
    </a>
  );
}
