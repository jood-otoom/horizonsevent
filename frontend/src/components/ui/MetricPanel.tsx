import type { ReactNode } from "react";
import PillarIcon, { type PillarIconName } from "../dashboard/PillarIcon";

export interface MetricPanelItem {
  value: ReactNode;
  label: string;
  icon?: PillarIconName;
  emphasized?: boolean;
}

interface MetricPanelProps {
  items: MetricPanelItem[];
}

export default function MetricPanel({ items }: MetricPanelProps) {
  return (
    <dl className="metric-panel">
      {items.map((item) => (
        <div className="metric-item" key={item.label}>
          {item.icon && <PillarIcon name={item.icon} className="metric-icon" />}
          <div className="metric-copy">
            <dt className="metric-label">{item.label}</dt>
            <dd className={`metric-value${item.emphasized ? " metric-value-emphasis" : ""}`}>
              {item.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
