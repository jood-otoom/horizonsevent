import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MatchPillar from "./MatchPillar";

describe("MatchPillar", () => {
  it("keeps actual meetings separate from the approved target and shows small progress", () => {
    const markup = renderToStaticMarkup(<MatchPillar metrics={{
      dataMode: "live", status: "live", completedMeetings: 1, targetMeetings: 1200,
    }} />);

    expect(markup).toContain("of 1,200");
    expect(markup).toContain("0.08%");
    expect(markup).toContain("1 completed meeting of 1200 target meetings");
  });

  it("distinguishes missing data, a confirmed zero, and retained stale data", () => {
    const pending = renderToStaticMarkup(<MatchPillar metrics={{
      dataMode: "live", status: "pending", completedMeetings: null, targetMeetings: null,
    }} />);
    const zero = renderToStaticMarkup(<MatchPillar metrics={{
      dataMode: "live", status: "live", completedMeetings: 0, targetMeetings: 1200,
    }} />);
    const stale = renderToStaticMarkup(<MatchPillar metrics={{
      dataMode: "live", status: "stale", completedMeetings: 4, targetMeetings: 1200,
    }} />);
    expect(pending).toContain("Unavailable");
    expect(pending).not.toContain("Target pending");
    expect(pending).toContain('class="metric-value metric-value-emphasis">—</dd>');
    expect(zero).toContain('>0%</span>');
    expect(stale).toContain('class="gauge-label">of 1,200</span>');
    expect(stale).toContain("4 completed meetings of 1200 target meetings");
    expect(stale).not.toContain("Stale");
  });
});
