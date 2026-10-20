import { describe, expect, it, vi } from "vitest";
import { allowedRole } from "../functions/_shared/authorization.ts";
import { parseSubmission } from "../functions/_shared/controllerPayload.ts";
import { withApprovedOrigin } from "../functions/_shared/cors.ts";

const requestId = "d60c192d-e138-4b36-a67a-4c29dba3344f";

describe("Edge request boundaries", () => {
  it("rejects unauthorized browser origins before invoking the handler", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const result = await withApprovedOrigin(new Request("https://example.test", {
      headers: { origin: "https://unapproved.test" },
    }), "https://approved.test", "GET, OPTIONS", handler);
    expect(result.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const insecure = await withApprovedOrigin(new Request("https://example.test", {
      headers: { origin: "http://public.test" },
    }), "http://public.test", "GET, OPTIONS", handler);
    expect(insecure.status).toBe(403);
  });

  it("allows an exact origin and preflight without a wildcard", async () => {
    const result = await withApprovedOrigin(new Request("https://example.test", {
      method: "OPTIONS", headers: { origin: "https://approved.test" },
    }), "https://approved.test", "GET, OPTIONS", async () => Response.json({ ok: true }));
    expect(result.status).toBe(204);
    expect(result.headers.get("access-control-allow-origin")).toBe("https://approved.test");
    const get = await withApprovedOrigin(new Request("https://example.test", {
      headers: { origin: "https://approved.test" },
    }), "https://approved.test", "GET, OPTIONS", async () => Response.json({ ok: true }));
    expect(get.headers.get("access-control-allow-origin")).toBe("https://approved.test");
  });

  it("requires an event membership with the requested role", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: { role: "viewer" }, error: null }),
    }) }) }) }) };
    expect(await allowedRole(client, "synthetic-user", ["staff", "admin"])).toBe(false);
    expect(await allowedRole(client, "synthetic-user", ["viewer", "staff", "admin"])).toBe(true);
  });

  it("validates event, request IDs, quantities, and ratings", () => {
    expect(parseSubmission({ kind: "meeting", eventId: 17135, requestId, quantity: 3 })).toMatchObject({ quantity: 3 });
    expect(parseSubmission({ kind: "feedback", requestId, rating: 5 })).toMatchObject({ rating: 5 });
    expect(parseSubmission({ kind: "undo", requestId,
      originalRequestId: "11111111-1111-4111-8111-111111111111", reason: "duplicate" }))
      .toMatchObject({ kind: "undo", reason: "duplicate" });
    expect(() => parseSubmission({ kind: "meeting", eventId: 999, requestId, quantity: 1 })).toThrow();
    expect(() => parseSubmission({ kind: "meeting", requestId, quantity: 4 })).toThrow();
    expect(() => parseSubmission({ kind: "feedback", requestId, rating: 0 })).toThrow();
    expect(() => parseSubmission({ kind: "feedback", requestId: "same", rating: 2 })).toThrow();
    expect(() => parseSubmission({ kind: "undo", requestId,
      originalRequestId: requestId, reason: "duplicate" })).toThrow();
    expect(() => parseSubmission({ kind: "undo", requestId,
      originalRequestId: "11111111-1111-4111-8111-111111111111", reason: "unreviewed" })).toThrow();
  });
});
