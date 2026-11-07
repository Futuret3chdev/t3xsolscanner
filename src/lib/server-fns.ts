import { createServerFn } from "@tanstack/react-start";
import { isEvmChain, parseChain } from "@/lib/chains";
import { loadAccount, loadBlock, loadBlocks, loadNetwork, loadTrending, loadTx } from "@/lib/chain.server";
import { loadEvmAccount, loadEvmBlock, loadEvmTx } from "@/lib/evm.server";
import { loadChainHome } from "@/lib/home.server";

export const getNetwork = createServerFn({ method: "GET" }).handler(() => loadNetwork());

export const getBlocks = createServerFn({ method: "GET" }).handler(() => loadBlocks());

export const getTrending = createServerFn({ method: "GET" }).handler(() => loadTrending());

export const getChainHome = createServerFn({ method: "GET" })
  .validator((input: { chain?: string }) => ({ chain: parseChain(input?.chain) }))
  .handler(({ data }) => loadChainHome(data.chain));

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

export const getEvmBlock = createServerFn({ method: "GET" })
  .validator((input: { chain?: string; id?: string }) => {
    const chain = parseChain(input?.chain);
    if (!isEvmChain(chain)) throw new Error("That chain is not an EVM network.");
    const id = String(input?.id ?? "").trim();
    if (!/^\d{1,12}$/.test(id)) throw new Error("That block number is not valid.");
    return { chain, id };
  })
  .handler(({ data }) => loadEvmBlock(data.chain, data.id));

export const getEvmTx = createServerFn({ method: "GET" })
  .validator((input: { chain?: string; hash?: string }) => {
    const chain = parseChain(input?.chain);
    if (!isEvmChain(chain)) throw new Error("That chain is not an EVM network.");
    const hash = String(input?.hash ?? "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("That transaction hash is not valid.");
    return { chain, hash };
  })
  .handler(({ data }) => loadEvmTx(data.chain, data.hash));

export const getEvmAccount = createServerFn({ method: "GET" })
  .validator((input: { chain?: string; address?: string }) => {
    const chain = parseChain(input?.chain);
    if (!isEvmChain(chain)) throw new Error("That chain is not an EVM network.");
    const address = String(input?.address ?? "").trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("That address is not valid.");
    return { chain, address };
  })
  .handler(({ data }) => loadEvmAccount(data.chain, data.address));
