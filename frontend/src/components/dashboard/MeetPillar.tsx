import type { MetricResource, MeetMetrics } from "../../types/dashboard";
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

  return (
    <PillarCard
      title="MEET"
      subtitle="Connect with the right people"
      icon="people"
      gauge={(
        <SemiCircularGauge
          value={checkedIn}
          maxValue={registered}
          displayValue={loading ? "" : ready ? String(ready.checkedIn) : "—"}
          label={loading ? "Loading" : ready ? "Checked In" : "Unavailable"}
          loading={loading}
          ariaLabel={ready
            ? `${ready.checkedIn} checked in of ${ready.registered} registered`
            : loading
              ? "Loading attendance data"
              : "Attendance data unavailable"}
        />
      )}
      metrics={[{
        icon: "peopleSolid",
        value: ready ? ready.registered.toLocaleString() : "—",
        label: "Registered",
      }, {
        value: ready ? `${ready.checkInRate}%` : "—",
        label: "Check-in rate",
      }]}
    />
  );
}
