import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("renders all three pillars and marks the fixture values as demo data", () => {
    const markup = renderToStaticMarkup(<Dashboard />);

    expect(markup).toContain("MEET");
    expect(markup).toContain("MATCH");
    expect(markup).toContain("GROW");
    expect(markup).toContain("Demo values");
    expect(markup).not.toContain("dashboard-connections");
    expect(markup).not.toContain("MATCH connected");
    expect(markup).not.toContain("GROW connected");
    expect(markup).toContain("German-Jordan Cooperation");
    expect(markup).toContain("Co-funded by the European Union");
    expect(markup.indexOf('alt="GIZ"')).toBeLessThan(markup.indexOf('alt="Ministry of Digital Economy and Entrepreneurship"'));
    expect(markup.indexOf('alt="Ministry of Digital Economy and Entrepreneurship"')).toBeLessThan(markup.indexOf('alt="ICON Institute"'));
    expect(markup.indexOf('alt="ICON Institute"')).toBeLessThan(markup.indexOf('alt="PEM Consult"'));
    expect(markup).not.toContain("29 October 2026");
    expect(markup).not.toContain("People</span>");
    expect(markup).not.toContain("Building a brighter");
    expect(markup.match(/role="img"/g)).toHaveLength(3);
  });
});
