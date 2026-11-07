import { createFileRoute } from "@tanstack/react-router";
import { loadBlocks } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/blocks")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await loadBlocks());
        } catch (error) {
          return json({ error: message(error, "Blocks unavailable") }, 502);
        }
      },
    },
  },
});
