import { useEffect, useState } from "react";
import { formatEventDateTime } from "../lib/eventClock";

export function useEventClock() {
  const [clock, setClock] = useState(() => formatEventDateTime(new Date()));
  useEffect(() => {
    const tick = () => setClock(formatEventDateTime(new Date()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return clock;
}
