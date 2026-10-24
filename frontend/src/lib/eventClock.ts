export const EVENT_TIME_ZONE = "Asia/Amman";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export interface EventDateTime {
  date: string;
  time: string;
}

export function formatEventDateTime(value: Date): EventDateTime {
  return {
    date: dateFormatter.format(value),
    time: timeFormatter.format(value),
  };
}
