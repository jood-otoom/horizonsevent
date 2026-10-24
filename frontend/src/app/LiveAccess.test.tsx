// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: null as string | null, userId: null as string | null }));
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: state.role ? { role: state.role } : null, error: null }),
    }) }) }) }),
  },
}));

import LiveAccess from "./LiveAccess";

beforeEach(() => {
  state.role = null;
  state.userId = null;
  auth.getSession.mockImplementation(async () => ({
    data: { session: state.userId ? { user: { id: state.userId } } : null }, error: null,
  }));
});

describe("staff controller access", () => {
  it("keeps the email/password form for signed-out visitors", async () => {
    render(<LiveAccess><div>protected controller</div></LiveAccess>);
    expect(await screen.findByText("Sign in to view the staff controller.")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryByText("protected controller")).toBeNull();
  });

  it("returns to the login form when an expired session cannot be refreshed", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh expired") });
    render(<LiveAccess><div>protected controller</div></LiveAccess>);
    expect(await screen.findByText("Sign in to view the staff controller.")).toBeTruthy();
    expect(screen.queryByText("protected controller")).toBeNull();
  });

  it("denies a viewer membership and allows staff membership", async () => {
    state.userId = "synthetic-user";
    state.role = "viewer";
    const viewer = render(<LiveAccess><div>protected controller</div></LiveAccess>);
    expect(await screen.findByText("This account is not authorized for this event view.")).toBeTruthy();
    expect(screen.queryByText("protected controller")).toBeNull();
    viewer.unmount();
    state.role = "staff";
    render(<LiveAccess><div>protected controller</div></LiveAccess>);
    expect(await screen.findByText("protected controller")).toBeTruthy();
  });
});
