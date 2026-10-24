import { useEventClock } from "../../hooks/useEventClock";

export default function EventInformation() {
  const clock = useEventClock();

  return (
    <aside className="event-information" aria-label="Event information">
      <h1 className="event-information-title"><span>New</span><span>Horizons</span><span>2026</span></h1>
      <div className="event-information-detail event-information-location">
        <svg viewBox="0 0 36 40" fill="none" aria-hidden="true">
          <path d="M18 38S4 23.4 4 16a14 14 0 1 1 28 0c0 7.4-14 22-14 22Z" fill="currentColor" />
          <circle cx="18" cy="16" r="5.5" fill="white" />
        </svg>
        <span>UJ Academy<br />Amman, Jordan</span>
      </div>
      <div className="event-information-detail event-information-date">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect x="4" y="7" width="28" height="25" rx="2" stroke="currentColor" strokeWidth="3" />
          <path d="M4 15h28M11 3v8M25 3v8M11 21h3m5 0h3m5 0h3M11 27h3m5 0h3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>{clock.date}</span>
      </div>
      <div className="event-information-detail event-information-time">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="3" />
          <path d="M18 9v10l6 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <time>{clock.time}</time>
      </div>
    </aside>
  );
}
