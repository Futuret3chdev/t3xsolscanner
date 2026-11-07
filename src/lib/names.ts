import { CHAINS } from "@/lib/chains";
import { programName } from "@/lib/labels";

const NAMES: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "Zero address",
  "0x000000000000000000000000000000000000dead": "Burn",
  "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": "vitalik.eth",
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance",
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Binance",
  "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": "Coinbase",
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": "Coinbase",
  "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Universal Router",
  "0x66a9893cc07d91d95644aedd05d03f95e1dba8af": "Uniswap Universal Router",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap SwapRouter02",
  "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b": "Uniswap Universal Router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch v5",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch v6",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  "0x98f3c9e6e3face36baad05fe09d375ef1464288b": "Wormhole",
  "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5": "Across SpokePool",
  "0x8731d54e9d02c286767d56ac03e8037c07e01e98": "Stargate Router",
  "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f": "Arbitrum Gateway",
  "0x3154cf16ccdb4c6d922629664174b904d80f2c35": "Base Portal",
  "0x49048044d57e1c92a77f79988d21fa8faf74e97e": "Base Portal",
  "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "cbETH",
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "stETH",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Binance",
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance",
  "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2": "Bybit",
  "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": "Coinbase",
  "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": "Coinbase",
};

export function addressName(address: string): string | null {
  if (!address) return null;
  const program = programName(address);
  if (program) return program;
  const key = address.toLowerCase();
  if (NAMES[key]) return NAMES[key];
  if (NAMES[address]) return NAMES[address];
  for (const chain of CHAINS) {
    if (chain.wrapped && chain.wrapped.toLowerCase() === key) return `W${chain.symbol}`;
    if (chain.stable && chain.stable.address.toLowerCase() === key) return chain.stable.symbol;
  }
  return null;
}
