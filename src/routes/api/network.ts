import { createFileRoute } from "@tanstack/react-router";
import { loadNetwork } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/network")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await loadNetwork());
        } catch (error) {
          return json({ error: message(error, "Network unavailable") }, 502);
        }
      },
    },
  },
});
