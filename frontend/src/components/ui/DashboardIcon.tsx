import type { HTMLAttributes } from "react";

export const DASHBOARD_ICON_NAMES = [
  "female", "male", "employment-startups", "employment-people",
  "meet", "match", "grow", "technology", "green-tech", "manufacturing",
  "health", "education", "commerce", "hospitality", "other",
] as const;

export type DashboardIconName = typeof DASHBOARD_ICON_NAMES[number];

const PNG_SOURCE_BY_NAME: Record<DashboardIconName, string> = {
  female: "female.png",
  male: "male.png",
  "employment-startups": "employment_startups.png",
  "employment-people": "employment_people.png",
  meet: "meet.png",
  match: "match.png",
  grow: "grow.png",
  technology: "technology.png",
  "green-tech": "green_tech.png",
  manufacturing: "manufacturing.png",
  health: "health.png",
  education: "education.png",
  commerce: "commerce.png",
  hospitality: "hospitality.png",
  other: "other.png",
};

type Props = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: DashboardIconName;
  size?: number;
  label?: string;
};

/** Display the approved transparent PNG artwork without recoloring it. */
export function DashboardIcon({ name, size = 40, label, className, style, ...spanProps }: Props) {
  const source = `/icons/png/${PNG_SOURCE_BY_NAME[name]}`;

  return <span
    {...spanProps}
    className={["dashboard-icon", className].filter(Boolean).join(" ")}
    style={{ display: "inline-block", width: size, height: size, flex: "none", lineHeight: 0, ...style }}
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <img src={source} alt="" aria-hidden="true" width={size} height={size} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
  </span>;
}
