import { mapRegions } from "../../lib/mapGeometry";
import type { HeatmapScale } from "../../lib/mapHeatmap";
import type { MapGovernorateId, MapSnapshot } from "../../types/map";

interface Props {
  selected: MapGovernorateId | "all";
  onSelect: (id: MapGovernorateId | "all") => void;
  snapshot: MapSnapshot;
  heatmap: HeatmapScale;
}

const labelOffsets: Record<string, readonly [number, number]> = {
  irbid: [0, 24], ajlun: [-45, 18], jarash: [55, 24], mafraq: [0, 26],
  amman: [0, 27], karak: [11, 27], aqaba: [14, 27], maan: [0, 25],
  "JO-BA": [-4, 24], "JO-AZ": [14, 25], "JO-MD": [-9, 25], "JO-AT": [0, 24],
};

export default function JordanMap({ selected, onSelect, snapshot, heatmap }: Props) {
  return <svg className="map-jordan-svg" viewBox="35 30 530 590" role="group" aria-label="Jordan governorates map"
    onClick={() => onSelect("all")}>
    <defs>
      <linearGradient id="map-pin-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#AC0F2E" /><stop offset="1" stopColor="#7A0019" />
      </linearGradient>
    </defs>
    <g className="map-regions">
      {mapRegions.map(region => {
        const id = region.id as MapGovernorateId;
        const total = region.selectable ? snapshot.governorates[id]?.total : undefined;
        const selectable = region.selectable && total !== undefined;
        const isSelected = selected === region.id;
        return <path key={region.id} d={region.path}
          className={`map-region ${selectable ? "is-selectable" : "is-neutral"} ${isSelected ? "is-selected" : ""} ${selected !== "all" && !isSelected ? "is-dimmed" : ""}`}
          style={{ fill: heatmap.colorFor(total) ?? undefined }}
          role={selectable ? "button" : undefined}
          tabIndex={selectable ? 0 : undefined}
          aria-label={selectable ? `${region.name}, ${total} startups` : undefined}
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
          data-testid={`region-${region.id}`}><title>{`${region.name}${total === undefined ? "" : ` — ${total} startups`}`}</title></path>;
      })}
    </g>
    <g className="map-pins" aria-hidden="true">
      {mapRegions.filter(region => region.selectable).map(region => {
        const id = region.id as MapGovernorateId;
        const [x, y] = region.point;
        return <g key={id} className={`map-pin ${selected === id ? "is-selected" : ""} ${selected !== "all" && selected !== id ? "is-dimmed" : ""}`}
          transform={`translate(${x} ${y})`} onClick={event => { event.stopPropagation(); onSelect(id); }}
          data-testid={`pin-${id}`}>
          <circle className="map-pin-glow" cy="-8" r="14" />
          <path className="map-pin-shape" d="M0 7C-3 2-8-3-8-9a8 8 0 0 1 16 0C8-3 3 2 0 7Z" />
          <circle className="map-pin-core" cy="-9" r="2.6" />
        </g>;
      })}
    </g>
    <g className="map-labels" aria-hidden="true">
      {mapRegions.map(region => {
        const [dx, dy] = labelOffsets[region.id] ?? [0, 24];
        const isSelected = selected === region.id;
        return <text key={region.id} x={region.point[0] + dx} y={region.point[1] + dy}
          className={`${isSelected ? "is-selected" : ""} ${selected !== "all" && !isSelected ? "is-dimmed" : ""}`}
          textAnchor="middle">{region.name}</text>;
      })}
    </g>
  </svg>;
}
