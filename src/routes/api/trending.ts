import { createFileRoute } from "@tanstack/react-router";
import { loadTrending } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/trending")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await loadTrending());
        } catch (error) {
          return json({ error: message(error, "Trending unavailable") }, 502);
        }
      },
    },
  },
});
