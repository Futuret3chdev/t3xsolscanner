import { createFileRoute } from "@tanstack/react-router";
import { loadBlock } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/block")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slot = Number(new URL(request.url).searchParams.get("slot"));
        if (!Number.isInteger(slot) || slot < 0) return json({ error: "slot is required" }, 400);
        try {
          return json(await loadBlock(slot));
        } catch (error) {
          return json({ error: message(error, "Block unavailable") }, 502);
        }
      },
    },
  },
});
