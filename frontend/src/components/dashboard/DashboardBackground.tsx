import horizonFlower from "../../assets/branding/horizon-flower.svg";

export default function DashboardBackground({ variant }: { variant: "dashboard" | "map" }) {
  return (
    <>
      {variant === "dashboard" && <svg className="dashboard-background dashboard-background-dashboard" viewBox="0 0 1774 887" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1190 887C1343 727 1466 664 1617 680c55 5 110 17 157 22v185Z" fill="#f9e4eb" />
        <path d="M1423 893c62-153 170-265 351-302" fill="none" stroke="#ed001d" strokeWidth="2.4" />
      </svg>}
      <img className="dashboard-corner-flower" src={horizonFlower} alt="" aria-hidden="true" />
    </>
  );
}
