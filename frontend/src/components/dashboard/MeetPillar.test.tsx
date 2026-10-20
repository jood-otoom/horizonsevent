import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MeetPillar from "./MeetPillar";

describe("MeetPillar", () => {
  it("shows registered and checked-in values without turning a snapshot into live data", () => {
    const markup = renderToStaticMarkup(<MeetPillar resource={{
      status: "ready",
      data: {
        dataMode: "live", status: "snapshot", registered: 202,
        checkedIn: 0, checkInRate: 0, asOf: "2026-10-16T00:00:00Z",
      },
    }} />);

    expect(markup).toContain("202");
    expect(markup).toContain("Connect with the right people");
    expect(markup).toContain("Checked In");
    expect(markup).not.toContain("canceled");
  });
});
