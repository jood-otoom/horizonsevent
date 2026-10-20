import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ControllerStats } from "../../types/controller";
import FeedbackController from "./FeedbackController";
import MeetingController from "./MeetingController";

const emptyStats: ControllerStats = {
  dataMode: "mock",
  completedMeetings: 0,
  feedbackCount: 0,
  averageRating: null,
};

describe("controller cards", () => {
  it("shows the empty meeting count and disables its button during submission", () => {
    const markup = renderToStaticMarkup(
      <MeetingController stats={emptyStats} state="pending" message="" activeQuantity={1} onSubmit={() => {}} />,
    );
    expect(markup).toContain("0 completed meetings");
    expect(markup).toContain("Recording…");
    expect(markup).toContain("disabled");
  });

  it("shows empty feedback and requires a star selection before submission", () => {
    const markup = renderToStaticMarkup(
      <FeedbackController stats={emptyStats} state="idle" message="" onSubmit={async () => true} />,
    );
    expect(markup).toContain("No ratings yet");
    expect(markup).toContain("Select a rating from 1 to 5");
    expect(markup).toContain("Feedback received");
    expect(markup).toContain('aria-label="5 stars"');
    expect(markup).toContain("disabled");
  });

  it("formats provider statistics to one decimal place", () => {
    const markup = renderToStaticMarkup(
      <FeedbackController
        stats={{ ...emptyStats, feedbackCount: 3, averageRating: 11 / 3 }}
        state="idle"
        message=""
        onSubmit={async () => true}
      />,
    );
    expect(markup).toContain("3.7 / 5.0");
  });
});
