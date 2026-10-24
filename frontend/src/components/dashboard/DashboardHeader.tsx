import germanCooperation from "../../assets/branding/German-Jordan Cooperation Logo.jpg";
import coFounded from "../../assets/branding/EN_Co-fundedbytheEU_RGB_POS.png";

export default function DashboardHeader() {
  return (
    <header className="dashboard-header" aria-label="Funding partners">
      <div className="dashboard-logo-row dashboard-header-logo-row">
        <img src={germanCooperation} alt="German-Jordan Cooperation" />
        <img src={coFounded} alt="Co-funded by the European Union" />
      </div>
    </header>
  );
}
