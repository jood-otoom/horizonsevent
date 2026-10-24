import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardBackground from "./DashboardBackground";

describe("DashboardBackground", () => {
  it("uses complete round dot grids on the main dashboard and preserves map artwork", () => {
    const display = renderToStaticMarkup(<DashboardBackground completeDots />);
    const map = renderToStaticMarkup(<DashboardBackground />);
    expect(display.match(/<span><\/span>/g)).toHaveLength(45);
    expect(display).not.toContain('fill="url(#corner-dots)"');
    expect(map).toContain('fill="url(#corner-dots)"');
    expect(map).not.toContain("dashboard-dot-grid");
  });
});
