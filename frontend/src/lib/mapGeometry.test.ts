import { describe, expect, it } from "vitest";
import { mapRegions, pointInPolygon } from "./mapGeometry";

describe("Jordan governorate map geometry", () => {
  it("places one stable interior pin point in each of the twelve GeoJSON governorates", () => {
    expect(mapRegions).toHaveLength(12);
    expect(mapRegions.filter(region => region.selectable)).toHaveLength(12);
    expect(new Set(mapRegions.map(region => region.id)).size).toBe(12);
    expect(mapRegions.map(region => region.id).sort()).toEqual([
      "ajlun", "amman", "aqaba", "balqa", "irbid", "jarash", "karak", "maan",
      "madaba", "mafraq", "tafilah", "zarqa",
    ].sort());
    for (const region of mapRegions) {
      expect(region.polygons.some(polygon => pointInPolygon(region.point, polygon)), region.name).toBe(true);
      expect(region.point.every(Number.isFinite)).toBe(true);
    }
  });
});
