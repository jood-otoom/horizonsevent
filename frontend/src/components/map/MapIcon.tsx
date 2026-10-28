import type { SVGProps } from "react";
import female from "../../assets/map/icons/female_participants.png";
import male from "../../assets/map/icons/male_participants.png";
import building from "../../assets/map/icons/startups_employing_people.png";
import people from "../../assets/map/icons/total_employees.png";
import rocket from "../../assets/map/icons/acceleration.png";
import bars from "../../assets/map/icons/go_to_market.png";
import sprout from "../../assets/map/icons/grow_plus.png";
import monitor from "../../assets/map/icons/technology_digital.png";
import leaf from "../../assets/map/icons/green_clean_tech.png";
import industry from "../../assets/map/icons/industry_manufacturing.png";
import heart from "../../assets/map/icons/health_social_impact.png";
import book from "../../assets/map/icons/education_creative.png";
import briefcase from "../../assets/map/icons/commerce_services.png";
import utensils from "../../assets/map/icons/hospitality_tourism.png";
import more from "../../assets/map/icons/other.png";

export const MAP_ICON_SIZES = { small: 24, medium: 36, large: 48, extraLarge: 64 } as const;

export type MapIconSize = keyof typeof MAP_ICON_SIZES;
export type MapIconName =
  | "female" | "male"
  | "building" | "people"
  | "rocket" | "bars" | "sprout"
  | "monitor" | "leaf" | "industry" | "heart"
  | "book" | "briefcase" | "utensils" | "more";

// These supplied standalone PNGs already contain their intended transparent padding.
const ICON_SOURCES: Record<MapIconName, string> = {
  female, male, building, people, rocket, bars, sprout, monitor,
  leaf, industry, heart, book, briefcase, utensils, more,
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
    <image href={source} width="64" height="64" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
  </svg>;
}
