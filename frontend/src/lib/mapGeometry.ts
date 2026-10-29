import geometryText from "../assets/map/jordan-governorates.geojson?raw";
import { MAP_GOVERNORATE_NAMES, type MapGovernorateId } from "../types/map";

type Point = readonly [number, number];
type Ring = Point[];
type Polygon = Ring[];

interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface MapRegion {
  id: string;
  name: string;
  path: string;
  point: Point;
  polygons: Polygon[];
  selectable: boolean;
}

const ID_BY_ISO: Record<string, MapGovernorateId> = {
  "JO-AQ": "aqaba", "JO-KA": "karak", "JO-MA": "mafraq", "JO-JA": "jarash",
  "JO-AM": "amman", "JO-AJ": "ajlun", "JO-IR": "irbid", "JO-MN": "maan",
  "JO-BA": "balqa", "JO-MD": "madaba", "JO-AT": "tafilah", "JO-AZ": "zarqa",
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

function project(point: number[]): Point {
  return [
    300 + (point[0] * longitudeScale - (west + east) / 2) * scale,
    324 - (point[1] - (south + north) / 2) * scale,
  ];
}

function geometryPolygons(geometry: Geometry): Polygon[] {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][];
  return polygons.map(polygon => polygon.map(ring => ring.map(project)));
}

function polygonPath(polygons: Polygon[]): string {
  return polygons.flatMap(polygon => polygon.map(ring =>
    `M ${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`,
  )).join(" ");
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
  }
  return inside;
}

function segmentDistanceSquared(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy),
  ));
  return (point[0] - a[0] - t * dx) ** 2 + (point[1] - a[1] - t * dy) ** 2;
}

function signedDistance(point: Point, polygon: Polygon): number {
  let distanceSquared = Infinity;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      distanceSquared = Math.min(distanceSquared, segmentDistanceSquared(point, ring[i], ring[j]));
    }
  }
  return (pointInPolygon(point, polygon) ? 1 : -1) * Math.sqrt(distanceSquared);
}

interface Cell { point: Point; half: number; distance: number; potential: number }

function cell(x: number, y: number, half: number, polygon: Polygon): Cell {
  const point: Point = [x, y];
  const distance = signedDistance(point, polygon);
  return { point, half, distance, potential: distance + half * Math.SQRT2 };
}

// A small polylabel search finds an interior point with room for a legible node.
function interiorPoint(polygon: Polygon): Cell {
  const outer = polygon[0];
  const xs = outer.map(point => point[0]);
  const ys = outer.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const step = Math.min(maxX - minX, maxY - minY);
  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += step) {
    for (let y = minY; y < maxY; y += step) queue.push(cell(x + step / 2, y + step / 2, step / 2, polygon));
  }
  let best = cell((minX + maxX) / 2, (minY + maxY) / 2, 0, polygon);
  if (signedDistance(outer[0], polygon) > best.distance) best = cell(outer[0][0], outer[0][1], 0, polygon);
  while (queue.length) {
    queue.sort((a, b) => a.potential - b.potential);
    const current = queue.pop()!;
    if (current.distance > best.distance) best = current;
    if (current.potential - best.distance <= 0.5) continue;
    const half = current.half / 2;
    for (const dx of [-half, half]) {
      for (const dy of [-half, half]) queue.push(cell(current.point[0] + dx, current.point[1] + dy, half, polygon));
    }
  }
  return best;
}

export const mapRegions: readonly MapRegion[] = geojson.features.map(feature => {
  const polygons = geometryPolygons(feature.geometry);
  const id = ID_BY_ISO[feature.properties.shapeISO] ?? feature.properties.shapeISO;
  const point = polygons.map(interiorPoint).sort((a, b) => b.distance - a.distance)[0].point;
  return {
    id,
    name: feature.properties.shapeISO in ID_BY_ISO
      ? MAP_GOVERNORATE_NAMES[id as MapGovernorateId]
      : feature.properties.shapeName,
    path: polygonPath(polygons),
    point,
    polygons,
    selectable: feature.properties.shapeISO in ID_BY_ISO,
  };
});

if (mapRegions.length !== 12 || mapRegions.filter(region => region.selectable).length !== 12 ||
  mapRegions.some(region => !region.polygons.some(polygon => pointInPolygon(region.point, polygon)))) {
  throw new Error("Jordan governorate geometry is incomplete.");
}
