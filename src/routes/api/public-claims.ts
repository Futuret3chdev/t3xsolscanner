import { createFileRoute } from "@tanstack/react-router";
import { publicClaimRows } from "@/lib/account.functions";
import { json } from "@/lib/http";

export const Route = createFileRoute("/api/public-claims")({
  server: {
    handlers: {
      GET: async () => json(await publicClaimRows()),
    },
  },
});
