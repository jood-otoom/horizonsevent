// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MAP_ICON_SIZES, MapIcon, type MapIconName, type MapIconSize } from "./MapIcon";

afterEach(cleanup);

const sources: [MapIconName, string][] = [
  ["female", "female_participants"], ["male", "male_participants"],
  ["building", "startups_employing_people"], ["people", "total_employees"],
  ["rocket", "acceleration"], ["bars", "go_to_market"], ["sprout", "grow_plus"],
  ["monitor", "technology_digital"], ["leaf", "green_clean_tech"],
  ["industry", "industry_manufacturing"], ["heart", "health_social_impact"],
  ["book", "education_creative"], ["briefcase", "commerce_services"],
  ["utensils", "hospitality_tourism"], ["more", "other"],
];

describe("MapIcon", () => {
  it("renders all dashboard subjects from the supplied artwork", () => {
    for (const [name, filename] of sources) {
      const { container, unmount } = render(<MapIcon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 64 64");
      expect(svg?.querySelector("image")?.getAttribute("href")).toContain(`${filename}.png`);
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      unmount();
    }
  });

  it("fits complete images without cropping at all four standard display sizes", () => {
    const { rerender, container } = render(<MapIcon name="male" size="small" />);
    const sizes: MapIconSize[] = ["small", "medium", "large", "extraLarge"];
    for (const size of sizes) {
      rerender(<MapIcon name="industry" size={size} />);
      expect(container.firstElementChild?.getAttribute("width")).toBe(String(MAP_ICON_SIZES[size]));
      expect(container.firstElementChild?.getAttribute("height")).toBe(String(MAP_ICON_SIZES[size]));
      const image = container.querySelector("image");
      expect(image?.getAttribute("width")).toBe("64");
      expect(image?.getAttribute("height")).toBe("64");
      expect(image?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
      expect(container.querySelector("svg svg")).toBeNull();
    }
  });

  it("supports a standalone accessible label while keeping the raster hidden", () => {
    render(<MapIcon name="female" label="Female participants" size="large" />);
    const icon = screen.getByRole("img", { name: "Female participants" });
    expect(icon.getAttribute("width")).toBe(String(MAP_ICON_SIZES.large));
    expect(icon.querySelector("image")?.getAttribute("aria-hidden")).toBe("true");
  });
});
