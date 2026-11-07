import { createFileRoute } from "@tanstack/react-router";
import { loadGasBoard } from "@/lib/evm.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/gas")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await loadGasBoard());
        } catch (error) {
          return json({ error: message(error, "Gas unavailable") }, 502);
        }
      },
    },
  },
});
