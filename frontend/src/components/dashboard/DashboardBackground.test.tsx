import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardBackground from "./DashboardBackground";

describe("DashboardBackground", () => {
  it("draws one four-petal flower on the dashboard and keeps the map's lower dots", () => {
    const display = renderToStaticMarkup(<DashboardBackground variant="dashboard" />);
    const map = renderToStaticMarkup(<DashboardBackground variant="map" />);
    expect(display.match(/class="dashboard-flower-petal"/g)).toHaveLength(4);
    expect(display).not.toContain("dashboard-dot-grid");
    expect(map).not.toContain("dashboard-corner-flower");
    expect(map.match(/<span><\/span>/g)).toHaveLength(25);
    expect(map).not.toContain("dashboard-dot-grid-top");
    expect(display).toContain("M1190 887");
    expect(map).toContain("M1190 887");
    expect(display).not.toContain("M1180 0");
    expect(map).not.toContain("M1180 0");
    expect(display).not.toContain('cx="1694"');
    expect(map).not.toContain('cx="1694"');
  });
});
