import type { CSSProperties } from "react";
import { sectorPercentages, wholePercentages } from "../../lib/mapMetrics";
import { MAP_SECTORS, MAP_STAGES, type MapSummary } from "../../types/map";
import { MapIcon } from "./MapIcon";

function Count({ value }: { value: number }) {
  return <span key={value} className="map-count-transition">{value.toLocaleString("en-US")}</span>;
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
    <div className="map-total-figure"><strong><Count value={summary.total} /></strong><span>startups</span></div>
  </section>;
}

export function GenderCard({ summary }: { summary: MapSummary }) {
  const percentages = wholePercentages(summary.gender, ["female", "male", "unknown"]);
  return <section className="map-stat-card map-gender-card" aria-labelledby="map-gender-title">
    <h2 id="map-gender-title">Gender disaggregation</h2>
    <div className="map-gender-bar" aria-label={`${summary.gender.female} female participants, ${summary.gender.male} male participants${summary.gender.unknown ? `, ${summary.gender.unknown} unknown` : ""}`}>
      <div className="map-gender-segment map-gender-female" data-compact={percentages.female < 24} data-empty={percentages.female === 0}
        style={{ width: `${percentages.female}%` }}>
        <MapIcon name="female" size="large" /><strong><Count value={percentages.female} />%</strong>
      </div>
      <div className="map-gender-segment map-gender-male" data-compact={percentages.male < 24} data-empty={percentages.male === 0}
        style={{ width: `${percentages.male}%` }}>
        <MapIcon name="male" size="large" /><strong><Count value={percentages.male} />%</strong>
      </div>
      {percentages.unknown > 0 && <div className="map-gender-unknown" style={{ width: `${percentages.unknown}%` }} />}
    </div>
    <div className="map-gender-labels">
      <span>{percentages.female === 0 && <strong>0% · </strong>}Female participants</span>
      <span>{percentages.male === 0 && <strong>0% · </strong>}Male participants</span>
    </div>
    {summary.gender.unknown > 0 && <p className="map-data-note">{summary.gender.unknown} gender value{summary.gender.unknown === 1 ? "" : "s"} unavailable</p>}
  </section>;
}

export function EmploymentCard({ summary }: { summary: MapSummary }) {
  const { startupsWithEmployees, totalEmployees } = summary.employment;
  return <section className="map-stat-card map-employment-card" aria-labelledby="map-employment-title">
    <h2 id="map-employment-title">Employment</h2>
    <div className="map-employment-metrics">
      <div><MapIcon name="building" size="large" /><strong><Count value={startupsWithEmployees} /></strong><span>startups<br />employing people</span></div>
      <div><MapIcon name="people" size="large" /><strong><Count value={totalEmployees} /></strong><span>total employees<br />recorded</span></div>
    </div>
  </section>;
}

const STAGE_ICONS = ["rocket", "bars", "sprout"] as const;

export function StagesCard({ summary }: { summary: MapSummary }) {
  return <section className="map-stat-card map-stages-card" aria-labelledby="map-stages-title">
    <h2 id="map-stages-title">Programme stages</h2>
    <div className="map-stage-journey">
      {MAP_STAGES.map((stage, index) => <div className={`map-stage-step map-stage-step-${index + 1}`} key={stage}>
        <MapIcon name={STAGE_ICONS[index]} size="extraLarge" />
        <div><strong><Count value={summary.stages[stage]} /></strong><span>{stage}</span></div>
      </div>)}
    </div>
  </section>;
}

export function SectorsGrid({ summary }: { summary: MapSummary }) {
  const percentages = sectorPercentages(summary);
  const maxPercentage = Math.max(0, ...MAP_SECTORS.map(sector => percentages[sector.id]));
  return <section className="map-stat-card map-sectors-card" aria-labelledby="map-sectors-title">
    <h2 id="map-sectors-title">Sectors</h2>
    <div className="map-sector-grid">
      {MAP_SECTORS.map(sector => {
        const count = summary.sectors[sector.id];
        const ratio = maxPercentage ? percentages[sector.id] / maxPercentage : 0;
        // Two contrast-safe ramps keep small text legible as cards move from blush to crimson.
        const dark = ratio >= .75;
        const tone = dark ? Math.round(75 + 25 * (ratio - .75) / .25) : Math.round(40 * ratio / .75);
        return <div className="map-sector" key={sector.id}
          style={{ "--map-sector-tone": `${tone}%` } as CSSProperties}
          data-contrast={dark ? "light" : "dark"}
          title={`${count} ${count === 1 ? "startup" : "startups"} in ${sector.label}`}>
          <MapIcon name={sector.icon} size="large" />
          <div><strong><Count value={percentages[sector.id]} />%</strong><span>{sector.label}</span></div>
        </div>;
      })}
    </div>
  </section>;
}
