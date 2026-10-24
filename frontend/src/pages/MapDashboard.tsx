import { useMemo, useState } from "react";
import DashboardBackground from "../components/dashboard/DashboardBackground";
import DashboardFooter from "../components/dashboard/DashboardFooter";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import JordanMap from "../components/map/JordanMap";
import { useMapData } from "../hooks/useMapData";
import { createHeatmapScale } from "../lib/mapHeatmap";
import { MAP_STAGES, type MapGovernorateId } from "../types/map";

export default function MapDashboard() {
  const data = useMapData();
  const [selected, setSelected] = useState<MapGovernorateId | "all">("all");
  const snapshot = data.status === "ready" ? data.snapshot : null;
  const heatmap = useMemo(() => createHeatmapScale(
    snapshot ? Object.values(snapshot.governorates).map(governorate => governorate.total) : [],
  ), [snapshot]);
  const summary = snapshot && (selected === "all" ? snapshot.nationwide : snapshot.governorates[selected]);
  const selectionName = selected === "all" ? "All governorates" : snapshot?.governorates[selected].name;

  return (
    <main className="map-shell" aria-label="New Horizons Jordan startup map">
      <DashboardBackground completeDots />
      <DashboardHeader />
      <section className="map-cards" aria-label="Jordan startup statistics">
        <div className="map-card map-card-map">
          <div className="map-card-heading"><span className="map-heading-dot" />JORDAN</div>
          <div className="map-graphic">
            <JordanMap selected={selected} onSelect={setSelected} snapshot={snapshot} heatmap={heatmap} />
          </div>
        </div>
        <section className="map-card map-card-statistics" aria-live="polite">
          <div className="map-stat-eyebrow">CURRENT SELECTION</div>
          {data.status === "loading" && <p className="map-state-message">Loading published startup statistics…</p>}
          {data.status === "error" && <p className="map-state-message" role="alert">{data.message}</p>}
          {summary && snapshot && <>
            <div className="map-selection-heading">
              <h1>{selectionName}</h1>
              {selected !== "all" && <button type="button" className="map-reset" onClick={() => setSelected("all")}>All governorates</button>}
            </div>
            <div className="map-total"><strong>{summary.total}</strong><span>startups</span></div>
            <div className="map-stat-divider" />
            <h2>PROGRAMME STAGES</h2>
            <dl className="map-stage-list">
              {MAP_STAGES.map(stage => <div key={stage}><dt>{stage}</dt><dd>{summary.stages[stage]}</dd></div>)}
            </dl>
          </>}
        </section>
      </section>
      <DashboardFooter />
      <p className="map-geometry-credit">Map boundaries: geoBoundaries JOR ADM1 · ODbL</p>
    </main>
  );
}
