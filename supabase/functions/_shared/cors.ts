const allowedHeaders = "authorization, apikey, x-client-info, content-type, x-retry-count";

function approvedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && (url.protocol === "https:" ||
      (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")));
  } catch {
    return false;
  }
}

/** Browser origins are an additional exposure limit; authentication is enforced separately. */
export async function withApprovedOrigin(
  request: Request,
  allowedOrigins: string | undefined,
  methods: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const origin = request.headers.get("origin");
  const allowed = new Set((allowedOrigins ?? "").split(",").map((entry) => entry.trim()).filter(approvedOrigin));
  if (origin && !allowed.has(origin)) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const headers = new Headers({ "cache-control": "no-store" });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", allowedHeaders);
    headers.set("access-control-allow-methods", methods);
    headers.set("vary", "Origin");
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const response = await handler();
  const outgoing = new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
  headers.forEach((value, key) => outgoing.headers.set(key, value));
  return outgoing;
}
