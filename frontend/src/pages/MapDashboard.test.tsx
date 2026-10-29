// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import mapSnapshotData from "../data/mapSnapshot.json";
import { sectorPercentages, wholePercentages } from "../lib/mapMetrics";
import { MAP_GOVERNORATE_IDS, MAP_SECTORS, type MapSnapshot, type MapSummary } from "../types/map";
import MapDashboard from "./MapDashboard";

afterEach(cleanup);

const snapshot = mapSnapshotData as MapSnapshot;

function texts(container: Element, selector: string): string[] {
  return [...container.querySelectorAll(selector)].map(element => element.textContent?.trim() ?? "");
}

function expectStatistics(container: HTMLElement, name: string, summary: MapSummary) {
  const panel = container.querySelector(".map-statistics")!;
  expect(panel.querySelector(".map-selection span")?.textContent).toBe(name);
  expect(panel.querySelector(".map-total-figure strong")?.textContent).toBe(summary.total.toLocaleString("en-US"));

  const gender = panel.querySelector(".map-gender-card")!;
  const percentages = wholePercentages(summary.gender, ["female", "male", "unknown"]);
  expect(gender.querySelector(".map-metric-pair")?.getAttribute("aria-label")).toContain(`${summary.gender.female} female-led startups, ${summary.gender.male} male-led startups`);
  expect(texts(gender, ".map-metric-segment strong")).toEqual([`${percentages.female}%`, `${percentages.male}%`]);
  expect(texts(gender, ".map-metric-segment > span:last-child")).toEqual(["Female-led", "Male-led"]);

  const employment = panel.querySelector(".map-employment-card")!;
  expect(texts(employment, ".map-metric-segment strong")).toEqual([
    String(summary.employment.startupsWithEmployees), String(summary.employment.totalEmployees),
  ]);
  expect(texts(employment, ".map-metric-segment > span:last-child")).toEqual(["Startups employing", "Total employees"]);
  expect(gender.querySelector(".map-metric-pair")?.className).toBe(employment.querySelector(".map-metric-pair")?.className);

  const sectors = panel.querySelector(".map-sectors-card")!;
  const sectorPercents = sectorPercentages(summary);
  expect(texts(sectors, ".map-sector > div > span")).toEqual(MAP_SECTORS.map(sector => sector.label));
  expect(texts(sectors, ".map-sector strong")).toEqual(MAP_SECTORS.map(sector =>
    summary.sectors[sector.id] > 0 && sectorPercents[sector.id] === 0 ? "<1%" : `${sectorPercents[sector.id]}%`,
  ));
  expect([...sectors.querySelectorAll(".map-sector")].map(tile => tile.getAttribute("title"))).toEqual(
    MAP_SECTORS.map(sector => `${summary.sectors[sector.id]} ${summary.sectors[sector.id] === 1 ? "startup" : "startups"} in ${sector.label}`),
  );
  expect(Object.values(sectorPercents).reduce((sum, percent) => sum + percent, 0)).toBe(100);
  expect(sectors.querySelector(".map-sector-note")).toBeNull();
}

describe("Jordan startup map", () => {
  it("shows the approved total, eight sectors and shared public branding", () => {
    const { container } = render(<MapDashboard />);
    expect(snapshot.nationwide.total).toBe(666);
    expect(snapshot.nationwide.representedGovernorates).toBe(12);
    expectStatistics(container, "All Governorates", snapshot.nationwide);
    expect(container.querySelectorAll(".map-sector")).toHaveLength(8);
    expect(container.querySelector(".map-sector:last-child")?.getAttribute("title")).toBe("22 startups in Other");
    expect(container.querySelector(".map-sector:last-child strong")?.textContent).toBe("3%");
    expect(container.querySelector<HTMLImageElement>(".dashboard-corner-flower")?.getAttribute("src")).toContain("horizon-flower.svg");
    expect(container.querySelector(".dashboard-background")).toBeNull();
    expect(container.querySelector(".map-card-heading")).toBeNull();
    expect(container.querySelector(".map-stages-card")).toBeNull();
    expect(container.querySelector(".map-geometry-credit")).toBeNull();
    expect(container.textContent).not.toContain("JORDAN");
    expect(container.textContent).not.toContain("Programme stages");
    expect(container.textContent).not.toContain("Map boundaries");
    expect([...container.querySelectorAll<HTMLImageElement>(".dashboard-header img")].map(img => img.alt)).toEqual([
      "German-Jordan Cooperation", "Co-funded by the European Union", "Ministry of Digital Economy and Entrepreneurship",
    ]);
    expect([...container.querySelectorAll<HTMLImageElement>(".dashboard-footer img")].map(img => img.alt)).toEqual([
      "GIZ", "ICON Institute", "PEM Consult",
    ]);
  });

  it("updates every card for Ajloun, Amman and newly represented Zarqa, then resets", () => {
    const { container } = render(<MapDashboard />);
    for (const id of ["ajlun", "amman", "zarqa"] as const) {
      fireEvent.click(screen.getByTestId(`region-${id}`));
      expectStatistics(container, snapshot.governorates[id]!.name, snapshot.governorates[id]!);
      expect(screen.getByTestId(`region-${id}`).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId(`pin-${id}`).classList.contains("is-selected")).toBe(true);
    }
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expectStatistics(container, "All Governorates", snapshot.nationwide);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("provides twelve pins, a ranked heatmap and keyboard selection", () => {
    const { container } = render(<MapDashboard />);
    const map = screen.getByRole("group", { name: "Jordan governorates map" });
    expect(map.querySelectorAll(".map-regions path")).toHaveLength(12);
    expect(map.querySelectorAll(".map-region.is-neutral")).toHaveLength(0);
    expect(map.querySelectorAll(".map-pin")).toHaveLength(12);
    expect(map.querySelectorAll("text")).toHaveLength(0);
    for (const id of MAP_GOVERNORATE_IDS) expect(screen.getByTestId(`pin-${id}`)).toBeTruthy();
    expect(screen.getByTestId("region-aqaba").style.fill).toBe("var(--map-heat-9)");
    expect(screen.getByTestId("region-madaba").style.fill).toBe("var(--map-heat-1)");
    const zarqa = screen.getByRole("button", { name: "Zarqa, 5 startups" });
    fireEvent.keyDown(zarqa, { key: "Enter" });
    expectStatistics(container, "Zarqa", snapshot.governorates.zarqa!);
    fireEvent.keyDown(zarqa, { key: " " });
    expectStatistics(container, "All Governorates", snapshot.nationwide);
  });

  it("resets on re-click and outside click without recoloring the map", () => {
    const { container } = render(<MapDashboard />);
    const aqabaFill = screen.getByTestId("region-aqaba").style.fill;
    fireEvent.click(screen.getByTestId("region-aqaba"));
    expectStatistics(container, "Aqaba", snapshot.governorates.aqaba!);
    expect(screen.getByTestId("region-aqaba").style.fill).toBe(aqabaFill);
    fireEvent.click(screen.getByTestId("region-aqaba"));
    expectStatistics(container, "All Governorates", snapshot.nationwide);
    fireEvent.click(screen.getByTestId("pin-ajlun"));
    expectStatistics(container, "Ajloun", snapshot.governorates.ajlun!);
    fireEvent.click(container.querySelector(".map-sectors-card")!);
    expectStatistics(container, "All Governorates", snapshot.nationwide);
  });

  it("uses approved PNG icons and a clean white pin dot", () => {
    const { container } = render(<MapDashboard />);
    const metricIcons = container.querySelectorAll(".map-metric-pair .dashboard-icon");
    expect(metricIcons).toHaveLength(4);
    expect([...metricIcons].map(icon => icon.querySelector("img")?.getAttribute("src"))).toEqual([
      "/icons/png/female.png", "/icons/png/male.png",
      "/icons/png/employment_startups.png", "/icons/png/employment_people.png",
    ]);
    expect(container.querySelectorAll(".map-sector .dashboard-icon")).toHaveLength(8);
    expect(container.querySelectorAll(".map-sector .dashboard-icon img")).toHaveLength(8);
    expect(container.querySelector(".map-sector:last-child .dashboard-icon img")?.getAttribute("src")).toBe("/icons/png/other.png");
    expect(container.querySelector(".map-statistics [style*='mask-image']")).toBeNull();
    expect(container.querySelector(".map-pin-inner-halo")).toBeNull();
    expect(container.querySelectorAll(".map-pin-core")).toHaveLength(12);
    expect(container.querySelectorAll(".map-pin-rim-glow")).toHaveLength(12);
  });
});
