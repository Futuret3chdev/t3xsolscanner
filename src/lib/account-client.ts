import { useSyncExternalStore } from "react";
import { claimRemoteUnits, linkRemoteWallet, loadRemoteClaim, loginAccount, recordRemoteFill, registerAccount } from "@/lib/account.functions";

const KEY = "t3x-account";

export type SavedAccount = { token: string; id: string; email: string; phone: string };

function read(): SavedAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedAccount;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function emit() {
  window.dispatchEvent(new Event("t3x-account"));
}

export function writeAccount(account: SavedAccount | null) {
  if (account) window.localStorage.setItem(KEY, JSON.stringify(account));
  else window.localStorage.removeItem(KEY);
  emit();
}

export function useAccount(): SavedAccount | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      const notify = () => onStoreChange();
      window.addEventListener("t3x-account", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("t3x-account", notify);
        window.removeEventListener("storage", notify);
      };
    },
    read,
    () => null,
  );
}

function requireToken() {
  const account = read();
  if (!account?.token) throw new Error("Sign in first.");
  return account.token;
}

export async function registerAndSave(input: { email: string; phone: string; password: string }) {
  const result = await registerAccount({ data: input });
  if (!result.ok) throw new Error(result.error);
  writeAccount({ token: result.token, id: result.user.id, email: result.user.email, phone: result.user.phone });
}

export async function loginAndSave(input: { email: string; password: string }) {
  const result = await loginAccount({ data: input });
  if (!result.ok) throw new Error(result.error);
  writeAccount({ token: result.token, id: result.user.id, email: result.user.email, phone: result.user.phone });
}

export function loadMyClaim() {
  return loadRemoteClaim({ data: { token: requireToken() } });
}

export function countRemoteTransfer(fill: { tx: string; chain: string; kind: string; symbol: string; amount: string; address: string }) {
  const account = read();
  if (!account) return Promise.resolve({ ok: false as const, error: "Sign in so this transfer counts toward T3X." });
  return recordRemoteFill({ data: { token: account.token, ...fill } });
}

export function linkMyWallet(address: string, kind: string) {
  return linkRemoteWallet({ data: { token: requireToken(), address, kind } });
}

export function claimMine() {
  return claimRemoteUnits({ data: { token: requireToken() } });
}
