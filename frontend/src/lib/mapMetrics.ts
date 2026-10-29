import { MAP_GOVERNORATE_IDS, MAP_GOVERNORATE_NAMES, MAP_SECTORS, type MapGovernorateId, type MapSnapshot, type MapSummary, type MapSectorId } from "../types/map";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function checkSummary(summary: MapSummary, name: string): void {
  const sectorCounts = MAP_SECTORS.map(sector => summary.sectors[sector.id]);
  const genderCounts = [summary.gender.female, summary.gender.male, summary.gender.unknown];
  const employment = summary.employment;
  if (![summary.total, ...sectorCounts, ...genderCounts,
    employment.startupsWithEmployees, employment.totalEmployees, employment.unknownCount].every(isCount) ||
    sum(sectorCounts) !== summary.total ||
    sum(genderCounts) !== summary.total ||
    employment.startupsWithEmployees + employment.unknownCount > summary.total) {
    throw new Error(`Map data for ${name} does not reconcile.`);
  }
}

// The workbook generator is the publication gate; this protects the bundled snapshot
// from accidental manual edits that would make different cards disagree.
export function validateMapSnapshot(snapshot: MapSnapshot): MapSnapshot {
  const regionIds = Object.keys(snapshot.governorates) as MapGovernorateId[];
  if (snapshot.schemaVersion !== 3 || snapshot.source.includedCount !== snapshot.nationwide.total ||
    snapshot.nationwide.representedGovernorates !== regionIds.length ||
    regionIds.some(id => !MAP_GOVERNORATE_IDS.includes(id)) ||
    snapshot.source.sourceRecordCount !== snapshot.source.includedCount ||
    snapshot.source.uniquenessBasis !== "owner-confirmed-one-row-per-startup" ||
    snapshot.source.genderField !== "Women-led" || snapshot.source.employmentField !== "Staff Delta" ||
    snapshot.source.unclassifiedSectorCount !== snapshot.nationwide.sectors.other ||
    sum(Object.values(snapshot.source.unclassifiedSectorLabels)) !== snapshot.source.unclassifiedSectorCount) {
    throw new Error("Map source version or count is invalid.");
  }
  checkSummary(snapshot.nationwide, "nationwide");
  for (const id of regionIds) {
    const region = snapshot.governorates[id];
    if (!region || region.total === 0 || region.name !== MAP_GOVERNORATE_NAMES[id]) {
      throw new Error(`Map governorate ${id} is missing or mislabeled.`);
    }
    checkSummary(region, id);
  }
  const fields = ["total", "gender.female", "gender.male", "gender.unknown",
    "employment.startupsWithEmployees", "employment.totalEmployees", "employment.unknownCount",
    ...MAP_SECTORS.map(sector => `sectors.${sector.id}`)];
  for (const field of fields) {
    const parts = field.split(".");
    const value = (summary: MapSummary): number => parts.reduce<unknown>((item, part) =>
      (item as Record<string, unknown>)[part], summary) as number;
    if (sum(regionIds.map(id => value(snapshot.governorates[id]!))) !== value(snapshot.nationwide)) {
      throw new Error(`Map governorates do not reconcile for ${field}.`);
    }
  }
  return snapshot;
}

// Largest-remainder rounding gives whole percentages that add to exactly 100.
export function wholePercentages<T extends string>(counts: Record<T, number>, order: readonly T[]): Record<T, number> {
  const total = sum(order.map(id => counts[id]));
  const result = {} as Record<T, number>;
  if (total === 0) {
    for (const id of order) result[id] = 0;
    return result;
  }
  const fractions = order.map((id, index) => ({ id, index, raw: counts[id] * 100 / total }));
  for (const item of fractions) result[item.id] = Math.floor(item.raw);
  const remaining = 100 - sum(order.map(id => result[id]));
  fractions.sort((a, b) => (b.raw - Math.floor(b.raw)) - (a.raw - Math.floor(a.raw)) || a.index - b.index);
  for (const item of fractions.slice(0, remaining)) result[item.id] += 1;
  return result;
}

export function sectorPercentages(summary: MapSummary): Record<MapSectorId, number> {
  return wholePercentages(summary.sectors, MAP_SECTORS.map(sector => sector.id));
}
