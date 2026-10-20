import { useEffect } from "react";
import Dashboard from "../components/dashboard/Dashboard";
import StaffController from "../components/controller/StaffController";
import { dataMode } from "../lib/supabaseClient";
import LiveAccess from "./LiveAccess";

interface AppProps {
  pathname?: string;
}

export default function App({ pathname = window.location.pathname }: AppProps) {
  const route = pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    document.title = route === "/controller"
      ? `New Horizons 2026 — Staff Controller${dataMode === "demo" ? " (Demo)" : ""}`
      : route === "/"
        ? "New Horizons 2026 — Live Dashboard"
        : "Page not found — New Horizons 2026";
  }, [route]);

  if (route === "/") return dataMode === "live"
    ? <LiveAccess staffOnly={false}><Dashboard /></LiveAccess> : <Dashboard />;
  if (route === "/controller") return dataMode === "live"
    ? <LiveAccess staffOnly><StaffController /></LiveAccess> : <StaffController />;

  return (
    <main className="route-not-found">
      <h1>Page not found</h1>
      <a href="/">Return to the event dashboard</a>
    </main>
  );
}
