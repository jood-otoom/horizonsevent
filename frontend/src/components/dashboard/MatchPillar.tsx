import { calculateProgressPercent, formatPercent } from "../../lib/progress";
import type { MatchMetrics } from "../../types/dashboard";
import AnimatedCounter from "./AnimatedCounter";
import PillarCard from "./PillarCard";
import SemiCircularGauge from "./SemiCircularGauge";

interface MatchPillarProps {
  metrics: MatchMetrics;
}

export default function MatchPillar({ metrics }: MatchPillarProps) {
  const completed = metrics.completedMeetings;
  const target = metrics.targetMeetings;
  const progress = completed === null || target === null
    ? "Target pending" : formatPercent(completed, target, 2);

  return (
    <PillarCard
      title="MATCH"
      subtitle="Find your perfect business partner"
      icon="bubbles"
      gauge={(
        <SemiCircularGauge
          value={completed ?? 0}
          maxValue={target ?? 0}
          displayValue={completed === null ? "—" : <AnimatedCounter value={completed} duration={1000} />}
          label={target === null ? "Target pending" : `of ${target.toLocaleString()}`}
          ariaLabel={completed === null ? "Meeting data unavailable" :
            `${completed} completed ${completed === 1 ? "meeting" : "meetings"}${target === null ? ", target pending" : ` of ${target} target meetings`}`}
        />
      )}
      metrics={[
        { icon: "target", value: target === null ? "—" : target.toLocaleString(), label: "Target" },
        { value: completed === null || target === null || target <= 0 ? progress :
          <AnimatedCounter value={calculateProgressPercent(completed, target)}
            duration={1000} decimals={2} trimTrailingZeros suffix="%" />,
          label: "Target Achieved", emphasized: true },
      ]}
    />
  );
}
