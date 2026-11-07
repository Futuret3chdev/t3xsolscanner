import { createFileRoute } from "@tanstack/react-router";
import { loadAccount } from "@/lib/chain.server";
import { json, message } from "@/lib/http";

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
        if (!address) return json({ error: "address is required" }, 400);
        try {
          return json(await loadAccount(address));
        } catch (error) {
          return json({ error: message(error, "Account unavailable") }, 502);
        }
      },
    },
  },
});
