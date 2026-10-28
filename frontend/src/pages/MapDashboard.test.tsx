// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MapDashboard from "./MapDashboard";
import { MAP_GOVERNORATE_IDS, MAP_SECTORS } from "../types/map";

afterEach(cleanup);

const expected = {
  all: {
    name: "All Governorates", total: 265, gender: "142 female participants, 123 male participants",
    percentages: [54, 46], employment: [142, 762], stages: [150, 91, 24],
    sectors: [5, 12, 34, 5, 19, 17, 8, 0],
  },
  aqaba: {
    name: "Aqaba", total: 84, gender: "44 female participants, 40 male participants",
    percentages: [52, 48], employment: [36, 173], stages: [44, 36, 4],
    sectors: [5, 4, 30, 2, 27, 24, 8, 0],
  },
  amman: {
    name: "Amman", total: 22, gender: "2 female participants, 20 male participants",
    percentages: [9, 91], employment: [17, 144], stages: [0, 7, 15],
    sectors: [18, 18, 18, 5, 14, 27, 0, 0],
  },
  ajlun: {
    name: "Ajloun", total: 14, gender: "9 female participants, 5 male participants",
    percentages: [64, 36], employment: [9, 35], stages: [14, 0, 0],
    sectors: [0, 7, 36, 0, 0, 0, 57, 0],
  },
  mafraq: {
    name: "Mafraq", total: 44, gender: "33 female participants, 11 male participants",
    percentages: [75, 25], employment: [17, 93], stages: [21, 22, 1],
    sectors: [5, 27, 39, 7, 4, 16, 2, 0],
  },
} as const;
type Expected = typeof expected[keyof typeof expected];

function textValues(container: Element, selector: string): string[] {
  return [...container.querySelectorAll(selector)].map(element => element.textContent?.trim() ?? "");
}

function expectStatistics(container: HTMLElement, values: Expected) {
  const panel = container.querySelector(".map-statistics")!;
  const total = panel.querySelector(".map-total-card")!;
  expect(total.querySelector(".map-selection span")?.textContent).toBe(values.name);
  expect(panel.textContent?.match(new RegExp(values.name, "g"))).toHaveLength(1);
  expect(total.querySelector(".map-total-figure strong")?.textContent).toBe(String(values.total));
  expect(total.querySelector("#map-total-title")?.textContent).toBe("Total number of startups");

  const gender = panel.querySelector(".map-gender-card")!;
  expect(gender.querySelector(".map-gender-bar")?.getAttribute("aria-label")).toBe(values.gender);
  expect(textValues(gender, ".map-gender-segment strong")).toEqual(values.percentages.map(value => String(value) + "%"));
  expect(textValues(gender, ".map-gender-labels span")).toEqual(["Female participants", "Male participants"]);

  const employment = panel.querySelector(".map-employment-card")!;
  expect(textValues(employment, ".map-employment-metrics strong")).toEqual(values.employment.map(String));
  expect(employment.textContent).toContain("startups");
  expect(employment.textContent).toContain("total employees");

  const stages = panel.querySelector(".map-stage-journey")!;
  expect(textValues(stages, ".map-stage-step > div > span")).toEqual(["Acceleration", "Go to Market", "Grow+"]);
  expect(textValues(stages, ".map-stage-step strong")).toEqual(values.stages.map(String));

  const sectors = panel.querySelector(".map-sector-grid")!;
  expect(textValues(sectors, ".map-sector > div > span")).toEqual(MAP_SECTORS.map(sector => sector.label));
  expect(textValues(sectors, ".map-sector strong")).toEqual(values.sectors.map(value => String(value) + "%"));
  expect(values.sectors.reduce<number>((sum, value) => sum + value, 0)).toBe(100);
}

describe("Jordan startup map", () => {
  it("shows the validated national population and all synchronized cards", () => {
    const { container } = render(<MapDashboard />);
    expectStatistics(container, expected.all);
    expect(container.querySelector(".dashboard-header")).not.toBeNull();
    expect(container.querySelector(".dashboard-footer")).not.toBeNull();
    expect(container.querySelector(".map-employment-card")?.textContent).not.toContain("flagged missing");
    expect(screen.queryByText("266")).toBeNull();
  });

  it("updates total, gender, employment, stages and all eight sectors from one selection", () => {
    const { container } = render(<MapDashboard />);
    for (const id of ["aqaba", "amman", "ajlun", "mafraq"] as const) {
      fireEvent.click(screen.getByTestId("region-" + id));
      expectStatistics(container, expected[id]);
      expect(screen.getByTestId("region-" + id).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId("pin-" + id).classList.contains("is-selected")).toBe(true);
      expect(container.querySelectorAll(".map-region.is-selected")).toHaveLength(1);
      expect(container.querySelectorAll(".map-region.is-dimmed").length).toBeGreaterThan(0);
    }
    expect(container.querySelector(".map-employment-card")?.textContent).not.toContain("flagged missing");
  });

  it("resets by re-click, empty geography, map background and Show all", () => {
    const { container } = render(<MapDashboard />);
    fireEvent.click(screen.getByTestId("region-aqaba"));
    expectStatistics(container, expected.aqaba);
    fireEvent.click(screen.getByTestId("region-aqaba"));
    expectStatistics(container, expected.all);

    fireEvent.click(screen.getByTestId("region-amman"));
    fireEvent.click(container.querySelector(".map-region.is-neutral")!);
    expectStatistics(container, expected.all);

    fireEvent.click(screen.getByTestId("pin-ajlun"));
    expectStatistics(container, expected.ajlun);
    fireEvent.click(screen.getByRole("group", { name: "Jordan governorates map" }));
    expectStatistics(container, expected.all);

    fireEvent.click(screen.getByTestId("region-mafraq"));
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expectStatistics(container, expected.all);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();

    fireEvent.click(screen.getByTestId("region-ajlun"));
    fireEvent.click(container.querySelector(".map-sectors-card")!);
    expectStatistics(container, expected.all);
  });

  it("offers eight pins and keyboard-selectable regions on a data-ranked heatmap", () => {
    const { container } = render(<MapDashboard />);
    const map = screen.getByRole("group", { name: "Jordan governorates map" });
    expect(map.querySelectorAll(".map-regions path")).toHaveLength(12);
    expect(map.querySelectorAll(".map-region.is-neutral")).toHaveLength(4);
    expect(map.querySelectorAll(".map-pins .map-pin")).toHaveLength(8);
    expect(map.querySelectorAll("text")).toHaveLength(0);
    expect(map.querySelectorAll(".map-network-lines")).toHaveLength(0);
    for (const id of MAP_GOVERNORATE_IDS) expect(screen.getByTestId("pin-" + id)).toBeTruthy();
    const aqabaFill = screen.getByTestId("region-aqaba").style.fill;
    const maanFill = screen.getByTestId("region-maan").style.fill;
    expect(aqabaFill).not.toBe(maanFill);

    const ajloun = screen.getByRole("button", { name: "Ajloun, 14 startups" });
    fireEvent.keyDown(ajloun, { key: "Enter" });
    expectStatistics(container, expected.ajlun);
    expect(ajloun.getAttribute("aria-pressed")).toBe("true");
    const amman = screen.getByRole("button", { name: "Amman, 22 startups" });
    fireEvent.keyDown(amman, { key: " " });
    expectStatistics(container, expected.amman);
    expect(amman.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("region-aqaba").style.fill).toBe(aqabaFill);
  });

  it("scales sector tint to the selected population and keeps zero gender visible", () => {
    const { container } = render(<MapDashboard />);
    const tint = (index: number) => Number.parseInt(
      (container.querySelectorAll<HTMLElement>(".map-sector")[index]).style.getPropertyValue("--map-sector-tone"),
      10,
    );
    expect(tint(2)).toBeGreaterThan(tint(0));
    expect(tint(2)).toBe(100);
    expect(tint(7)).toBe(0);
    expect(container.querySelectorAll(".map-sector")[2].getAttribute("data-contrast")).toBe("light");
    expect(container.querySelectorAll(".map-sector")[7].getAttribute("data-contrast")).toBe("dark");

    fireEvent.click(screen.getByTestId("region-ajlun"));
    expect(tint(6)).toBe(100);
    expect(tint(2)).toBeLessThan(tint(6));

    fireEvent.click(screen.getByTestId("region-maan"));
    expect(container.querySelector(".map-gender-female")?.getAttribute("data-empty")).toBe("true");
    expect(container.querySelector(".map-gender-labels")?.textContent).toContain("0% · Female participants");
    expect(container.querySelector(".map-employment-card")?.textContent).not.toContain("flagged missing");
  });
});
