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
});
