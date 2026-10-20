export type PillarIconName = "people" | "peopleSolid" | "bubbles" | "growth" | "target";

interface PillarIconProps {
  name: PillarIconName;
  className?: string;
}

export default function PillarIcon({ name, className }: PillarIconProps) {
  if (name === "people") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="32" cy="17" r="8" />
        <path d="M17 50v-5c0-8.3 6.7-15 15-15s15 6.7 15 15v5H17Z" />
        <circle cx="13" cy="25" r="6" />
        <path d="M13 34c-6 0-10 4.8-10 10v5h11m37 0h10v-5c0-5.2-4-10-10-10" />
        <circle cx="51" cy="25" r="6" />
      </svg>
    );
  }

  if (name === "peopleSolid") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
        <circle cx="32" cy="14" r="8" /><circle cx="12" cy="21" r="6" /><circle cx="52" cy="21" r="6" />
        <path d="M17 50v-5c0-8.5 6.5-15 15-15s15 6.5 15 15v5H17ZM0 48v-5c0-7 5-12 12-12 2 0 4 .4 5.5 1.4A20 20 0 0 0 12 45v5H0Zm64 0v2H52v-5a20 20 0 0 0-5.5-12.6A12 12 0 0 1 52 31c7 0 12 5 12 12v5Z" />
      </svg>
    );
  }

  if (name === "bubbles") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 11h33a9 9 0 0 1 9 9v10a9 9 0 0 1-9 9H24L13 48v-9h-7a9 9 0 0 1-9-9V20a9 9 0 0 1 9-9Z" transform="translate(5 0)" />
        <path d="M48 25h3a9 9 0 0 1 9 9v9a9 9 0 0 1-9 9h-1v8l-10-8H28a9 9 0 0 1-9-8" />
      </svg>
    );
  }

  if (name === "growth") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="42" width="11" height="15" rx="1" /><rect x="25" y="34" width="11" height="23" rx="1" /><rect x="45" y="24" width="11" height="33" rx="1" />
        <path d="M5 32c18-2 32-12 49-27m-10 0h10v10" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="28" cy="36" r="20" /><circle cx="28" cy="36" r="12" /><circle cx="28" cy="36" r="4" fill="currentColor" />
      <path d="M31 33 53 11m0 0H42m11 0v11M40 20l7 7" />
    </svg>
  );
}
