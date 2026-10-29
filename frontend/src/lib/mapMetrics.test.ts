import { describe, expect, it } from "vitest";
import mapSnapshotData from "../data/mapSnapshot.json";
import { MAP_GOVERNORATE_IDS, MAP_SECTORS, type MapSnapshot } from "../types/map";
import { sectorPercentages, validateMapSnapshot, wholePercentages } from "./mapMetrics";

const snapshot = mapSnapshotData as MapSnapshot;

describe("bundled workbook map aggregate", () => {
  it("reconciles every national and governorate measure", () => {
    expect(validateMapSnapshot(snapshot)).toBe(snapshot);
    expect(snapshot.nationwide.total).toBe(666);
    expect(snapshot.nationwide.gender).toEqual({ female: 427, male: 239, unknown: 0 });
    expect(snapshot.nationwide.employment).toEqual({ startupsWithEmployees: 192, totalEmployees: 628, unknownCount: 0 });
    expect(snapshot.nationwide.sectors).toEqual({
      technologyDigital: 42, greenCleanTech: 87, industryManufacturing: 205,
      healthSocialImpact: 48, educationCreative: 131, commerceServices: 95,
      hospitalityTourism: 36, other: 22,
    });
    expect(MAP_GOVERNORATE_IDS).toHaveLength(12);
    expect(snapshot.nationwide.representedGovernorates).toBe(12);
    expect(Object.keys(snapshot.governorates)).toHaveLength(12);
    expect(Object.fromEntries(Object.entries(snapshot.governorates).map(([id, region]) => [id, region!.total]))).toEqual({
      aqaba: 148, karak: 101, mafraq: 125, jarash: 88, amman: 80, ajlun: 18,
      irbid: 62, maan: 15, balqa: 4, madaba: 1, tafilah: 19, zarqa: 5,
    });
    expect(snapshot.source.uniquenessBasis).toBe("owner-confirmed-one-row-per-startup");
    expect(snapshot.source.genderField).toBe("Women-led");
    expect(snapshot.source.employmentField).toBe("Staff Delta");
    expect(snapshot.source.unclassifiedSectorCount).toBe(22);
  });

  it("assigns each row to one category, including unclassified values, and rounds to 100%", () => {
    for (const summary of [snapshot.nationwide, ...Object.values(snapshot.governorates)]) {
      expect(MAP_SECTORS.reduce((sum, sector) => sum + summary.sectors[sector.id], 0)).toBe(summary.total);
      expect(Object.values(sectorPercentages(summary)).reduce((sum, percent) => sum + percent, 0)).toBe(100);
    }
    expect(wholePercentages({ first: 1, second: 1, third: 1 }, ["first", "second", "third"]))
      .toEqual({ first: 34, second: 33, third: 33 });
  });

  it("rejects an inconsistent card value", () => {
    const changed = structuredClone(snapshot);
    changed.governorates.ajlun!.gender.female += 1;
    expect(() => validateMapSnapshot(changed)).toThrow("reconcile");
  });
});
