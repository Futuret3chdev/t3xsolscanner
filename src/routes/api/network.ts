import { createFileRoute } from "@tanstack/react-router";
import { parseChain } from "@/lib/chains";
import { loadNetwork } from "@/lib/chain.server";
import { loadChainHome } from "@/lib/home.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/network")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const chain = parseChain(new URL(request.url).searchParams.get("chain"));
          if (chain === "solana" && !new URL(request.url).searchParams.get("chain")) return json(await loadNetwork());
          return json(await loadChainHome(chain));
        } catch (error) {
          return json({ error: message(error, "Network unavailable") }, 502);
        }
      },
    },
  },
});
