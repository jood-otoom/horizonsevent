export default function DashboardBackground({ variant }: { variant: "dashboard" | "map" }) {
  return (
    <>
      <svg className={`dashboard-background dashboard-background-${variant}`} viewBox="0 0 1774 887" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1190 887C1343 727 1466 664 1617 680c55 5 110 17 157 22v185Z" fill="#f9e4eb" />
        <path d="M1423 893c62-153 170-265 351-302" fill="none" stroke="#ed001d" strokeWidth="2.4" />
      </svg>
      <svg className="dashboard-corner-flower" viewBox="-64 -64 128 128" aria-hidden="true">
        <path className="dashboard-flower-petal" d="M0 0C-37-2-64-29-64-64-29-64-2-37 0 0Z" fill="var(--flower-red)" />
        <path className="dashboard-flower-petal" d="M0 0C2-37 29-64 64-64 64-29 37-2 0 0Z" fill="var(--flower-red)" opacity=".2" />
        <path className="dashboard-flower-petal" d="M0 0C37 2 64 29 64 64 29 64 2 37 0 0Z" fill="var(--flower-red)" />
        <path className="dashboard-flower-petal" d="M0 0C-2 37-29 64-64 64-64 29-37 2 0 0Z" fill="var(--flower-red)" opacity=".2" />
      </svg>
    </>
  );
}
