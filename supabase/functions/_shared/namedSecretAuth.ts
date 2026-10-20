export function hasNamedSecretKey(serializedKeys: string | undefined, name: string): boolean {
  try {
    const keys: unknown = JSON.parse(serializedKeys ?? "{}");
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) return false;
    const value = (keys as Record<string, unknown>)[name];
    return typeof value === "string" && value.length > 0;
  } catch {
    return false;
  }
}

export async function handleNamedSecretRequest(
  request: Request,
  name: string,
  serializedKeys: string | undefined,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  // The server wrapper may include configuration details when a named key is absent.
  if (!hasNamedSecretKey(serializedKeys, name)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const response = await handler(request);
    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (response.status >= 500) {
      return Response.json({ status: "unavailable" }, { status: response.status });
    }
    return response;
  } catch {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }
}
