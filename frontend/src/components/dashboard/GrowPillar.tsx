import { formatPercent } from "../../lib/progress";
import type { GrowMetrics } from "../../types/dashboard";
import PillarCard from "./PillarCard";
import SemiCircularGauge from "./SemiCircularGauge";

interface GrowPillarProps {
  metrics: GrowMetrics;
}

export default function GrowPillar({ metrics }: GrowPillarProps) {
  const hasFeedback =
    metrics.feedbackCount !== null && metrics.feedbackCount > 0 &&
    metrics.averageRating !== null &&
    Number.isFinite(metrics.averageRating) &&
    metrics.averageRating >= 1 &&
    metrics.averageRating <= metrics.maximumRating;
  const average = hasFeedback ? metrics.averageRating : null;
  const progress = metrics.feedbackCount === null ? "Data pending" :
    average === null ? "Awaiting ratings" : formatPercent(average, metrics.maximumRating);

  return (
    <PillarCard
      title="GROW"
      subtitle="Scale with the right support"
      icon="growth"
      gauge={(
        <SemiCircularGauge
          value={average ?? 0}
          maxValue={metrics.maximumRating}
          displayValue={average === null ? "—" : average.toFixed(1)}
          label={metrics.feedbackCount === null ? "Data pending" : average === null ? "No feedback yet" : `of ${metrics.maximumRating.toFixed(1)}`}
          ariaLabel={metrics.feedbackCount === null ? "Meeting feedback data unavailable" : average === null
            ? "No meeting feedback has been submitted"
            : `Average meeting feedback rating ${average.toFixed(1)} out of ${metrics.maximumRating.toFixed(1)}`}
        />
      )}
      metrics={[
        { icon: "target", value: metrics.feedbackCount === null ? "—" : metrics.feedbackCount.toLocaleString(), label: "Feedback received" },
        { value: progress, label: "of Maximum Rating", emphasized: true },
      ]}
    />
  );
}
