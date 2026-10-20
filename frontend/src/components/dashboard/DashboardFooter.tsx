import implementingPartners from "../../assets/branding/reference-implementing-partners.png";

export default function DashboardFooter() {
  return (
    <footer className="dashboard-footer" aria-label="Implementing partners">
      <img
        className="dashboard-implementing-logos"
        src={implementingPartners}
        alt="Implemented by GIZ, the Ministry of Digital Economy and Entrepreneurship, ICON Institute, and PEM Consult"
      />
    </footer>
  );
}
