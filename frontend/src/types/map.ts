export const MAP_GOVERNORATE_IDS = [
  "aqaba", "karak", "mafraq", "jarash", "amman", "ajlun", "irbid", "maan",
] as const;

export const MAP_STAGES = ["Acceleration", "Grow+", "Go to Market"] as const;

export type MapGovernorateId = typeof MAP_GOVERNORATE_IDS[number];
export type MapStage = typeof MAP_STAGES[number];
export type StageCounts = Record<MapStage, number>;

export const MAP_GOVERNORATE_NAMES: Record<MapGovernorateId, string> = {
  aqaba: "Aqaba", karak: "Karak", mafraq: "Mafraq", jarash: "Jarash",
  amman: "Amman", ajlun: "Ajlun", irbid: "Irbid", maan: "Maan",
};

export interface MapSummary {
  total: number;
  stages: StageCounts;
}

export interface GovernorateSummary extends MapSummary {
  name: string;
}

export interface MapSnapshot {
  eventId: 17135;
  sourceRecordCount: number;
  createdAt: string;
  nationwide: MapSummary & { representedGovernorates: number };
  governorates: Record<MapGovernorateId, GovernorateSummary>;
}
