// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MAP_ICON_SIZES, MapIcon, type MapIconName, type MapIconSize } from "./MapIcon";

afterEach(cleanup);

const names: MapIconName[] = [
  "female", "male", "building", "people", "rocket", "bars", "sprout",
  "monitor", "leaf", "industry", "heart", "book", "briefcase", "utensils", "more",
];

describe("MapIcon", () => {
  it("renders all dashboard subjects from the supplied artwork", () => {
    for (const name of names) {
      const { container, unmount } = render(<MapIcon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 64 64");
      expect(svg?.querySelector("svg image")?.getAttribute("href")).toContain(
        name === "female" ? "female-portrait.png" : "dashboard-icon-sheet.png",
      );
      expect(svg?.querySelector("svg")?.getAttribute("viewBox")).not.toBe("0 0 313.5 313.5");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      unmount();
    }
  });

  it("uses measured sheet crops and all four standard display sizes", () => {
    const { rerender, container } = render(<MapIcon name="male" size="small" />);
    expect(container.querySelector("svg svg")?.getAttribute("viewBox")).toBe("357 100 260 266");
    const sizes: MapIconSize[] = ["small", "medium", "large", "extraLarge"];
    for (const size of sizes) {
      rerender(<MapIcon name="industry" size={size} />);
      expect(container.firstElementChild?.getAttribute("width")).toBe(String(MAP_ICON_SIZES[size]));
    }
    expect(container.querySelector("svg svg")?.getAttribute("viewBox")).toBe("353 693 250 238");
    rerender(<MapIcon name="more" />);
    expect(container.querySelector("svg svg")?.getAttribute("viewBox")).toBe("664 1049 242 79");
  });

  it("supports a standalone accessible label while keeping the sprite hidden", () => {
    render(<MapIcon name="female" label="Female participants" size="large" />);
    const icon = screen.getByRole("img", { name: "Female participants" });
    expect(icon.getAttribute("width")).toBe(String(MAP_ICON_SIZES.large));
    expect(icon.querySelector("svg")?.getAttribute("viewBox")).toBe("145 59 965 1095");
    expect(icon.querySelector("image")?.getAttribute("aria-hidden")).toBe("true");
  });
});
