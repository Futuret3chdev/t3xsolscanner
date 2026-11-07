import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { chainMeta, evmChainList, type ChainId } from "@/lib/chains";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type SolanaInjected = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string } | string>;
};

export type EvmTxRequest = {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  chainId: number;
};

export type WalletChoice = "phantom" | "backpack" | "solflare" | "metamask" | "trust";

type WalletContextValue = {
  evmAddress: string | null;
  evmChainId: number | null;
  solAddress: string | null;
  connectChoice: (id: WalletChoice) => Promise<"connected" | "redirect">;
  disconnectEvm: () => void;
  disconnectSolana: () => Promise<void>;
  sendEvm: (tx: EvmTxRequest) => Promise<string>;
  sendSolana: (base64: string) => Promise<string>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

type EvmFlagged = Eip1193 & {
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EvmFlagged[];
};

type Injected = {
  ethereum?: EvmFlagged;
  solana?: SolanaInjected;
  phantom?: { ethereum?: EvmFlagged; solana?: SolanaInjected };
  backpack?: { ethereum?: EvmFlagged } & Partial<SolanaInjected>;
  solflare?: SolanaInjected;
  trustwallet?: Eip1193;
};

function injected(): Injected | null {
  if (typeof window === "undefined") return null;
  return window as unknown as Injected;
}

let activeEvm: Eip1193 | null = null;
let activeSol: SolanaInjected | null = null;

function evmList(): EvmFlagged[] {
  const w = injected();
  if (!w) return [];
  const list = [...(w.ethereum?.providers ?? []), w.ethereum, w.phantom?.ethereum, w.backpack?.ethereum].filter(
    (provider): provider is EvmFlagged => Boolean(provider?.request),
  );
  return list.filter((provider, index) => list.indexOf(provider) === index);
}

function phantomSol(): SolanaInjected | null {
  const w = injected();
  const sol = w?.phantom?.solana ?? (w?.solana?.isPhantom ? w.solana : null);
  return sol?.connect ? sol : null;
}

function phantomEvm(): Eip1193 | null {
  const found = evmList().find((provider) => provider.isPhantom);
  return injected()?.phantom?.ethereum?.request ? injected()!.phantom!.ethereum! : found ?? null;
}

function backpackSol(): SolanaInjected | null {
  const backpack = injected()?.backpack;
  return backpack?.connect ? (backpack as SolanaInjected) : null;
}

function solflareSol(): SolanaInjected | null {
  const w = injected();
  if (w?.solflare?.connect) return w.solflare;
  return null;
}

function metamaskEvm(): Eip1193 | null {
  return evmList().find((provider) => provider.isMetaMask && !provider.isBraveWallet && !provider.isPhantom) ?? null;
}

function trustEvm(): Eip1193 | null {
  const trust = injected()?.trustwallet;
  if (trust?.request) return trust;
  return evmList().find((provider) => provider.isTrust || provider.isTrustWallet) ?? null;
}

export function walletOpenUrl(id: WalletChoice): string {
  const href = window.location.href;
  const origin = window.location.origin;
  const encoded = encodeURIComponent(href);
  if (id === "phantom") return `https://phantom.app/ul/browse/${encoded}?ref=${encodeURIComponent(origin)}`;
  if (id === "solflare") return `https://solflare.com/ul/v1/browse/${encoded}?ref=${encodeURIComponent(origin)}`;
  if (id === "backpack") return `https://backpack.app/ul/v1/browse/${encoded}`;
  if (id === "metamask") {
    const { host, pathname, search } = window.location;
    return `https://metamask.app.link/dapp/${host}${pathname}${search}`;
  }
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encoded}`;
}

function ethereum(): Eip1193 | null {
  return activeEvm ?? evmList()[0] ?? null;
}

function solana(): SolanaInjected | null {
  if (activeSol) return activeSol;
  const w = injected();
  return w?.solana?.connect ? w.solana : null;
}

function hexChain(id: number): string {
  return `0x${id.toString(16)}`;
}

function walletMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "code" in error && (error as { code?: number }).code === 4001) {
    return "Rejected in the wallet.";
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function hexQuantity(value: string | undefined): string {
  if (!value || value === "0x" || value === "0") return "0x0";
  try {
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return "0x0";
  }
}

function chainLabel(chainId: number): string {
  const id = chainForEvmId(chainId);
  return id ? chainMeta(id).name : "that network";
}

function explainSend(error: unknown, chainId: number): string {
  const raw = walletMessage(error, "");
  const text = raw.toLowerCase();
  const name = chainLabel(chainId);
  if (text.includes("insufficient") || text.includes("not enough")) {
    return `Not enough on ${name}. The bridge leaves from ${name}, and the wallet still needs extra for gas.`;
  }
  if (!raw || text === "unexpected error" || text.includes("internal json-rpc") || text.includes("internal error")) {
    return `The wallet could not send this. It leaves from ${name}, so that wallet needs the full amount plus gas. If the ETH is on another chain, set From to that chain.`;
  }
  return raw;
}

async function ensureEvmChain(provider: Eip1193, chainId: number) {
  const current = Number(await provider.request({ method: "eth_chainId" }));
  if (current === chainId) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChain(chainId) }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : 0;
    const known = evmChainList().find((chain) => chain.chainId === chainId);
    if (code !== 4902 || !known) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChain(chainId),
          chainName: known.name,
          nativeCurrency: { name: known.symbol, symbol: known.symbol, decimals: 18 },
          rpcUrls: known.rpcs.slice(0, 1),
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmChainId, setEvmChainId] = useState<number | null>(null);
  const [solAddress, setSolAddress] = useState<string | null>(null);

  useEffect(() => {
    const provider = ethereum();
    if (!provider) return;
    let alive = true;
    void provider
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        const list = Array.isArray(accounts) ? accounts : [];
        const first = typeof list[0] === "string" ? list[0] : "";
        if (!alive || !first) return;
        const chain = Number(await provider.request({ method: "eth_chainId" }));
        if (!alive) return;
        activeEvm = provider;
        setEvmAddress(first);
        setEvmChainId(Number.isFinite(chain) ? chain : null);
      })
      .catch(() => undefined);

    const onAccounts = (...args: unknown[]) => {
      const list = Array.isArray(args[0]) ? args[0] : [];
      const first = typeof list[0] === "string" ? list[0] : "";
      setEvmAddress(first || null);
    };
    const onChain = (...args: unknown[]) => {
      const value = typeof args[0] === "string" ? Number(args[0]) : NaN;
      setEvmChainId(Number.isFinite(value) ? value : null);
    };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      alive = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  useEffect(() => {
    const provider = solana();
    if (!provider) return;
    let alive = true;
    void provider.connect({ onlyIfTrusted: true }).then((result) => {
      if (!alive) return;
      activeSol = provider;
      setSolAddress(result.publicKey.toString());
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      evmAddress,
      evmChainId,
      solAddress,
      async connectChoice(id) {
        const attachEvm = async (provider: Eip1193 | null) => {
          if (!provider) return false;
          const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
          const chain = Number(await provider.request({ method: "eth_chainId" }));
          activeEvm = provider;
          setEvmAddress(accounts[0] ?? null);
          setEvmChainId(Number.isFinite(chain) ? chain : null);
          return Boolean(accounts[0]);
        };
        const attachSol = async (provider: SolanaInjected | null) => {
          if (!provider) return false;
          const result = await provider.connect();
          activeSol = provider;
          setSolAddress(result.publicKey.toString());
          return true;
        };

        if (id === "phantom") {
          const sol = phantomSol();
          const evm = phantomEvm();
          if (!sol && !evm) return "redirect";
          const okSol = await attachSol(sol).catch(() => false);
          const okEvm = await attachEvm(evm).catch(() => false);
          if (!okSol && !okEvm) throw new Error("Phantom did not connect.");
          return "connected";
        }
        if (id === "backpack") {
          const sol = backpackSol();
          const evm = injected()?.backpack?.ethereum?.request ? injected()!.backpack!.ethereum! : null;
          if (!sol && !evm) return "redirect";
          const okSol = await attachSol(sol).catch(() => false);
          const okEvm = await attachEvm(evm).catch(() => false);
          if (!okSol && !okEvm) throw new Error("Backpack did not connect.");
          return "connected";
        }
        if (id === "solflare") {
          const sol = solflareSol();
          if (!sol) return "redirect";
          await attachSol(sol);
          return "connected";
        }
        if (id === "metamask") {
          const evm = metamaskEvm();
          if (!evm) return "redirect";
          await attachEvm(evm);
          return "connected";
        }
        const evm = trustEvm();
        if (!evm) return "redirect";
        await attachEvm(evm);
        return "connected";
      },
      disconnectEvm() {
        activeEvm = null;
        setEvmAddress(null);
        setEvmChainId(null);
      },
      async disconnectSolana() {
        try {
          await solana()?.disconnect?.();
        } catch {
          // The wallet can refuse; drop the local session anyway.
        }
        activeSol = null;
        setSolAddress(null);
      },
      async sendEvm(tx) {
        const provider = ethereum();
        if (!provider || !evmAddress) throw new Error("Connect an EVM wallet first.");
        const value = hexQuantity(tx.value);
        const params = {
          from: evmAddress,
          to: tx.to,
          data: tx.data,
          value,
        };
        try {
          await ensureEvmChain(provider, tx.chainId);
          const balance = BigInt(String(await provider.request({ method: "eth_getBalance", params: [evmAddress, "latest"] })));
          if (balance < BigInt(value)) {
            throw new Error(`Not enough on ${chainLabel(tx.chainId)}. This wallet does not hold the amount the bridge sends from there.`);
          }
          let gas: string | undefined;
          try {
            const estimated = await provider.request({ method: "eth_estimateGas", params: [params] });
            if (typeof estimated === "string" && estimated.startsWith("0x")) {
              gas = `0x${((BigInt(estimated) * 12n) / 10n).toString(16)}`;
            }
          } catch (error) {
            const raw = walletMessage(error, "").toLowerCase();
            if (raw.includes("insufficient") || raw.includes("not enough") || raw.includes("exceeds")) {
              throw new Error(explainSend(error, tx.chainId));
            }
          }
          const hash = await provider.request({
            method: "eth_sendTransaction",
            params: [gas ? { ...params, gas } : params],
          });
          if (typeof hash !== "string" || !hash) throw new Error("The wallet did not return a transaction hash.");
          const chain = Number(await provider.request({ method: "eth_chainId" }));
          setEvmChainId(Number.isFinite(chain) ? chain : tx.chainId);
          return hash;
        } catch (error) {
          throw new Error(explainSend(error, tx.chainId));
        }
      },
      async sendSolana(base64) {
        const provider = solana();
        if (!provider || !solAddress) throw new Error("Connect a Solana wallet first.");
        try {
          const { VersionedTransaction } = await import("@solana/web3.js");
          const raw = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const transaction = VersionedTransaction.deserialize(raw);
          const sent = await provider.signAndSendTransaction(transaction);
          return typeof sent === "string" ? sent : sent.signature;
        } catch (error) {
          throw new Error(walletMessage(error, "The wallet could not send that transaction."));
        }
      },
    }),
    [evmAddress, evmChainId, solAddress],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("Wallet is not available.");
  return value;
}

export function chainForEvmId(chainId: number | null): ChainId | null {
  if (chainId == null) return null;
  return evmChainList().find((chain) => chain.chainId === chainId)?.id ?? null;
}

export function evmChainHex(id: ChainId): string | null {
  const meta = chainMeta(id);
  return meta.chainId ? hexChain(meta.chainId) : null;
}
