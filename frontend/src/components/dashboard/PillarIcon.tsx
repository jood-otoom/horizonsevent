export type PillarIconName = "peopleSolid" | "target";

interface PillarIconProps {
  name: PillarIconName;
  className?: string;
}

export default function PillarIcon({ name, className }: PillarIconProps) {
  if (name === "peopleSolid") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
        <circle cx="32" cy="14" r="8" /><circle cx="12" cy="21" r="6" /><circle cx="52" cy="21" r="6" />
        <path d="M17 50v-5c0-8.5 6.5-15 15-15s15 6.5 15 15v5H17ZM0 48v-5c0-7 5-12 12-12 2 0 4 .4 5.5 1.4A20 20 0 0 0 12 45v5H0Zm64 0v2H52v-5a20 20 0 0 0-5.5-12.6A12 12 0 0 1 52 31c7 0 12 5 12 12v5Z" />
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
