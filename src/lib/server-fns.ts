import { createServerFn } from "@tanstack/react-start";
import { loadAccount, loadBlock, loadBlocks, loadNetwork, loadTrending, loadTx } from "@/lib/chain.server";

export const getNetwork = createServerFn({ method: "GET" }).handler(() => loadNetwork());

export const getBlocks = createServerFn({ method: "GET" }).handler(() => loadBlocks());

export const getTrending = createServerFn({ method: "GET" }).handler(() => loadTrending());

export const getBlock = createServerFn({ method: "GET" })
  .validator((input: { slot: number }) => {
    const slot = Number(input?.slot);
    if (!Number.isInteger(slot) || slot < 0) throw new Error("That slot is not valid.");
    return { slot };
  })
  .handler(({ data }) => loadBlock(data.slot));

export const getTx = createServerFn({ method: "GET" })
  .validator((input: { sig: string }) => {
    const sig = input?.sig?.trim() ?? "";
    if (sig.length < 64) throw new Error("That signature looks too short.");
    return { sig };
  })
  .handler(({ data }) => loadTx(data.sig));

export const getAccount = createServerFn({ method: "GET" })
  .validator((input: { address: string }) => {
    const address = input?.address?.trim() ?? "";
    if (!address) throw new Error("Missing address.");
    return { address };
  })
  .handler(({ data }) => loadAccount(data.address));
