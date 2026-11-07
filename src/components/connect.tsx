import { useState } from "react";
import { shortAddr } from "@/lib/format";
import { useWallet, walletOpenUrl, type WalletChoice } from "@/lib/wallet";

const WALLETS: { id: WalletChoice; name: string; chains: string; detail: string }[] = [
  {
    id: "phantom",
    name: "Phantom",
    chains: "Solana & EVM",
    detail: "The wallet on your phone. Opens T3X inside Phantom so you can approve from there.",
  },
  {
    id: "backpack",
    name: "Backpack",
    chains: "Solana & EVM",
    detail: "Runs decentralized apps natively as xNFTs inside the wallet.",
  },
  {
    id: "solflare",
    name: "Solflare",
    chains: "Solana & EVM",
    detail: "Safety warnings and a transaction breakdown before you sign.",
  },
  {
    id: "metamask",
    name: "MetaMask",
    chains: "Ethereum & EVM",
    detail: "Supported by almost every Web3 app.",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    chains: "Multi-chain",
    detail: "A large set of chains beyond Solana and EVM.",
  },
];

export function ConnectButton() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<WalletChoice | null>(null);
  const connected = Boolean(wallet.evmAddress || wallet.solAddress);

  async function choose(id: WalletChoice) {
    setError("");
    setPending(id);
    try {
      const result = await wallet.connectChoice(id);
      if (result === "redirect") {
        window.location.assign(walletOpenUrl(id));
        return;
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen((value) => !value);
        }}
        className="inline-flex h-9 max-w-36 items-center truncate rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg"
      >
        {connected ? shortAddr(wallet.evmAddress || wallet.solAddress || "", 4) : "Connect"}
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close wallets" className="fixed inset-0 z-30 cursor-default bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-[24rem]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Connect a wallet</p>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">
                Close
              </button>
            </div>
            {wallet.evmAddress || wallet.solAddress ? (
              <div className="mb-2 rounded-lg border border-line px-3 py-2 text-xs text-muted">
                {wallet.evmAddress ? <p>EVM {shortAddr(wallet.evmAddress, 4)}</p> : null}
                {wallet.solAddress ? <p>Solana {shortAddr(wallet.solAddress, 4)}</p> : null}
                <div className="mt-1 flex gap-3">
                  {wallet.evmAddress ? (
                    <button type="button" className="text-fg" onClick={() => wallet.disconnectEvm()}>
                      Disconnect EVM
                    </button>
                  ) : null}
                  {wallet.solAddress ? (
                    <button type="button" className="text-fg" onClick={() => void wallet.disconnectSolana()}>
                      Disconnect Solana
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mb-2 text-xs text-pretty text-muted">On a phone, the wallet opens and loads T3X inside it.</p>
            )}
            <ul className="flex flex-col gap-2">
              {WALLETS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={pending != null}
                    onClick={() => void choose(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-left disabled:opacity-60"
                  >
                    <Mark id={item.id} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{item.name}</span>
                        <span className="shrink-0 text-[10px] tracking-wide text-muted uppercase">{item.chains}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-pretty text-muted">{item.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 opacity-80">
                  <img src="/logo.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">T3X Vault</span>
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
                        Coming soon
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-pretty text-muted">Our wallet. Not available to connect yet.</span>
                  </span>
                </div>
              </li>
            </ul>
            {error ? <p className="mt-2 text-xs text-pretty text-down">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Mark({ id }: { id: WalletChoice }) {
  const color =
    id === "phantom" ? "#ab9ff2" : id === "backpack" ? "#e6ff3d" : id === "solflare" ? "#fc822b" : id === "metamask" ? "#f6851b" : "#0500ff";
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: color }}>
      {id === "phantom" ? <Phantom /> : null}
      {id === "backpack" ? <Backpack /> : null}
      {id === "solflare" ? <Solflare /> : null}
      {id === "metamask" ? <Fox /> : null}
      {id === "trust" ? <Shield /> : null}
    </span>
  );
}

function Phantom() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path fill="#fff" d="M9 14.5c0-4 2.6-7.5 7-7.5s7 3.5 7 7.5v3.2c0 1.2.4 2.2 1.2 2.8-.8 2.4-3.6 4-8.2 4s-7.4-1.6-8.2-4c.8-.6 1.2-1.6 1.2-2.8v-3.2Z" />
      <circle cx="13" cy="15" r="1.2" fill="#2a2148" />
      <circle cx="19" cy="15" r="1.2" fill="#2a2148" />
    </svg>
  );
}

function Backpack() {
  return (
    <svg viewBox="0 0 32 32" className="size-6 text-black" aria-hidden="true">
      <path fill="currentColor" d="M11 12V9.5A5 5 0 0 1 16 4a5 5 0 0 1 5 5.5V12h1.5A2.5 2.5 0 0 1 25 14.5v10A3.5 3.5 0 0 1 21.5 28h-11A3.5 3.5 0 0 1 7 24.5v-10A2.5 2.5 0 0 1 9.5 12H11Zm2-2.5V12h6V9.5a3 3 0 0 0-6 0ZM12 18h8v2h-8v-2Z" />
    </svg>
  );
}

function Solflare() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <circle cx="16" cy="16" r="4" fill="#fff" />
      <path stroke="#fff" strokeWidth="2" strokeLinecap="round" d="M16 6v3M16 23v3M6 16h3M23 16h3M9 9l2 2M21 21l2 2M23 9l-2 2M11 21l-2 2" />
    </svg>
  );
}

function Fox() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path fill="#fff" d="M7 8l9 16L25 8l-4 3-5 8-5-8-4-3Z" />
    </svg>
  );
}

function Shield() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path fill="#fff" d="M16 5 7 9v7c0 6 3.6 9.6 9 11 5.4-1.4 9-5 9-11V9l-9-4Z" />
    </svg>
  );
}
