import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardBackground from "./DashboardBackground";

describe("DashboardBackground", () => {
  it("draws the same single four-petal flower on both public dashboards", () => {
    const display = renderToStaticMarkup(<DashboardBackground variant="dashboard" />);
    const map = renderToStaticMarkup(<DashboardBackground variant="map" />);
    expect(display.match(/class="dashboard-flower-petal"/g)).toHaveLength(4);
    expect(map.match(/class="dashboard-flower-petal"/g)).toHaveLength(4);
    expect(display).not.toContain("dashboard-dot-grid");
    expect(map).not.toContain("dashboard-dot-grid");
    expect(display).toContain("M1190 887");
    expect(map).toContain("M1190 887");
    expect(display).not.toContain("M1180 0");
    expect(map).not.toContain("M1180 0");
    expect(display).not.toContain('cx="1694"');
    expect(map).not.toContain('cx="1694"');
  });
});
