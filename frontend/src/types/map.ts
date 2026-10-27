export const MAP_GOVERNORATE_IDS = [
  "aqaba", "karak", "mafraq", "jarash", "amman", "ajlun", "irbid", "maan",
] as const;

export const MAP_STAGES = ["Acceleration", "Go to Market", "Grow+"] as const;

export const MAP_SECTORS = [
  { id: "technologyDigital", label: "Technology & Digital", icon: "monitor" },
  { id: "greenCleanTech", label: "Green & Clean Tech", icon: "leaf" },
  { id: "industryManufacturing", label: "Industry & Manufacturing", icon: "industry" },
  { id: "healthSocialImpact", label: "Health & Social Impact", icon: "heart" },
  { id: "educationCreative", label: "Education & Creative", icon: "book" },
  { id: "commerceServices", label: "Commerce & Services", icon: "briefcase" },
  { id: "hospitalityTourism", label: "Hospitality & Tourism", icon: "utensils" },
  { id: "other", label: "Other", icon: "more" },
] as const;

export type MapGovernorateId = typeof MAP_GOVERNORATE_IDS[number];
export type MapStage = typeof MAP_STAGES[number];
export type MapSectorId = typeof MAP_SECTORS[number]["id"];
export type StageCounts = Record<MapStage, number>;
export type SectorCounts = Record<MapSectorId, number>;

export const MAP_GOVERNORATE_NAMES: Record<MapGovernorateId, string> = {
  aqaba: "Aqaba", karak: "Karak", mafraq: "Mafraq", jarash: "Jarash",
  amman: "Amman", ajlun: "Ajloun", irbid: "Irbid", maan: "Ma'an",
};

export interface MapSummary {
  total: number;
  gender: { female: number; male: number; unknown: number };
  employment: { startupsWithEmployees: number; totalEmployees: number; unknownCount: number };
  stages: StageCounts;
  sectors: SectorCounts;
}

export interface GovernorateSummary extends MapSummary {
  name: string;
}

export interface MapSnapshot {
  schemaVersion: 2;
  source: {
    workbook: string;
    sheet: string;
    sha256: string;
    sourceRecordCount: number;
    includedCount: number;
    excludedNAStageCount: number;
    excludedIconNAStageCount: number;
    excludedMissingStageCount: number;
    deduplicatedRowCount: number;
    qualityWarnings: {
      flaggedRecordCount: number;
      byReason: Record<string, number>;
      sectorMissingFlagWithCategoryCount: number;
    };
  };
  nationwide: MapSummary & { representedGovernorates: number };
  governorates: Record<MapGovernorateId, GovernorateSummary>;
}
