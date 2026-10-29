import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("renders all three pillars and marks the fixture values as demo data", () => {
    const markup = renderToStaticMarkup(<Dashboard />);

    expect(markup).toContain("MEET");
    expect(markup).toContain("MATCH");
    expect(markup).toContain("GROW");
    expect(markup).toContain("/icons/png/meet.png");
    expect(markup).toContain("/icons/png/match.png");
    expect(markup).toContain("/icons/png/grow.png");
    expect(markup).toContain("Demo values");
    expect(markup).not.toContain("dashboard-connections");
    expect(markup).not.toContain("MATCH connected");
    expect(markup).not.toContain("GROW connected");
    expect(markup).toContain("German-Jordan Cooperation");
    expect(markup).toContain("Co-funded by the European Union");
    const header = markup.slice(markup.indexOf("<header"), markup.indexOf("</header>"));
    const footer = markup.slice(markup.indexOf("<footer"), markup.indexOf("</footer>"));
    expect(header.indexOf('alt="Co-funded by the European Union"')).toBeLessThan(header.indexOf('alt="Ministry of Digital Economy and Entrepreneurship"'));
    expect(header).toContain("dashboard-funding-logos");
    expect(footer).not.toContain("Ministry of Digital Economy and Entrepreneurship");
    expect(footer.indexOf('alt="GIZ"')).toBeLessThan(footer.indexOf('alt="ICON Institute"'));
    expect(footer.indexOf('alt="ICON Institute"')).toBeLessThan(footer.indexOf('alt="PEM Consult"'));
    expect(markup).not.toContain("29 October 2026");
    expect(markup).not.toContain("People</span>");
    expect(markup).not.toContain("Building a brighter");
    expect(markup.match(/role="img"/g)).toHaveLength(3);
  });
});
