export const MAP_GOVERNORATE_IDS = [
  "aqaba", "karak", "mafraq", "jarash", "amman", "ajlun", "irbid", "maan",
  "balqa", "madaba", "tafilah", "zarqa",
] as const;

export const MAP_SECTORS = [
  { id: "technologyDigital", label: "Technology & Digital", icon: "technology" },
  { id: "greenCleanTech", label: "Green & Clean Tech", icon: "green-tech" },
  { id: "industryManufacturing", label: "Industry & Manufacturing", icon: "manufacturing" },
  { id: "healthSocialImpact", label: "Health & Social Impact", icon: "health" },
  { id: "educationCreative", label: "Education & Creative", icon: "education" },
  { id: "commerceServices", label: "Commerce & Services", icon: "commerce" },
  { id: "hospitalityTourism", label: "Hospitality & Tourism", icon: "hospitality" },
  { id: "other", label: "Other", icon: "other" },
] as const;

export type MapGovernorateId = typeof MAP_GOVERNORATE_IDS[number];
export type MapSectorId = typeof MAP_SECTORS[number]["id"];
export type SectorCounts = Record<MapSectorId, number>;

export const MAP_GOVERNORATE_NAMES: Record<MapGovernorateId, string> = {
  aqaba: "Aqaba", karak: "Karak", mafraq: "Mafraq", jarash: "Jarash",
  amman: "Amman", ajlun: "Ajloun", irbid: "Irbid", maan: "Ma'an",
  balqa: "Balqa", madaba: "Madaba", tafilah: "Tafilah", zarqa: "Zarqa",
};

export interface MapSummary {
  total: number;
  gender: { female: number; male: number; unknown: number };
  employment: { startupsWithEmployees: number; totalEmployees: number; unknownCount: number };
  sectors: SectorCounts;
}

export interface GovernorateSummary extends MapSummary {
  name: string;
}

export interface MapSnapshot {
  schemaVersion: 3;
  source: {
    workbook: string;
    sheet: string;
    sha256: string;
    sourceRecordCount: number;
    includedCount: number;
    uniquenessBasis: "owner-confirmed-one-row-per-startup";
    genderField: "Women-led";
    employmentField: "Staff Delta";
    unclassifiedSectorCount: number;
    unclassifiedSectorLabels: Record<string, number>;
  };
  nationwide: MapSummary & { representedGovernorates: number };
  governorates: Partial<Record<MapGovernorateId, GovernorateSummary>>;
}
