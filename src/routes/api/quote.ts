import { createFileRoute } from "@tanstack/react-router";
import { loadQuote } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const Route = createFileRoute("/api/quote")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: cors }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const data = await loadQuote({
            input: url.searchParams.get("input") || url.searchParams.get("inputMint") || "",
            output: url.searchParams.get("output") || url.searchParams.get("outputMint") || "",
            amount: url.searchParams.get("amount") || "",
            slippageBps: Number(url.searchParams.get("slippageBps") || "50"),
          });
          return json(data);
        } catch (error) {
          return json({ error: message(error, "Quote failed") }, 400);
        }
      },
    },
  },
});
