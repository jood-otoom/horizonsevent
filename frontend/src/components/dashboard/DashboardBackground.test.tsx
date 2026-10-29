import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardBackground from "./DashboardBackground";

describe("DashboardBackground", () => {
  it("uses the official flower artwork on both public dashboards and no map background", () => {
    const display = renderToStaticMarkup(<DashboardBackground variant="dashboard" />);
    const map = renderToStaticMarkup(<DashboardBackground variant="map" />);
    expect(display.match(/class="dashboard-corner-flower"/g)).toHaveLength(1);
    expect(map.match(/class="dashboard-corner-flower"/g)).toHaveLength(1);
    expect(display).toContain("horizon-flower.svg");
    expect(map).toContain("horizon-flower.svg");
    expect(display).not.toContain("dashboard-dot-grid");
    expect(map).not.toContain("dashboard-dot-grid");
    expect(display).toContain("M1190 887");
    expect(map).not.toContain("dashboard-background");
    expect(display).toContain("M1423 893");
    expect(map).not.toContain("M1423 893");
    expect(display).not.toContain("M1180 0");
    expect(map).not.toContain("M1180 0");
    expect(display).not.toContain('cx="1694"');
    expect(map).not.toContain('cx="1694"');
  });
});
