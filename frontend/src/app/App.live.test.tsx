import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabaseClient", () => ({
  dataMode: "live", supabase: null,
  supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "sb_publishable_test",
}));

import App from "./App";

describe("live route access", () => {
  it("renders the main dashboard without a sign-in gate", () => {
    const markup = renderToStaticMarkup(<App pathname="/" />);
    expect(markup).toContain("New Horizons event progress");
    expect(markup).not.toContain("Checking access");
    expect(markup).not.toContain("Sign in");
  });

  it("keeps the controller behind the existing access gate", () => {
    const markup = renderToStaticMarkup(<App pathname="/controller" />);
    expect(markup).toContain("Checking access");
    expect(markup).not.toContain("Staff Controller");
  });
});
