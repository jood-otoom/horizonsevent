import type { ReactNode } from "react";
import { sectorPercentages, wholePercentages } from "../../lib/mapMetrics";
import { MAP_SECTORS, MAP_STAGES, type MapSectorId, type MapSummary } from "../../types/map";

type IconName = "female" | "male" | "building" | "people" | "rocket" | "bars" | "sprout" |
  "monitor" | "leaf" | "industry" | "heart" | "book" | "briefcase" | "utensils" | "more";

function MapIcon({ name, className = "" }: { name: IconName; className?: string }) {
  let shape: ReactNode;
  switch (name) {
    case "female":
      shape = <><circle cx="24" cy="12" r="7" fill="currentColor" /><path d="M17 13c-5 4-7 12-7 21h28c0-9-2-17-7-21l-3 8-4-3-4 3zM14 40c1-9 5-13 10-13s9 4 10 13" fill="currentColor" /></>;
      break;
    case "male":
      shape = <><circle cx="24" cy="12" r="7" fill="currentColor" /><path d="M12 40c1-11 5-16 12-16s11 5 12 16z" fill="currentColor" /><path d="m21 24 3 8 3-8-3 3z" fill="var(--map-gender-male)" /></>;
      break;
    case "building":
      shape = <><path d="M6 41V16h14v25M20 41V7h17v34M37 41V23h5v18M3 41h42" /><path d="M11 22h4m-4 6h4m-4 6h4M26 14h5m-5 7h5m-5 7h5m-5 7h5" /></>;
      break;
    case "people":
      shape = <><circle cx="24" cy="13" r="6" /><circle cx="9" cy="19" r="4" /><circle cx="39" cy="19" r="4" /><path d="M13 39v-7c0-7 5-11 11-11s11 4 11 11v7zM2 39v-8c0-4 3-7 7-7h3M46 39v-8c0-4-3-7-7-7h-3" /></>;
      break;
    case "rocket":
      shape = <><path d="M15 31c2-9 8-18 24-23-2 16-11 22-20 24l-4-1zM15 31l-5 7 8-3M21 27l-6-6-6 1-4 10 10-3M30 33l-3 10-8 2-1-10" /><circle cx="29" cy="18" r="3" /></>;
      break;
    case "bars":
      shape = <><path d="M7 40V28h7v12M20 40V21h7v19M33 40V10h7v30M4 40h40" /></>;
      break;
    case "sprout":
      shape = <><path d="M24 42V23M24 29c-7-9-16-9-18-19 11 0 18 4 18 15M24 28c6-10 13-13 19-13-2 11-8 15-19 16" /></>;
      break;
    case "monitor":
      shape = <><rect x="5" y="7" width="38" height="27" rx="2" /><path d="M24 34v8M14 42h20" /></>;
      break;
    case "leaf":
      shape = <><path d="M8 31C9 16 25 9 42 7c-1 18-8 32-24 32-7 0-11-4-10-8zM8 43c8-14 18-23 31-31" /></>;
      break;
    case "industry":
      shape = <><path d="M7 42V25l10 6V19l11 8V11h12v31zM4 42h40M12 36h3m8 0h3m9 0h3" /></>;
      break;
    case "heart":
      shape = <path d="M24 40 7 24C-1 15 11 4 20 11l4 4 4-4c9-7 21 4 13 13z" />;
      break;
    case "book":
      shape = <><path d="M24 41c-5-4-12-5-19-4V9c7-1 14 0 19 4v28zM24 41c5-4 12-5 19-4V9c-7-1-14 0-19 4v28z" /></>;
      break;
    case "briefcase":
      shape = <><rect x="5" y="15" width="38" height="27" rx="3" /><path d="M17 15v-6h14v6M5 27c10 6 28 6 38 0M21 27h6" /></>;
      break;
    case "utensils":
      shape = <><path d="M7 6v17c0 5 4 7 8 7s8-2 8-7V6M15 6v36M40 42V6c-8 4-10 12-10 20h10" /></>;
      break;
    case "more":
      shape = <><circle cx="10" cy="24" r="4" fill="currentColor" /><circle cx="24" cy="24" r="4" fill="currentColor" /><circle cx="38" cy="24" r="4" fill="currentColor" /></>;
      break;
  }
  return <svg className={className} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>;
}

function Count({ value, selection }: { value: number; selection: string }) {
  return <span key={selection} className="map-count-transition">{value.toLocaleString("en-US")}</span>;
}

export function TotalStartupsCard({ summary, selectionName, selectionKey, onReset }: {
  summary: MapSummary; selectionName: string; selectionKey: string; onReset: () => void;
}) {
  return <section className="map-stat-card map-total-card" aria-labelledby="map-total-title">
    <div className="map-total-card-top">
      <h2 id="map-total-title">Total number of startups</h2>
      <div className="map-selection">
        <span aria-live="polite">{selectionName}</span>
        {selectionKey !== "all" && <button type="button" onClick={onReset}>Show all</button>}
      </div>
    </div>
    <div className="map-total-figure"><strong><Count value={summary.total} selection={selectionKey} /></strong><span>startups</span></div>
  </section>;
}

export function GenderCard({ summary, selectionKey }: { summary: MapSummary; selectionKey: string }) {
  const percentages = wholePercentages(summary.gender, ["female", "male", "unknown"]);
  return <section className="map-stat-card map-gender-card" aria-labelledby="map-gender-title">
    <h2 id="map-gender-title">Gender disaggregation</h2>
    <div className="map-gender-bar" aria-label={`${summary.gender.female} female participants, ${summary.gender.male} male participants${summary.gender.unknown ? `, ${summary.gender.unknown} unknown` : ""}`}>
      <div className="map-gender-segment map-gender-female" style={{ width: `${percentages.female}%` }}>
        <MapIcon name="female" /><strong><Count value={percentages.female} selection={selectionKey} />%</strong>
      </div>
      <div className="map-gender-segment map-gender-male" style={{ width: `${percentages.male}%` }}>
        <MapIcon name="male" /><strong><Count value={percentages.male} selection={selectionKey} />%</strong>
      </div>
      {percentages.unknown > 0 && <div className="map-gender-unknown" style={{ width: `${percentages.unknown}%` }} />}
    </div>
    <div className="map-gender-labels"><span>Female participants</span><span>Male participants</span></div>
    {summary.gender.unknown > 0 && <p className="map-data-note">{summary.gender.unknown} gender value{summary.gender.unknown === 1 ? "" : "s"} unavailable</p>}
  </section>;
}

export function EmploymentCard({ summary, selectionKey }: { summary: MapSummary; selectionKey: string }) {
  const { startupsWithEmployees, totalEmployees, unknownCount } = summary.employment;
  return <section className="map-stat-card map-employment-card" aria-labelledby="map-employment-title">
    <h2 id="map-employment-title">Employment</h2>
    <div className="map-employment-metrics">
      <div><MapIcon name="building" /><strong><Count value={startupsWithEmployees} selection={selectionKey} /></strong><span>startups<br />employing people</span></div>
      <div><MapIcon name="people" /><strong><Count value={totalEmployees} selection={selectionKey} /></strong><span>total employees<br />recorded</span></div>
    </div>
    {unknownCount > 0 && <p className="map-data-note">{unknownCount} employment value{unknownCount === 1 ? "" : "s"} flagged missing</p>}
  </section>;
}

const STAGE_ICONS = ["rocket", "bars", "sprout"] as const;

export function StagesCard({ summary, selectionKey }: { summary: MapSummary; selectionKey: string }) {
  return <section className="map-stat-card map-stages-card" aria-labelledby="map-stages-title">
    <h2 id="map-stages-title">Programme stages</h2>
    <div className="map-stage-journey">
      {MAP_STAGES.map((stage, index) => <div className={`map-stage-step map-stage-step-${index + 1}`} key={stage}>
        <MapIcon name={STAGE_ICONS[index]} />
        <div><strong><Count value={summary.stages[stage]} selection={selectionKey} /></strong><span>{stage}</span></div>
      </div>)}
    </div>
  </section>;
}

export function SectorsGrid({ summary, selectionKey }: { summary: MapSummary; selectionKey: string }) {
  const percentages = sectorPercentages(summary);
  return <section className="map-stat-card map-sectors-card" aria-labelledby="map-sectors-title">
    <h2 id="map-sectors-title">Sectors</h2>
    <div className="map-sector-grid">
      {MAP_SECTORS.map(sector => <div className="map-sector" key={sector.id}
        title={`${summary.sectors[sector.id]} ${summary.sectors[sector.id] === 1 ? "startup" : "startups"} in ${sector.label}`}>
        <MapIcon name={sector.icon} />
        <div><strong><Count value={percentages[sector.id as MapSectorId]} selection={selectionKey} />%</strong><span>{sector.label}</span></div>
      </div>)}
    </div>
  </section>;
}
