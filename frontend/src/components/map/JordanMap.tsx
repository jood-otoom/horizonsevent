import geometryText from "../../assets/map/jordan-governorates.geojson?raw";
import { MAP_GOVERNORATE_NAMES, type MapGovernorateId, type MapSnapshot } from "../../types/map";
import type { HeatmapScale } from "../../lib/mapHeatmap";

interface Region {
  id: string;
  name: string;
  path: string;
  selectable: boolean;
}

interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

const ID_BY_ISO: Record<string, MapGovernorateId> = {
  "JO-AQ": "aqaba", "JO-KA": "karak", "JO-MA": "mafraq", "JO-JA": "jarash",
  "JO-AM": "amman", "JO-AJ": "ajlun", "JO-IR": "irbid", "JO-MN": "maan",
};

const geojson = JSON.parse(geometryText) as {
  features: { properties: { shapeISO: string; shapeName: string }; geometry: Geometry }[];
};

function positions(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === "number" && typeof value[1] === "number") return [value as number[]];
  return value.flatMap(positions);
}

const coordinates = geojson.features.flatMap(feature => positions(feature.geometry.coordinates));
const midLatitude = (Math.min(...coordinates.map(point => point[1])) + Math.max(...coordinates.map(point => point[1]))) / 2;
const longitudeScale = Math.cos(midLatitude * Math.PI / 180);
const west = Math.min(...coordinates.map(point => point[0] * longitudeScale));
const east = Math.max(...coordinates.map(point => point[0] * longitudeScale));
const south = Math.min(...coordinates.map(point => point[1]));
const north = Math.max(...coordinates.map(point => point[1]));
const scale = Math.min(500 / (east - west), 560 / (north - south));

function project(point: number[]): string {
  const x = 300 + (point[0] * longitudeScale - (west + east) / 2) * scale;
  const y = 324 - (point[1] - (south + north) / 2) * scale;
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function geometryPath(geometry: Geometry): string {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][];
  return polygons.flatMap(polygon => polygon.map(ring =>
    `M ${ring.map(project).join(" L ")} Z`,
  )).join(" ");
}

const regions: Region[] = geojson.features.map(feature => ({
  id: ID_BY_ISO[feature.properties.shapeISO] ?? feature.properties.shapeISO,
  name: ID_BY_ISO[feature.properties.shapeISO]
    ? MAP_GOVERNORATE_NAMES[ID_BY_ISO[feature.properties.shapeISO]]
    : feature.properties.shapeName,
  path: geometryPath(feature.geometry),
  selectable: feature.properties.shapeISO in ID_BY_ISO,
}));

if (regions.length !== 12 || regions.filter(region => region.selectable).length !== 8) {
  throw new Error("Jordan governorate geometry is incomplete.");
}

interface Props {
  selected: MapGovernorateId | "all";
  onSelect: (id: MapGovernorateId) => void;
  snapshot: MapSnapshot | null;
  heatmap: HeatmapScale;
}

export default function JordanMap({ selected, onSelect, snapshot, heatmap }: Props) {
  const selectedRegion = selected === "all" ? null : regions.find(region => region.id === selected);
  return (
    <svg className="map-jordan-svg" viewBox="35 30 530 590" role="group" aria-label="Jordan governorates map">
      <g className="map-outline" aria-hidden="true">
        {regions.map(region => <path key={region.id} d={region.path} />)}
      </g>
      <g className="map-regions">
        {regions.map(region => {
          const id = region.id as MapGovernorateId;
          const total = region.selectable ? snapshot?.governorates[id]?.total : undefined;
          const color = heatmap.colorFor(total);
          return region.selectable && total !== undefined && color ? (
            <path
              key={region.id}
              d={region.path}
              className={`map-region ${selected === region.id ? "is-selected" : ""}`}
              style={{ fill: color }}
              role="button"
              tabIndex={0}
              aria-label={`Select ${region.name} governorate, ${total} startups`}
              aria-pressed={selected === region.id}
              onClick={() => onSelect(id)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(id);
                }
              }}
              data-testid={`region-${region.id}`}
            ><title>{region.name} — {total} startups</title></path>
          ) : <path key={region.id} d={region.path} className="map-region map-region-inactive" aria-hidden="true" />;
        })}
      </g>
      {selectedRegion && <path className="map-selected-outline" d={selectedRegion.path} aria-hidden="true" pointerEvents="none" />}
    </svg>
  );
}
