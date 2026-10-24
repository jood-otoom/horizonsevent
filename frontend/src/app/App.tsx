import { useEffect } from "react";
import Dashboard from "../components/dashboard/Dashboard";
import StaffController from "../components/controller/StaffController";
import { dataMode } from "../lib/supabaseClient";
import LiveAccess from "./LiveAccess";
import MapDashboard from "../pages/MapDashboard";

interface AppProps {
  pathname?: string;
}

export default function App({ pathname = window.location.pathname }: AppProps) {
  const route = pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    document.title = route === "/controller"
      ? `New Horizons 2026 — Staff Controller${dataMode === "demo" ? " (Demo)" : ""}`
      : route === "/map"
        ? "New Horizons 2026 — Jordan Startup Map"
      : route === "/"
        ? "New Horizons 2026 — Live Dashboard"
        : "Page not found — New Horizons 2026";
  }, [route]);

  if (route === "/") return <Dashboard />;
  if (route === "/controller") return dataMode === "live"
    ? <LiveAccess><StaffController /></LiveAccess> : <StaffController />;
  if (route === "/map") return <MapDashboard />;

  return (
    <main className="route-not-found">
      <h1>Page not found</h1>
      <a href="/">Return to the event dashboard</a>
    </main>
  );
}
