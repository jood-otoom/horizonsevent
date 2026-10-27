import { describe, expect, it } from "vitest";
import mapSnapshotData from "../data/mapSnapshot.json";
import { MAP_GOVERNORATE_IDS, MAP_SECTORS, type MapSnapshot } from "../types/map";
import { sectorPercentages, validateMapSnapshot, wholePercentages } from "./mapMetrics";

const snapshot = mapSnapshotData as MapSnapshot;

describe("bundled workbook map aggregate", () => {
  it("reconciles every national and governorate measure", () => {
    expect(validateMapSnapshot(snapshot)).toBe(snapshot);
    expect(snapshot.nationwide.total).toBe(265);
    expect(snapshot.nationwide.stages).toEqual({ Acceleration: 150, "Go to Market": 91, "Grow+": 24 });
    expect(snapshot.nationwide.gender).toEqual({ female: 142, male: 123, unknown: 0 });
    expect(snapshot.nationwide.employment).toEqual({ startupsWithEmployees: 142, totalEmployees: 762, unknownCount: 2 });
    expect(MAP_GOVERNORATE_IDS).toHaveLength(8);
    expect(snapshot.governorates.aqaba.total).toBe(84);
    expect(snapshot.governorates.karak.total).toBe(46);
    expect(snapshot.governorates.amman.total).toBe(22);
    expect(snapshot.governorates.ajlun).toMatchObject({
      total: 14, gender: { female: 9, male: 5 },
      employment: { startupsWithEmployees: 9, totalEmployees: 35 },
      stages: { Acceleration: 14, "Go to Market": 0, "Grow+": 0 },
    });
    expect(snapshot.source.excludedIconNAStageCount).toBe(15);
    expect(snapshot.source.excludedNAStageCount).toBe(124);
  });

  it("assigns all startups to exactly one displayed sector and rounds to 100%", () => {
    for (const summary of [snapshot.nationwide, ...MAP_GOVERNORATE_IDS.map(id => snapshot.governorates[id])]) {
      expect(MAP_SECTORS.reduce((sum, sector) => sum + summary.sectors[sector.id], 0)).toBe(summary.total);
      expect(Object.values(sectorPercentages(summary)).reduce((sum, percent) => sum + percent, 0)).toBe(100);
    }
    expect(wholePercentages({ first: 1, second: 1, third: 1 }, ["first", "second", "third"]))
      .toEqual({ first: 34, second: 33, third: 33 });
  });

  it("rejects an inconsistent card value", () => {
    const changed = structuredClone(snapshot);
    changed.governorates.ajlun.gender.female += 1;
    expect(() => validateMapSnapshot(changed)).toThrow("reconcile");
  });
});
