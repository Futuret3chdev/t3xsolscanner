import { createFileRoute } from "@tanstack/react-router";
import { loadEvmBalances } from "@/lib/evm.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/balances")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
        if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return json({ error: "That address is not valid." }, 400);
        try {
          return json(await loadEvmBalances(address));
        } catch (error) {
          return json({ error: message(error, "Balances unavailable") }, 502);
        }
      },
    },
  },
});
