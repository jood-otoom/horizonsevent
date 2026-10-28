import { useState } from "react";
import DashboardBackground from "../components/dashboard/DashboardBackground";
import DashboardFooter from "../components/dashboard/DashboardFooter";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import JordanMap from "../components/map/JordanMap";
import { EmploymentCard, GenderCard, SectorsGrid, StagesCard, TotalStartupsCard } from "../components/map/MapStatistics";
import mapSnapshotData from "../data/mapSnapshot.json";
import { createHeatmapScale } from "../lib/mapHeatmap";
import { validateMapSnapshot } from "../lib/mapMetrics";
import { MAP_GOVERNORATE_IDS, type MapGovernorateId, type MapSnapshot } from "../types/map";

const snapshot = validateMapSnapshot(mapSnapshotData as MapSnapshot);
const heatmap = createHeatmapScale(MAP_GOVERNORATE_IDS.map(id => snapshot.governorates[id].total));

export default function MapDashboard() {
  const [selectedGovernorate, setSelectedGovernorate] = useState<MapGovernorateId | "all">("all");
  const summary = selectedGovernorate === "all" ? snapshot.nationwide : snapshot.governorates[selectedGovernorate];
  const selectionName = selectedGovernorate === "all" ? "All Governorates" : snapshot.governorates[selectedGovernorate].name;

  function selectGovernorate(id: MapGovernorateId | "all") {
    setSelectedGovernorate(current => current === id ? "all" : id);
  }

  return <main className="map-shell" aria-label="New Horizons Jordan startup map" onClick={event => {
    if (!(event.target instanceof Element) || event.target.closest(".map-region, .map-pin")) return;
    setSelectedGovernorate("all");
  }}>
    <DashboardBackground variant="map" />
    <DashboardHeader />
    <section className="map-cards" aria-label="Jordan startup statistics">
      <div className="map-card-map">
        <div className="map-card-heading"><span className="map-heading-dot" />JORDAN</div>
        <div className="map-graphic">
          <JordanMap selected={selectedGovernorate} onSelect={selectGovernorate} snapshot={snapshot} heatmap={heatmap} />
        </div>
      </div>
      <div className="map-statistics">
        <TotalStartupsCard summary={summary} selectionName={selectionName} selectionKey={selectedGovernorate}
          onReset={() => setSelectedGovernorate("all")} />
        <div className="map-middle-row">
          <GenderCard summary={summary} />
          <EmploymentCard summary={summary} />
        </div>
        <StagesCard summary={summary} />
        <SectorsGrid summary={summary} />
      </div>
    </section>
    <DashboardFooter />
    <p className="map-geometry-credit">Map boundaries: geoBoundaries JOR ADM1 · ODbL</p>
  </main>;
}
