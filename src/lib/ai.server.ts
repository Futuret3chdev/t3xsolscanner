import { readFileSync } from "node:fs";
import { env } from "@/lib/env.server";
import { AI_MODELS, aiModel } from "@/lib/ai-models";

const GATEWAY = "https://gateway.ai.hostgator.com/v1/chat/completions";

const SYSTEM = `You are the T3X Scanner assistant.
T3X is a live explorer and router for Solana plus 24 EVM networks, including Ethereum, Base, BNB, Polygon, Arbitrum, Optimism, and Avalanche.
Solana swaps are quoted by Jupiter. Other swaps and bridges are quoted by LI.FI. Nothing is sent until the person's own wallet approves it.
Wallets people can connect: Phantom, Backpack, Solflare, MetaMask, and Trust Wallet. T3X Vault is coming soon. Do not link to t3x-wallet.vercel.app.
Airdrop rule, say it plainly when it matters: a swap or bridge over 20 US dollars earns T3X airdrops.
Never ask for a seed phrase, private key, or a signature inside this chat. Do not invent balances, prices, holders, or transaction results. If you were not given on-chain data, say the live numbers are on the Explorer. Keep answers short and concrete.`;

export type AiTurn = { role: "user" | "assistant"; content: string };

const hits = new Map<string, { count: number; reset: number }>();

export function allowAi(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || row.reset < now) {
    hits.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  if (row.count >= 30) return false;
  row.count += 1;
  return true;
}

function gatewayKey(): string {
  const fromEnv = env("HOSTGATOR_AI_KEY") || env("AI_GATEWAY_KEY");
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(".secrets/hostgator-ai-key", "utf8").trim();
    if (text) return text;
  } catch {
    /* no local key file on this host */
  }
  return "";
}

export function aiConfigured(): boolean {
  return gatewayKey().length > 0;
}

function cleanTurns(input: unknown): AiTurn[] | null {
  if (!Array.isArray(input)) return null;
  const turns: AiTurn[] = [];
  for (const item of input.slice(-8)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim().slice(0, 2000);
    if (!text) continue;
    turns.push({ role, content: text });
  }
  if (!turns.some((turn) => turn.role === "user")) return null;
  return turns;
}

export function explainGateway(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 401 || status === 403) return "The AI gateway rejected the key. Check the key in HostGator AI Tooling.";
  if (status === 402 || lower.includes("credit") || lower.includes("quota") || lower.includes("insufficient") || lower.includes("balance")) {
    return "AI credits are used up. Add credits in the HostGator AI Tooling tab, then try again.";
  }
  if (status === 429 || lower.includes("rate")) return "The gateway is busy. Wait a moment and try again.";
  if (lower.includes("model") || status === 404) return "That model is unavailable right now. Pick another one.";
  return "The model did not answer. Try again, or switch to a faster model.";
}

function emitLines(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, block: string) {
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const delta = deltaFromChunk(JSON.parse(data));
      if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
    } catch {
      /* ignore partial or unknown frames */
    }
  }
}

function deltaFromChunk(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choice = (payload as { choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.delta?.content ?? choice?.message?.content;
  return typeof content === "string" ? content : "";
}

export async function streamAi(modelId: string, input: unknown): Promise<Response> {
  const model = aiModel(modelId);
  if (!model || !AI_MODELS.some((item) => item.id === modelId)) {
    return Response.json({ error: "Pick a model from the list." }, { status: 400 });
  }
  const turns = cleanTurns(input);
  if (!turns) return Response.json({ error: "Ask something first." }, { status: 400 });
  const key = gatewayKey();
  if (!key) {
    return Response.json(
      { error: "The AI gateway key is not set on this server yet." },
      { status: 503 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: "system", content: SYSTEM }, ...turns],
        max_tokens: model.reasoning ? 1800 : 700,
        stream: true,
      }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch {
    return Response.json({ error: "Could not reach the AI gateway." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return Response.json({ error: explainGateway(upstream.status, text) }, { status: upstream.status || 502 });
  }

  const upstreamType = upstream.headers.get("content-type") || "";
  if (upstreamType.includes("application/json")) {
    const payload = (await upstream.json().catch(() => null)) as unknown;
    const text = deltaFromChunk(payload);
    const encoder = new TextEncoder();
    const body = `data: ${JSON.stringify({ delta: text })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`;
    return new Response(body, {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let pending = "";
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          emitLines(controller, encoder, lines.join("\n"));
        }
        pending += decoder.decode();
        emitLines(controller, encoder, pending);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "The model stopped early." })}\n\n`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
