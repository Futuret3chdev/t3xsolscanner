import { createFileRoute } from "@tanstack/react-router";
import { buildSwap } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const Route = createFileRoute("/api/swap")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            input?: string;
            output?: string;
            amount?: string;
            slippageBps?: number;
            userPublicKey?: string;
          };
          const data = await buildSwap({
            input: body.input ?? "",
            output: body.output ?? "",
            amount: String(body.amount ?? ""),
            slippageBps: Number(body.slippageBps ?? 50),
            userPublicKey: body.userPublicKey ?? "",
          });
          return json(data);
        } catch (error) {
          return json({ error: message(error, "Swap build failed") }, 400);
        }
      },
    },
  },
});
