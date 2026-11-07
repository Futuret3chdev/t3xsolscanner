import { recordFill } from "@/lib/airdrop.functions";

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
    const result = await recordFill({ data: fill });
    if (!result.ok) return result.error;
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
