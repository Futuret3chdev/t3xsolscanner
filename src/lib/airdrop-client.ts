import { countRemoteTransfer } from "@/lib/account-client";

export type FillDraft = {
  tx: string;
  chain: string;
  kind: string;
  symbol: string;
  amount: string;
  address: string;
};

const PENDING_KEY = "t3x-pending-fill";

export async function countTransfer(fill: FillDraft): Promise<string | null> {
  try {
    const result = await countRemoteTransfer(fill);
    if (!result.ok) {
      if (result.error.startsWith("Sign in")) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(fill));
      }
      return result.error;
    }
    return null;
  } catch {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(fill));
    } catch {
      /* ignore */
    }
    return "Sign in so this transfer counts toward T3X.";
  }
}
