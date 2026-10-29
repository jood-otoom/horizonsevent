import { mapRegions } from "../../lib/mapGeometry";
import type { HeatmapScale } from "../../lib/mapHeatmap";
import type { MapGovernorateId, MapSnapshot } from "../../types/map";

interface Props {
  selected: MapGovernorateId | "all";
  onSelect: (id: MapGovernorateId | "all") => void;
  snapshot: MapSnapshot;
  heatmap: HeatmapScale;
}

const PIN_PATH = "M0 9C-4.5 2.5-9.5-2.6-9.5-10.3a9.5 9.5 0 0 1 19 0C9.5-2.6 4.5 2.5 0 9Z";

export default function JordanMap({ selected, onSelect, snapshot, heatmap }: Props) {
  return <svg className="map-jordan-svg" viewBox="35 30 530 590" role="group" aria-label="Jordan governorates map"
    onClick={() => onSelect("all")}>
    <defs>
      <radialGradient id="map-pin-halo" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="var(--brand-primary)" stopOpacity=".22" />
        <stop offset=".52" stopColor="var(--brand-primary)" stopOpacity=".1" />
        <stop offset="1" stopColor="var(--brand-primary)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <g className="map-regions">
      {mapRegions.map(region => {
        const id = region.id as MapGovernorateId;
        const total = region.selectable ? snapshot.governorates[id]?.total : undefined;
        const selectable = region.selectable && total !== undefined && total > 0;
        const isSelected = selected === region.id;
        return <path key={region.id} d={region.path}
          className={`map-region ${selectable ? "is-selectable" : "is-neutral"} ${isSelected ? "is-selected" : ""} ${selected !== "all" && !isSelected ? "is-dimmed" : ""}`}
          style={{ fill: heatmap.colorFor(total) ?? undefined }}
          role={selectable ? "button" : undefined}
          tabIndex={selectable ? 0 : undefined}
          aria-label={selectable ? `${region.name}, ${total} ${total === 1 ? "startup" : "startups"}` : undefined}
          aria-pressed={selectable ? isSelected : undefined}
          onClick={event => {
            if (!selectable) return;
            event.stopPropagation();
            onSelect(id);
          }}
          onKeyDown={event => {
            if (!selectable || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            onSelect(id);
          }}
          data-testid={`region-${region.id}`}><title>{`${region.name}${total === undefined ? "" : ` — ${total} ${total === 1 ? "startup" : "startups"}`}`}</title></path>;
      })}
    </g>
    <g className="map-pins" aria-hidden="true">
      {mapRegions.filter(region => region.selectable && (snapshot.governorates[region.id as MapGovernorateId]?.total ?? 0) > 0)
        .sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
        .map(region => {
        const id = region.id as MapGovernorateId;
        const [x, y] = region.point;
        return <g key={id} className={`map-pin ${selected === id ? "is-selected" : ""} ${selected !== "all" && selected !== id ? "is-dimmed" : ""}`}
          transform={`translate(${x} ${y})`} onClick={event => { event.stopPropagation(); onSelect(id); }}
          data-testid={`pin-${id}`}>
          <circle className="map-pin-glow" cy="-10" r="22" />
          <path className="map-pin-rim-glow" d={PIN_PATH} />
          <path className="map-pin-shape" d={PIN_PATH} />
          <path className="map-pin-rim" d={PIN_PATH} />
          <path className="map-pin-highlight" d="M-5.7-13.4c1.1-3.2 4.3-5.5 7.7-5.5 1.8 0 3.5.6 4.7 1.7-4.4-.9-7.7.8-9.1 4.6Z" />
          <circle className="map-pin-core" cy="-10.3" r="3.15" />
        </g>;
      })}
    </g>
  </svg>;
}
