export default function DashboardBackground() {
  return (
    <svg className="dashboard-background" viewBox="0 0 1774 887" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="corner-dots" width="29" height="29" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="5.5" fill="#888c91" />
        </pattern>
      </defs>
      <path d="M1180 0H1774V143C1618 165 1470 165 1340 115 1270 87 1211 35 1180 0Z" fill="#f9e8ee" />
      <path d="M1290 -8C1344 126 1430 188 1541 185c97-3 174-62 233-119" fill="none" stroke="#ed001d" strokeWidth="2.4" />
      <circle cx="1694" cy="38" r="142" fill="#bd0027" />
      <rect x="1386" y="0" width="145" height="119" fill="url(#corner-dots)" />

      <path d="M1190 887C1343 727 1466 664 1617 680c55 5 110 17 157 22v185Z" fill="#f9e4eb" />
      <path d="M1423 893c62-153 170-265 351-302" fill="none" stroke="#ed001d" strokeWidth="2.4" />
      <rect x="1568" y="725" width="151" height="145" fill="url(#corner-dots)" />
    </svg>
  );
}
