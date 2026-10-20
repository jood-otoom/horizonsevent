import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("renders all three pillars and marks the fixture values as demo data", () => {
    const markup = renderToStaticMarkup(<Dashboard />);

    expect(markup).toContain("MEET");
    expect(markup).toContain("MATCH");
    expect(markup).toContain("GROW");
    expect(markup).toContain("Demo data · Synthetic values");
    expect(markup).toContain("German Cooperation and the European Union");
    expect(markup).toContain("Implemented by GIZ");
    expect(markup).toContain("29 October 2026");
    expect(markup).not.toContain("People</span>");
    expect(markup).not.toContain("Building a brighter");
    expect(markup.match(/role="img"/g)).toHaveLength(3);
  });
});
