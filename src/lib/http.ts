export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

export function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
