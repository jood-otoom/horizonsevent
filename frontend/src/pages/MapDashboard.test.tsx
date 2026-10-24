// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MapDashboard from "./MapDashboard";
import { createHeatmapScale } from "../lib/mapHeatmap";
import { parseMapSnapshot } from "../services/mapService";
import { mapRow } from "../../tests/mapFixture";

vi.mock("../hooks/useMapData", () => ({ useMapData: () => ({ status: "ready", snapshot: parseMapSnapshot(mapRow) }) }));
afterEach(cleanup);

describe("Jordan startup map", () => {
  it("colors only the eight published governorates and removes marker dots", () => {
    const { container } = render(<MapDashboard />);
    const map = container.querySelector(".map-jordan-svg");
    expect(map!.querySelectorAll("circle")).toHaveLength(0);
    expect(map!.querySelectorAll(".map-regions path")).toHaveLength(12);
    expect(map!.querySelectorAll(".map-region-inactive")).toHaveLength(4);
    expect(map!.querySelectorAll('[role="button"]')).toHaveLength(8);
    const totals = Object.fromEntries(Object.entries(mapRow.payload.governorates).map(([id, value]) => [id, value.total]));
    const scale = createHeatmapScale(Object.values(totals));
    for (const id of ["amman", "irbid", "ajlun", "jarash", "mafraq", "karak", "aqaba", "maan"]) {
      const expected = document.createElement("span");
      expected.style.fill = scale.colorFor(totals[id]) ?? "";
      expect(screen.getByTestId(`region-${id}`).style.fill).toBe(expected.style.fill);
    }
    expect(screen.getByTestId("region-ajlun").style.fill).toBe(screen.getByTestId("region-irbid").style.fill);
    const originalFill = screen.getByTestId("region-ajlun").style.fill;
    fireEvent.click(screen.getByTestId("region-ajlun"));
    expect(screen.getByTestId("region-ajlun").style.fill).toBe(originalFill);
    expect(map!.querySelectorAll(".map-selected-outline")).toHaveLength(1);
  });

  it("updates all eight governorate counts and resets without navigation", () => {
    const { container } = render(<MapDashboard />);
    expect(screen.getByRole("heading", { name: "All governorates" })).toBeTruthy();
    expect(screen.getByText("266")).toBeTruthy();
    expect(container.querySelector(".map-card-statistics")?.textContent).not.toContain("represented");
    expect(container.querySelector(".map-card-statistics")?.textContent).not.toContain("GOVERNORATES");
    const expected = [
      ["aqaba", "84", ["44", "4", "36"]], ["karak", "46", ["45", "1", "0"]],
      ["mafraq", "44", ["21", "1", "22"]], ["jarash", "38", ["13", "2", "23"]],
      ["amman", "23", ["0", "15", "8"]], ["ajlun", "14", ["14", "0", "0"]],
      ["irbid", "14", ["13", "1", "0"]], ["maan", "3", ["0", "0", "3"]],
    ] as const;
    for (const [id, total, stages] of expected) {
      fireEvent.click(screen.getByTestId(`region-${id}`));
      expect(screen.getByRole("heading", { name: new RegExp(id, "i") })).toBeTruthy();
      expect(screen.getByText(total, { selector: ".map-total strong" })).toBeTruthy();
      const list = container.querySelector(".map-stage-list");
      expect(list?.querySelectorAll("dt")).toHaveLength(3);
      expect([...list!.querySelectorAll("dd")].map(item => item.textContent)).toEqual([...stages]);
      expect(screen.getByTestId(`region-${id}`).classList.contains("is-selected")).toBe(true);
      expect(container.querySelector(".map-card-statistics")?.textContent?.match(new RegExp(id, "gi"))).toHaveLength(1);
      expect(container.querySelector(".map-card-statistics")?.textContent).not.toContain("Selected governorate");
    }
    fireEvent.click(screen.getByRole("button", { name: "All governorates" }));
    expect(container.querySelector(".map-selected-outline")).toBeNull();
    expect(screen.queryByRole("button", { name: "All governorates" })).toBeNull();
    expect(screen.getByText("266")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("92")).toBeTruthy();
  });

  it("supports keyboard activation and exposes selected state", () => {
    render(<MapDashboard />);
    const amman = screen.getByRole("button", { name: /Select Amman governorate/ });
    fireEvent.keyDown(amman, { key: "Enter" });
    expect(amman.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("23", { selector: ".map-total strong" })).toBeTruthy();
    const mafraq = screen.getByRole("button", { name: /Select Mafraq governorate/ });
    fireEvent.keyDown(mafraq, { key: " " });
    expect(mafraq.getAttribute("aria-pressed")).toBe("true");
  });
});
