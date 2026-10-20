import logo from "../../assets/branding/new-horizons-2026-logo.png";
import { dataMode } from "../../lib/supabaseClient";

export default function ControllerHeader() {
  return (
    <header className="controller-header">
      <img src={logo} alt="New Horizons 2026" className="controller-logo" />
      <div className="controller-header-copy">
        <p className="controller-eyebrow">Event operations</p>
        <h1>Staff Controller</h1>
      </div>
      <span className="controller-demo-badge">{dataMode === "live" ? "AUTHORIZED" : "DEMO DATA"}</span>
    </header>
  );
}
