import { formatPercent } from "../../lib/progress";
import type { MatchMetrics } from "../../types/dashboard";
import PillarCard from "./PillarCard";
import SemiCircularGauge from "./SemiCircularGauge";

interface MatchPillarProps {
  metrics: MatchMetrics;
}

export default function MatchPillar({ metrics }: MatchPillarProps) {
  const progress = metrics.completedMeetings === null || metrics.targetMeetings === null
    ? "Target pending" : formatPercent(metrics.completedMeetings, metrics.targetMeetings, 2);

  return (
    <PillarCard
      title="MATCH"
      subtitle="Find your perfect business partner"
      icon="bubbles"
      gauge={(
        <SemiCircularGauge
          value={metrics.completedMeetings ?? 0}
          maxValue={metrics.targetMeetings ?? 0}
          displayValue={metrics.completedMeetings === null ? "—" : metrics.completedMeetings.toLocaleString()}
          label={metrics.targetMeetings === null ? "Target pending" : `of ${metrics.targetMeetings.toLocaleString()}`}
          ariaLabel={metrics.completedMeetings === null ? "Meeting data unavailable" :
            `${metrics.completedMeetings} completed ${metrics.completedMeetings === 1 ? "meeting" : "meetings"}${metrics.targetMeetings === null ? ", target pending" : ` of ${metrics.targetMeetings} target meetings`}`}
        />
      )}
      metrics={[
        { icon: "target", value: metrics.targetMeetings === null ? "—" : metrics.targetMeetings.toLocaleString(), label: "Target" },
        { value: progress, label: "Target Achieved", emphasized: true },
      ]}
    />
  );
}
