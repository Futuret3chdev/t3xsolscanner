import { createFileRoute } from "@tanstack/react-router";
import { AI_FAMILIES } from "@/lib/ai-models";
import { aiConfigured, allowAi, streamAi } from "@/lib/ai.server";
import { json } from "@/lib/http";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      GET: async () => json({ ok: aiConfigured(), families: AI_FAMILIES }),
      POST: async ({ request }) => {
        if (!allowAi(clientIp(request))) {
          return json({ error: "Too many questions. Wait a few minutes." }, 429);
        }
        let body: { model?: unknown; messages?: unknown };
        try {
          body = (await request.json()) as { model?: unknown; messages?: unknown };
        } catch {
          return json({ error: "Send a model and a message." }, 400);
        }
        return streamAi(String(body.model || ""), body.messages);
      },
    },
  },
});
