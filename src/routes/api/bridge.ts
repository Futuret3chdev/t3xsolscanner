import { createFileRoute } from "@tanstack/react-router";
import { loadBridgeQuote } from "@/lib/bridge.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/bridge")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          return json(
            await loadBridgeQuote({
              fromChain: url.searchParams.get("fromChain") ?? "",
              toChain: url.searchParams.get("toChain") ?? "",
              asset: url.searchParams.get("asset") ?? "native",
              amount: url.searchParams.get("amount") ?? "",
              slippageBps: Number(url.searchParams.get("slippageBps") ?? "50"),
              fromAddress: url.searchParams.get("fromAddress") ?? "",
              toAddress: url.searchParams.get("toAddress") ?? "",
            }),
          );
        } catch (error) {
          return json({ error: message(error, "Bridge quote failed") }, 400);
        }
      },
    },
  },
});
