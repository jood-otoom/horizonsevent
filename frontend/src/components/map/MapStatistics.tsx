import type { CSSProperties } from "react";
import { sectorPercentages, wholePercentages } from "../../lib/mapMetrics";
import { MAP_SECTORS, type MapSummary } from "../../types/map";
import { DashboardIcon } from "../ui/DashboardIcon";

const metricIconStyle: CSSProperties = {
  width: "clamp(48px, 3.6cqw, 132px)",
  height: "clamp(48px, 3.6cqw, 132px)",
};

const sectorIconStyle: CSSProperties = {
  width: "clamp(34px, 2.8cqw, 104px)",
  height: "clamp(34px, 2.8cqw, 104px)",
};

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
    <div className="map-metric-pair" aria-label={`${summary.gender.female} female-led startups, ${summary.gender.male} male-led startups${summary.gender.unknown ? `, ${summary.gender.unknown} leadership values unknown` : ""}`}>
      <div className="map-metric-segment map-metric-coral">
        <DashboardIcon name="female" size={44} style={metricIconStyle} />
        <strong><Count value={percentages.female} />%</strong>
        <span>Female-led</span>
      </div>
      <div className="map-metric-segment map-metric-burgundy">
        <DashboardIcon name="male" size={44} style={metricIconStyle} />
        <strong><Count value={percentages.male} />%</strong>
        <span>Male-led</span>
      </div>
    </div>
    {summary.gender.unknown > 0 && <p className="map-data-note">{summary.gender.unknown} leadership value{summary.gender.unknown === 1 ? "" : "s"} unavailable; percentages include unknown values</p>}
  </section>;
}

export function EmploymentCard({ summary }: { summary: MapSummary }) {
  const { startupsWithEmployees, totalEmployees } = summary.employment;
  return <section className="map-stat-card map-employment-card" aria-labelledby="map-employment-title">
    <h2 id="map-employment-title">Employment</h2>
    <div className="map-metric-pair" aria-label={`${startupsWithEmployees} startups employing, ${totalEmployees} total employees`}>
      <div className="map-metric-segment map-metric-coral">
        <DashboardIcon name="employment-startups" size={44} style={metricIconStyle} />
        <strong><Count value={startupsWithEmployees} /></strong>
        <span>Startups employing</span>
      </div>
      <div className="map-metric-segment map-metric-burgundy">
        <DashboardIcon name="employment-people" size={44} style={metricIconStyle} />
        <strong><Count value={totalEmployees} /></strong>
        <span>Total employees</span>
      </div>
    </div>
  </section>;
}

export function SectorsGrid({ summary }: { summary: MapSummary }) {
  const percentages = sectorPercentages(summary);
  const maxPercentage = Math.max(0, ...MAP_SECTORS.map(sector => percentages[sector.id]));
  return <section className="map-stat-card map-sectors-card" aria-labelledby="map-sectors-title">
    <div className="map-sectors-head">
      <h2 id="map-sectors-title">Sectors</h2>
    </div>
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
          <DashboardIcon name={sector.icon} size={40} style={sectorIconStyle} />
          <div><strong>{count > 0 && percentages[sector.id] === 0 ? "<1%" : <><Count value={percentages[sector.id]} />%</>}</strong><span>{sector.label}</span></div>
        </div>;
      })}
    </div>
  </section>;
}
