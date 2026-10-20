import type { ReactNode } from "react";
import MetricPanel, { type MetricPanelItem } from "../ui/MetricPanel";
import PillarIcon, { type PillarIconName } from "./PillarIcon";

interface PillarCardProps {
  title: string;
  subtitle: string;
  icon: PillarIconName;
  gauge: ReactNode;
  metrics: MetricPanelItem[];
}

export default function PillarCard({
  title,
  subtitle,
  icon,
  gauge,
  metrics,
}: PillarCardProps) {
  const id = title.toLowerCase();

  return (
    <section className="pillar-card" aria-labelledby={`${id}-title`}>
      <div className="pillar-icon">
        <PillarIcon name={icon} />
      </div>
      <h2 className="pillar-title" id={`${id}-title`}>{title}</h2>
      <p className="pillar-subtitle">{subtitle}</p>
      <div className="gauge-region">{gauge}</div>
      <MetricPanel items={metrics} />
    </section>
  );
}
