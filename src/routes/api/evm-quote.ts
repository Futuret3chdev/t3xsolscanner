import { createFileRoute } from "@tanstack/react-router";
import { loadEvmQuote } from "@/lib/evm-quote.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/evm-quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          return json(
            await loadEvmQuote({
              chain: url.searchParams.get("chain") ?? "",
              input: url.searchParams.get("input") ?? "",
              output: url.searchParams.get("output") ?? "",
              amount: url.searchParams.get("amount") ?? "",
              slippageBps: Number(url.searchParams.get("slippageBps") ?? "50"),
              user: url.searchParams.get("user") ?? "",
            }),
          );
        } catch (error) {
          return json({ error: message(error, "Quote failed") }, 400);
        }
      },
    },
  },
});
