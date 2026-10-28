import giz from "../../assets/branding/gizlogo_unternehmen-en-implemented-rgb-300.jpg";
import icon from "../../assets/branding/ICON Logo.png";
import pem from "../../assets/branding/pem-logo-rgb.jpg";

export default function DashboardFooter() {
  return (
    <footer className="dashboard-footer" aria-label="Implementing partners">
      <div className="dashboard-logo-row dashboard-footer-logo-row">
        <img src={giz} alt="GIZ" />
        <img src={icon} alt="ICON Institute" />
        <img src={pem} alt="PEM Consult" />
      </div>
    </footer>
  );
}
