import useDashboardData from "../../hooks/useDashboardData";
import DashboardBackground from "./DashboardBackground";
import DashboardFooter from "./DashboardFooter";
import DashboardHeader from "./DashboardHeader";
import EventInformation from "./EventInformation";
import GrowPillar from "./GrowPillar";
import MatchPillar from "./MatchPillar";
import MeetPillar from "./MeetPillar";

export default function Dashboard() {
  const metrics = useDashboardData();

  return (
    <main className="dashboard-shell">
      <DashboardBackground />
      <DashboardHeader />
      <section className="dashboard-grid" aria-label="New Horizons event progress">
        <MeetPillar resource={metrics.meet} />
        <MatchPillar metrics={metrics.match} />
        <GrowPillar metrics={metrics.grow} />
      </section>
      <EventInformation metrics={metrics} />
      <DashboardFooter />
    </main>
  );
}
