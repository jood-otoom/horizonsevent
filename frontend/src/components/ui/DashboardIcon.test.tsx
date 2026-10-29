// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DASHBOARD_ICON_NAMES, DashboardIcon } from "./DashboardIcon";

afterEach(cleanup);

describe("DashboardIcon", () => {
  it("maps every required subject to an existing approved transparent PNG", () => {
    expect(DASHBOARD_ICON_NAMES).toHaveLength(15);
    for (const name of DASHBOARD_ICON_NAMES) {
      const { container, unmount } = render(<DashboardIcon name={name} size={40} />);
      const icon = container.querySelector(".dashboard-icon")!;
      const image = icon.querySelector("img")!;
      const source = image.getAttribute("src")!;
      expect(source).toMatch(/^\/icons\/png\/[\w-]+\.png$/);
      expect(existsSync(join(process.cwd(), "public", source.slice(1)))).toBe(true);
      expect(image.getAttribute("alt")).toBe("");
      expect(image.style.objectFit).toBe("contain");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("style")).not.toContain("background");
      expect(icon.getAttribute("style")).toContain("width: 40px");
      unmount();
    }
  });

  it("keeps employment and sector artwork in its original colors", () => {
    for (const name of ["employment-startups", "employment-people", "manufacturing"] as const) {
      const { container, unmount } = render(<DashboardIcon name={name} size={48} />);
      const icon = container.querySelector<HTMLElement>(".dashboard-icon")!;
      expect(icon.querySelector("img")?.getAttribute("src")).toContain("/icons/png/");
      expect(icon.innerHTML).not.toContain("mask-image");
      expect(icon.style.backgroundColor).toBe("");
      unmount();
    }
  });

  it("provides an accessible label when the pictogram has standalone meaning", () => {
    render(<DashboardIcon name="female" size={44} label="Female-led" />);
    expect(screen.getByRole("img", { name: "Female-led" })).toBeTruthy();
  });
});
