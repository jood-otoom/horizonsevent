import type { SVGProps } from "react";
import iconSheet from "../../assets/map/icons/dashboard-icon-sheet.png";
import femalePortrait from "../../assets/map/icons/female-portrait.png";

export const MAP_ICON_SIZES = { small: 24, medium: 36, large: 48, extraLarge: 64 } as const;

export type MapIconSize = keyof typeof MAP_ICON_SIZES;
export type MapIconName =
  | "female" | "male"
  | "building" | "people"
  | "rocket" | "bars" | "sprout"
  | "monitor" | "leaf" | "industry" | "heart"
  | "book" | "briefcase" | "utensils" | "more";

interface IconSource {
  asset: string;
  viewBox: string;
}

// The sheet's rows do not align to four equal cells. Each measured crop
// preserves the original artwork, including its transparent edge pixels.
const ICON_SOURCES: Record<MapIconName, IconSource> = {
  female: { asset: femalePortrait, viewBox: "145 59 965 1095" },
  male: { asset: iconSheet, viewBox: "357 100 260 266" },
  building: { asset: iconSheet, viewBox: "657 151 255 210" },
  people: { asset: iconSheet, viewBox: "945 163 264 195" },
  rocket: { asset: iconSheet, viewBox: "76 414 242 243" },
  bars: { asset: iconSheet, viewBox: "360 446 231 198" },
  sprout: { asset: iconSheet, viewBox: "654 430 251 226" },
  monitor: { asset: iconSheet, viewBox: "959 443 236 207" },
  leaf: { asset: iconSheet, viewBox: "95 702 192 235" },
  industry: { asset: iconSheet, viewBox: "353 693 250 238" },
  heart: { asset: iconSheet, viewBox: "666 719 236 200" },
  book: { asset: iconSheet, viewBox: "955 728 246 186" },
  briefcase: { asset: iconSheet, viewBox: "82 983 233 206" },
  utensils: { asset: iconSheet, viewBox: "408 965 163 231" },
  more: { asset: iconSheet, viewBox: "664 1049 242 79" },
};

type Props = Omit<SVGProps<SVGSVGElement>, "children" | "name" | "width" | "height" | "viewBox"> & {
  name: MapIconName;
  size?: MapIconSize;
  label?: string;
};

/** A consistent accessible wrapper around the owner's exact high-resolution icon artwork. */
export function MapIcon({ name, size = "medium", label, ...svgProps }: Props) {
  const source = ICON_SOURCES[name];
  return <svg
    {...svgProps}
    width={MAP_ICON_SIZES[size]}
    height={MAP_ICON_SIZES[size]}
    viewBox="0 0 64 64"
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    focusable="false"
  >
    <svg x="0" y="0" width="64" height="64" viewBox={source.viewBox}
      preserveAspectRatio="xMidYMid meet" overflow="hidden" aria-hidden="true">
      <image href={source.asset} width="1254" height="1254" aria-hidden="true" />
    </svg>
  </svg>;
}
