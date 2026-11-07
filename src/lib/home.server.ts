import { chainMeta, type ChainId, type HomeView, type MarketToken } from "@/lib/chains";
import { loadBlocks, loadNetwork, loadTrending } from "@/lib/chain.server";
import { loadEvmHead, loadEvmMarkets, loadNativeQuote, gweiLabel } from "@/lib/evm.server";
import { slotFmt, usd } from "@/lib/format";

function blank(chain: ChainId, warning: string): HomeView {
  const meta = chainMeta(chain);
  return {
    chain,
    name: meta.name,
    symbol: meta.symbol,
    kind: meta.kind,
    stats: [],
    blocks: [],
    txs: [],
    markets: [],
    marketTitle: "Markets",
    warning,
  };
}

async function solanaHome(): Promise<HomeView> {
  const [network, feed, trending] = await Promise.all([
    loadNetwork(),
    loadBlocks(),
    loadTrending().catch(() => []),
  ]);
  const markets: MarketToken[] = trending.slice(0, 4).map((token) => ({
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    priceUsd: token.priceUsd,
    changeH24: token.changeH24,
    liquidityUsd: token.liquidityUsd,
    volumeH24: token.volumeH24,
  }));
  return {
    chain: "solana",
    name: "Solana",
    symbol: "SOL",
    kind: "solana",
    stats: [
      { label: "Slot", value: slotFmt(network.slot), hint: `Height ${slotFmt(network.blockHeight)}`, meter: null, change: null },
      {
        label: `Epoch ${network.epoch}`,
        value: `${network.epochProgress.toFixed(1)}%`,
        hint: `${slotFmt(network.slotsLeft)} slots left`,
        meter: network.epochProgress,
        change: null,
      },
      {
        label: "TPS",
        value: network.tps == null ? "—" : Math.round(network.tps).toLocaleString("en-US"),
        hint: "Last 60 seconds",
        meter: null,
        change: null,
      },
      {
        label: "SOL",
        value: usd(network.solPrice),
        hint: "24h",
        meter: null,
        change: network.solChange24h,
      },
    ],
    blocks: feed.blocks.slice(0, 6).map((block) => ({
      id: String(block.slot),
      label: slotFmt(block.slot),
      time: block.time,
      txCount: block.txCount,
      meta: block.leader,
    })),
    txs: (feed.blocks[0]?.signatures ?? []).slice(0, 6).map((id) => ({ id, time: feed.blocks[0]?.time ?? null })),
    markets,
    marketTitle: "Boosted tokens",
    warning: feed.warning,
  };
}

async function evmHome(chain: ChainId): Promise<HomeView> {
  const meta = chainMeta(chain);
  const [head, quote, markets] = await Promise.all([
    loadEvmHead(chain),
    loadNativeQuote(chain).catch(() => ({ usd: null, change: null })),
    loadEvmMarkets(chain).catch(() => ({ title: "Active markets", tokens: [] as MarketToken[] })),
  ]);
  const latest = head.blocks[0];
  return {
    chain,
    name: meta.name,
    symbol: meta.symbol,
    kind: "evm",
    stats: [
      {
        label: "Block",
        value: slotFmt(head.number),
        hint: latest ? `${latest.txCount.toLocaleString("en-US")} txns in head` : "Head",
        meter: null,
        change: null,
      },
      { label: "Gas", value: gweiLabel(head.gasPrice), hint: "Current price", meter: null, change: null },
      {
        label: "Head txns",
        value: latest ? latest.txCount.toLocaleString("en-US") : "—",
        hint: "Latest block",
        meter: null,
        change: null,
      },
      { label: meta.symbol, value: usd(quote.usd), hint: "24h", meter: null, change: quote.change },
    ],
    blocks: head.blocks.slice(0, 6).map((block) => ({
      id: String(block.number),
      label: slotFmt(block.number),
      time: block.time,
      txCount: block.txCount,
      meta: block.miner,
    })),
    txs: (latest?.txs ?? []).slice(0, 6).map((id) => ({ id, time: latest?.time ?? null })),
    markets: markets.tokens.slice(0, 4),
    marketTitle: markets.title,
    warning: head.blocks.length ? null : "Latest blocks are not available from the public RPC yet.",
  };
}

export async function loadChainHome(chain: ChainId): Promise<HomeView> {
  try {
    return chain === "solana" ? await solanaHome() : await evmHome(chain);
  } catch (error) {
    const text = error instanceof Error && error.message ? error.message : "This chain is not responding.";
    return blank(chain, text);
  }
}
