import germanCooperation from "../../assets/branding/German-Jordan Cooperation Logo.jpg";
import coFounded from "../../assets/branding/EN_Co-fundedbytheEU_RGB_POS.png";
import ministry from "../../assets/branding/LOGOS  (1).png";

export default function DashboardHeader() {
  return (
    <header className="dashboard-header" aria-label="Funding and host partners">
      <div className="dashboard-logo-row dashboard-header-logo-row">
        <div className="dashboard-funding-logos">
          <img src={germanCooperation} alt="German-Jordan Cooperation" />
          <img src={coFounded} alt="Co-funded by the European Union" />
        </div>
        <img className="dashboard-ministry-logo" src={ministry} alt="Ministry of Digital Economy and Entrepreneurship" />
      </div>
    </header>
  );
}
