import type { MetricResource, MeetMetrics } from "../../types/dashboard";
import AnimatedCounter from "./AnimatedCounter";
import PillarCard from "./PillarCard";
import SemiCircularGauge from "./SemiCircularGauge";

interface MeetPillarProps {
  resource: MetricResource<MeetMetrics>;
}

export default function MeetPillar({ resource }: MeetPillarProps) {
  const ready = resource.status === "ready" ? resource.data : null;
  const registered = ready?.registered ?? 0;
  const checkedIn = ready?.checkedIn ?? 0;
  const loading = resource.status === "loading";
  const sourceLabel = ready?.status === "snapshot" ? " · Snapshot" : "";

  return (
    <PillarCard
      title="MEET"
      subtitle="Connect with the right people"
      icon="people"
      gauge={(
        <SemiCircularGauge
          value={checkedIn}
          maxValue={registered}
          displayValue={loading ? "" : ready ? <AnimatedCounter value={ready.checkedIn} /> : "—"}
          label={loading ? "Loading" : ready ? `Checked In${sourceLabel}` : "Unavailable"}
          loading={loading}
          ariaLabel={ready
            ? `${ready.checkedIn} checked in of ${ready.registered} registered${sourceLabel}`
            : loading
              ? "Loading attendance data"
              : "Attendance data unavailable"}
        />
      )}
      metrics={[{
        icon: "peopleSolid",
        value: ready ? <AnimatedCounter value={ready.registered} /> : "—",
        label: "Registered",
      }, {
        value: ready ? <AnimatedCounter value={ready.checkInRate} suffix="%" /> : "—",
        label: "Check-in rate",
      }]}
    />
  );
}
