import { calculateProgressPercent } from "../../lib/progress";
import type { GrowMetrics } from "../../types/dashboard";
import AnimatedCounter from "./AnimatedCounter";
import PillarCard from "./PillarCard";
import SemiCircularGauge from "./SemiCircularGauge";

interface GrowPillarProps {
  metrics: GrowMetrics;
}

export default function GrowPillar({ metrics }: GrowPillarProps) {
  const feedbackCount = typeof metrics.feedbackCount === "number" &&
    Number.isSafeInteger(metrics.feedbackCount) && metrics.feedbackCount >= 0
    ? metrics.feedbackCount : null;
  const average = feedbackCount === 0 && metrics.averageRating === null ? 0 :
    feedbackCount !== null && feedbackCount > 0 && typeof metrics.averageRating === "number" &&
    Number.isFinite(metrics.averageRating) && metrics.averageRating >= 1 &&
    metrics.averageRating <= metrics.maximumRating ? metrics.averageRating : null;
  const ratingAchieved = average === null ? null : calculateProgressPercent(average, metrics.maximumRating);

  return (
    <PillarCard
      title="GROW"
      subtitle="Scale with the right support"
      icon="growth"
      gauge={(
        <SemiCircularGauge
          value={average ?? 0}
          maxValue={metrics.maximumRating}
          displayValue={average === null ? "—" : <AnimatedCounter value={average} decimals={average === 0 ? 0 : 1} duration={700} />}
          label={average === null ? "Unavailable" : `of ${metrics.maximumRating.toFixed(1)}`}
          ariaLabel={average === null ? "Meeting feedback unavailable" :
            `${feedbackCount} feedback submissions; displayed rating ${average.toFixed(average === 0 ? 0 : 1)} out of ${metrics.maximumRating.toFixed(1)}`}
        />
      )}
      metrics={[
        { icon: "target", value: feedbackCount === null ? "—" : <AnimatedCounter value={feedbackCount} />, label: "Feedback received" },
        { value: ratingAchieved === null ? "—" : <AnimatedCounter value={ratingAchieved} suffix="%" />,
          label: "Rating Achieved", emphasized: true },
      ]}
    />
  );
}
