import fundingPartners from "../../assets/branding/reference-funding-partners.png";

export default function DashboardHeader() {
  return (
    <header className="dashboard-header" aria-label="Funding partners">
      <img
        className="dashboard-funding-logos"
        src={fundingPartners}
        alt="German Cooperation and the European Union — co-funded by the European Union"
      />
    </header>
  );
}
