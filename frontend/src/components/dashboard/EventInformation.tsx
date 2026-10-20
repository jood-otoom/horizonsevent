import { formatEventDateTime } from "../../lib/eventClock";
import type { DashboardMetrics } from "../../types/dashboard";

interface EventInformationProps {
  metrics: DashboardMetrics;
}

export default function EventInformation({ metrics }: EventInformationProps) {
  const meet = metrics.meet.status === "ready" ? metrics.meet.data : null;
  const sourceLabel = metrics.dataMode === "mock" ? "Demo data · Synthetic values" :
    meet?.status === "snapshot" ? "MEET portal-verified snapshot · No automatic updates" :
      meet?.status === "stale" ? "MEET data stale" :
        meet?.status === "pending" ? "MEET pending verification" :
          meet?.status === "live" ? "MEET verified live data" :
            metrics.meet.status === "loading" ? "Connecting to event data" :
              metrics.meet.status === "error" ? metrics.meet.message : "MEET data unavailable";
  const updated = meet ? formatEventDateTime(new Date(meet.asOf)) : null;
  const matchLabel = metrics.match.status === "stale" ? "MATCH data stale" :
    metrics.match.status === "pending" ? "MATCH loading" : "MATCH connected";
  const growLabel = metrics.grow.status === "stale" ? "GROW data stale" :
    metrics.grow.status === "pending" ? "GROW loading" : "GROW connected";

  return (
    <aside className="event-information" aria-label="Event information and data status">
      <h1 className="event-information-title"><span>New</span><span>Horizons 2026</span></h1>
      <div className="event-information-detail">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect x="4" y="7" width="28" height="25" rx="2" stroke="currentColor" strokeWidth="3" />
          <path d="M4 15h28M11 3v8M25 3v8M11 21h3m5 0h3m5 0h3M11 27h3m5 0h3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>29 October 2026</span>
      </div>
      <div className="event-information-detail event-information-location">
        <svg viewBox="0 0 36 40" fill="none" aria-hidden="true">
          <path d="M18 38S4 23.4 4 16a14 14 0 1 1 28 0c0 7.4-14 22-14 22Z" fill="currentColor" />
          <circle cx="18" cy="16" r="5.5" fill="white" />
        </svg>
        <span>UJ Academy<br />Amman, Jordan</span>
      </div>
      <div className="dashboard-data-status" role="status">
        <span>{sourceLabel}</span>
        {updated && <span>{meet?.status === "snapshot" ? "Published" : meet?.dataMode === "mock" ? "Fixture served" : "Last successful update"}: {updated.date} {updated.time} (Amman)</span>}
        {metrics.dataMode === "live" && <span>{matchLabel} · {growLabel}</span>}
      </div>
    </aside>
  );
}
