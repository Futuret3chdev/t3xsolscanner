export const CHAIN_IDS = [
  "solana",
  "ethereum",
  "base",
  "bnb",
  "polygon",
  "arbitrum",
  "optimism",
  "avalanche",
  "gnosis",
  "scroll",
  "linea",
  "zksync",
  "mantle",
  "celo",
  "opbnb",
  "unichain",
  "sonic",
  "berachain",
  "worldchain",
  "taiko",
  "mode",
  "fraxtal",
  "sei",
  "ink",
  "cronos",
] as const;

export type ChainId = (typeof CHAIN_IDS)[number];

export type StableToken = { symbol: string; address: string; decimals: number };

export type ChainMeta = {
  id: ChainId;
  name: string;
  symbol: string;
  kind: "solana" | "evm";
  dex: string;
  llama: string | null;
  wrapped: string | null;
  markets: string[];
  rpcs: string[];
  chainId: number | null;
  stable: StableToken | null;
};

const NATIVE = "0x0000000000000000000000000000000000000000";

function evm(input: {
  id: ChainId;
  name: string;
  symbol: string;
  dex: string;
  llama: string;
  chainId: number;
  rpcs: string[];
  wrapped?: string;
  markets?: string[];
  stable?: StableToken;
}): ChainMeta {
  const wrapped = input.wrapped ?? null;
  return {
    id: input.id,
    name: input.name,
    symbol: input.symbol,
    kind: "evm",
    dex: input.dex,
    llama: input.llama,
    wrapped,
    markets: input.markets ?? (wrapped ? [wrapped] : []),
    rpcs: input.rpcs,
    chainId: input.chainId,
    stable: input.stable ?? null,
  };
}

const USDC = (address: string, decimals = 6): StableToken => ({ symbol: "USDC", address, decimals });

export const NATIVE_TOKEN = NATIVE;

export const CHAINS: ChainMeta[] = [
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    kind: "solana",
    dex: "solana",
    llama: "coingecko:solana",
    wrapped: null,
    markets: [],
    rpcs: [],
    chainId: null,
    stable: null,
  },
  evm({
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    dex: "ethereum",
    llama: "coingecko:ethereum",
    chainId: 1,
    wrapped: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    markets: [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    ],
    stable: USDC("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    rpcs: ["https://ethereum.publicnode.com", "https://eth.llamarpc.com"],
  }),
  evm({
    id: "base",
    name: "Base",
    symbol: "ETH",
    dex: "base",
    llama: "coingecko:ethereum",
    chainId: 8453,
    wrapped: "0x4200000000000000000000000000000000000006",
    markets: [
      "0x4200000000000000000000000000000000000006",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    ],
    stable: USDC("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    rpcs: ["https://base.publicnode.com", "https://mainnet.base.org"],
  }),
  evm({
    id: "bnb",
    name: "BNB Chain",
    symbol: "BNB",
    dex: "bsc",
    llama: "coingecko:binancecoin",
    chainId: 56,
    wrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    markets: [
      "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
      "0x55d398326f99059fF775485246999027B3197955",
    ],
    stable: { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    rpcs: ["https://bsc.publicnode.com", "https://bsc-dataseed.binance.org"],
  }),
  evm({
    id: "polygon",
    name: "Polygon",
    symbol: "POL",
    dex: "polygon",
    llama: "coingecko:polygon-ecosystem-token",
    chainId: 137,
    wrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    markets: [
      "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    ],
    stable: USDC("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
    rpcs: ["https://polygon-bor.publicnode.com", "https://polygon-rpc.com"],
  }),
  evm({
    id: "arbitrum",
    name: "Arbitrum",
    symbol: "ETH",
    dex: "arbitrum",
    llama: "coingecko:ethereum",
    chainId: 42161,
    wrapped: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    stable: USDC("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
    rpcs: ["https://arbitrum-one.publicnode.com", "https://arb1.arbitrum.io/rpc"],
  }),
  evm({
    id: "optimism",
    name: "Optimism",
    symbol: "ETH",
    dex: "optimism",
    llama: "coingecko:ethereum",
    chainId: 10,
    wrapped: "0x4200000000000000000000000000000000000006",
    stable: USDC("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
    rpcs: ["https://optimism.publicnode.com", "https://mainnet.optimism.io"],
  }),
  evm({
    id: "avalanche",
    name: "Avalanche",
    symbol: "AVAX",
    dex: "avalanche",
    llama: "coingecko:avalanche-2",
    chainId: 43114,
    wrapped: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    stable: USDC("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"),
    rpcs: ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
  }),
  evm({
    id: "gnosis",
    name: "Gnosis",
    symbol: "xDAI",
    dex: "gnosis",
    llama: "coingecko:xdai",
    chainId: 100,
    wrapped: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
    stable: USDC("0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83"),
    rpcs: ["https://gnosis-rpc.publicnode.com", "https://rpc.gnosischain.com"],
  }),
  evm({
    id: "scroll",
    name: "Scroll",
    symbol: "ETH",
    dex: "scroll",
    llama: "coingecko:ethereum",
    chainId: 534352,
    wrapped: "0x5300000000000000000000000000000000000004",
    stable: USDC("0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4"),
    rpcs: ["https://scroll.publicnode.com", "https://rpc.scroll.io"],
  }),
  evm({
    id: "linea",
    name: "Linea",
    symbol: "ETH",
    dex: "linea",
    llama: "coingecko:ethereum",
    chainId: 59144,
    wrapped: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    stable: USDC("0x176211869cA2b568f2A7D4EE941E073a821EE1ff"),
    rpcs: ["https://linea-rpc.publicnode.com", "https://rpc.linea.build"],
  }),
  evm({
    id: "zksync",
    name: "zkSync",
    symbol: "ETH",
    dex: "zksync",
    llama: "coingecko:ethereum",
    chainId: 324,
    wrapped: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    rpcs: ["https://mainnet.era.zksync.io"],
  }),
  evm({
    id: "mantle",
    name: "Mantle",
    symbol: "MNT",
    dex: "mantle",
    llama: "coingecko:mantle",
    chainId: 5000,
    wrapped: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
    rpcs: ["https://rpc.mantle.xyz"],
  }),
  evm({
    id: "celo",
    name: "Celo",
    symbol: "CELO",
    dex: "celo",
    llama: "coingecko:celo",
    chainId: 42220,
    wrapped: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    rpcs: ["https://forno.celo.org"],
  }),
  evm({
    id: "opbnb",
    name: "opBNB",
    symbol: "BNB",
    dex: "opbnb",
    llama: "coingecko:binancecoin",
    chainId: 204,
    wrapped: "0x4200000000000000000000000000000000000006",
    rpcs: ["https://opbnb-mainnet-rpc.bnbchain.org"],
  }),
  evm({
    id: "unichain",
    name: "Unichain",
    symbol: "ETH",
    dex: "unichain",
    llama: "coingecko:ethereum",
    chainId: 130,
    wrapped: "0x4200000000000000000000000000000000000006",
    rpcs: ["https://mainnet.unichain.org"],
  }),
  evm({
    id: "sonic",
    name: "Sonic",
    symbol: "S",
    dex: "sonic",
    llama: "coingecko:sonic-3",
    chainId: 146,
    wrapped: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
    rpcs: ["https://rpc.soniclabs.com"],
  }),
  evm({
    id: "berachain",
    name: "Berachain",
    symbol: "BERA",
    dex: "berachain",
    llama: "coingecko:berachain-bera",
    chainId: 80094,
    wrapped: "0x6969696969696969696969696969696969696969",
    rpcs: ["https://rpc.berachain.com"],
  }),
  evm({
    id: "worldchain",
    name: "World Chain",
    symbol: "ETH",
    dex: "worldchain",
    llama: "coingecko:ethereum",
    chainId: 480,
    wrapped: "0x4200000000000000000000000000000000000006",
    rpcs: ["https://worldchain-mainnet.g.alchemy.com/public"],
  }),
  evm({
    id: "taiko",
    name: "Taiko",
    symbol: "ETH",
    dex: "taiko",
    llama: "coingecko:ethereum",
    chainId: 167000,
    wrapped: "0xA51894664A773981C6C112C43ce576f315d5b1B6",
    rpcs: ["https://rpc.mainnet.taiko.xyz"],
  }),
  evm({
    id: "mode",
    name: "Mode",
    symbol: "ETH",
    dex: "mode",
    llama: "coingecko:ethereum",
    chainId: 34443,
    wrapped: "0x4200000000000000000000000000000000000006",
    rpcs: ["https://mainnet.mode.network"],
  }),
  evm({
    id: "fraxtal",
    name: "Fraxtal",
    symbol: "frxETH",
    dex: "fraxtal",
    llama: "coingecko:frax-ether",
    chainId: 252,
    rpcs: ["https://rpc.frax.com"],
  }),
  evm({
    id: "sei",
    name: "Sei",
    symbol: "SEI",
    dex: "sei",
    llama: "coingecko:sei-network",
    chainId: 1329,
    rpcs: ["https://evm-rpc.sei-apis.com"],
  }),
  evm({
    id: "ink",
    name: "Ink",
    symbol: "ETH",
    dex: "ink",
    llama: "coingecko:ethereum",
    chainId: 57073,
    wrapped: "0x4200000000000000000000000000000000000006",
    rpcs: ["https://rpc-gel.inkonchain.com"],
  }),
  evm({
    id: "cronos",
    name: "Cronos",
    symbol: "CRO",
    dex: "cronos",
    llama: "coingecko:crypto-com-chain",
    chainId: 25,
    wrapped: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23",
    rpcs: ["https://evm.cronos.org", "https://cronos-evm-rpc.publicnode.com"],
  }),
];

export type MarketToken = {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  changeH24: number | null;
  liquidityUsd: number | null;
  volumeH24: number | null;
};

export type HomeStat = {
  label: string;
  value: string;
  hint: string;
  meter: number | null;
  change: number | null;
};

export type HomeBlock = {
  id: string;
  label: string;
  time: number | null;
  txCount: number;
  meta: string;
};

export type HomeView = {
  chain: ChainId;
  name: string;
  symbol: string;
  kind: "solana" | "evm";
  stats: HomeStat[];
  blocks: HomeBlock[];
  txs: { id: string; time: number | null }[];
  markets: MarketToken[];
  marketTitle: string;
  warning: string | null;
};

const ALIASES: Record<string, ChainId> = {
  eth: "ethereum",
  bsc: "bnb",
  binance: "bnb",
  matic: "polygon",
  pol: "polygon",
  arb: "arbitrum",
  op: "optimism",
  avax: "avalanche",
  xdai: "gnosis",
  gno: "gnosis",
  era: "zksync",
  bera: "berachain",
  cro: "cronos",
  world: "worldchain",
  frax: "fraxtal",
  uni: "unichain",
};

export function parseChain(value: unknown): ChainId {
  const id = typeof value === "string" ? value.toLowerCase() : "";
  if (ALIASES[id]) return ALIASES[id];
  return CHAINS.some((chain) => chain.id === id) ? (id as ChainId) : "solana";
}

export function chainMeta(id: ChainId): ChainMeta {
  return CHAINS.find((chain) => chain.id === id) ?? CHAINS[0]!;
}

export function isEvmChain(id: ChainId): boolean {
  return chainMeta(id).kind === "evm";
}

export function evmChainList(): ChainMeta[] {
  return CHAINS.filter((chain) => chain.kind === "evm");
}

export type ScanHit =
  | { kind: "home" }
  | { kind: "invalid"; message: string }
  | { kind: "block"; value: string }
  | { kind: "tx"; value: string }
  | { kind: "address"; value: string };

export function classifyQuery(raw: string, chainId: ChainId): ScanHit {
  const value = raw.trim();
  if (!value) return { kind: "home" };
  const chain = chainMeta(chainId);
  if (chain.kind === "evm") {
    if (/^\d{1,12}$/.test(value)) return { kind: "block", value: String(Number(value)) };
    const hex = value.startsWith("0x") || value.startsWith("0X") ? value : `0x${value}`;
    if (/^0x[0-9a-fA-F]{64}$/.test(hex)) return { kind: "tx", value: `0x${hex.slice(2)}` };
    if (/^0x[0-9a-fA-F]{40}$/.test(hex)) return { kind: "address", value: `0x${hex.slice(2)}` };
    return {
      kind: "invalid",
      message: `Paste a ${chain.name} address, transaction hash, or block number.`,
    };
  }
  if (/^\d{1,12}$/.test(value)) return { kind: "block", value };
  if (value.length >= 80) return { kind: "tx", value };
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return { kind: "address", value };
  return { kind: "invalid", message: "Paste a Solana wallet, mint, signature, or slot." };
}
