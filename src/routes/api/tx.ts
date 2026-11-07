import { createFileRoute } from "@tanstack/react-router";
import { loadTx } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/tx")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sig = new URL(request.url).searchParams.get("sig")?.trim() ?? "";
        if (sig.length < 64) return json({ error: "sig is required" }, 400);
        try {
          return json(await loadTx(sig));
        } catch (error) {
          return json({ error: message(error, "Transaction unavailable") }, 502);
        }
      },
    },
  },
});
