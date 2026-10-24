// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockControllerService } from "../../services/mockControllerProvider";
import StaffController from "./StaffController";

let nextId = 0;

beforeEach(() => {
  nextId = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `test-${++nextId}` });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffController", () => {
  it("loads zero synthetic records and keeps rating submission disabled until selection", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0 })} />);
    expect(screen.getByText("Loading demo statistics…")).toBeTruthy();
    expect(await screen.findByLabelText("0 completed meetings")).toBeTruthy();
    expect(screen.getByText("No ratings yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit Rating" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("heading", { name: "EVENT OPERATIONS Staff Controller" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check-ins Controller" })).toBeTruthy();
    expect((screen.getByText(/Action History/).closest("details") as HTMLDetailsElement).open).toBe(false);
  });

  it("disables a pending meeting action and ignores a rapid second click", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 30 })} />);
    const button = await screen.findByRole("button", { name: "1 Meeting" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Recording…" }).hasAttribute("disabled")).toBe(true);
    expect(await screen.findByText("Meeting recorded successfully. Total: 1.")).toBeTruthy();
    expect(screen.getByLabelText("1 completed meetings")).toBeTruthy();
  });

  it("records three meetings from the +3 control", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0 })} />);
    const button = await screen.findByRole("button", { name: "3 Meetings" });
    fireEvent.click(button);
    expect(await screen.findByText("Meeting recorded successfully. Total: 3.")).toBeTruthy();
    expect(screen.getByLabelText("3 completed meetings")).toBeTruthy();
  });

  it("keeps the count unchanged after failure, then retries with one record", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0, failNext: { meeting: 1 } })} />);
    const button = await screen.findByRole("button", { name: "1 Meeting" });
    fireEvent.click(button);
    expect(await screen.findByText(/Meeting was not confirmed/)).toBeTruthy();
    expect(screen.getByLabelText("0 completed meetings")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1 Meeting" }));
    expect(await screen.findByText("Meeting recorded successfully. Total: 1.")).toBeTruthy();
    expect(screen.getByLabelText("1 completed meetings")).toBeTruthy();
  });

  it("selects stars, submits feedback, updates statistics, and clears the selection", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0 })} />);
    await screen.findByText("No ratings yet");
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    expect(screen.getByText("Selected rating: 4/5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 stars" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "5 stars" }).textContent).toBe("☆");
    fireEvent.click(screen.getByRole("button", { name: "Submit Rating" }));
    expect(await screen.findByText("4-star feedback submitted successfully.")).toBeTruthy();
    expect(screen.getByText("4.0 / 5.0")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Select a rating from 1 to 5")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Submit Rating" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Feedback received").nextElementSibling?.textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "2 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Rating" }));
    expect(await screen.findByText("2-star feedback submitted successfully.")).toBeTruthy();
    expect(screen.getByText("3.0 / 5.0")).toBeTruthy();
    expect(screen.getByText("Feedback received").nextElementSibling?.textContent).toBe("2");
  });

  it("locks the rating after failure and safely retries the same feedback", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0, failNext: { feedback: 1 } })} />);
    await screen.findByText("No ratings yet");
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Rating" }));
    expect(await screen.findByText(/Feedback was not confirmed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 stars" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Feedback received").nextElementSibling?.textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Retry Rating" }));
    expect(await screen.findByText("5-star feedback submitted successfully.")).toBeTruthy();
    expect(screen.getByText("5.0 / 5.0")).toBeTruthy();
    expect(screen.getByText("Feedback received").nextElementSibling?.textContent).toBe("1");
  });

  it("shows a loading error without invented values and recovers on retry", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0, failNext: { stats: 1 } })} />);
    expect(await screen.findByText("Demo statistics could not be loaded. No values have been assumed.")).toBeTruthy();
    expect(screen.queryByText("No ratings yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(await screen.findByLabelText("0 completed meetings")).toBeTruthy();
  });

  it("reverses a specific +3 action on one click and keeps the original visible", async () => {
    const service = createMockControllerService({ delayMs: 30 });
    const undo = vi.spyOn(service, "undoAction");
    render(<StaffController service={service} />);
    fireEvent.click(await screen.findByRole("button", { name: "3 Meetings" }));
    await screen.findByLabelText("3 completed meetings");
    fireEvent.click(screen.getByText(/Action History/));
    const undoButton = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undoButton);
    fireEvent.click(undoButton);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Reversing action…")).toBeTruthy();
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm undo" })).toBeNull();
    await waitFor(() => expect(undo).toHaveBeenCalledWith(expect.objectContaining({ reason: "other" })));
    expect(await screen.findByLabelText("0 completed meetings")).toBeTruthy();
    expect(await screen.findByText("Reversed")).toBeTruthy();
    expect(screen.getByText("Selected meeting action reversed. Total: 0.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("retries an uncertain correction without changing its request ID", async () => {
    render(<StaffController service={createMockControllerService({ delayMs: 0, failNext: { undo: 1 } })} />);
    fireEvent.click(await screen.findByRole("button", { name: "1 Meeting" }));
    await screen.findByLabelText("1 completed meetings");
    fireEvent.click(screen.getByText(/Action History/));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText(/Correction was not confirmed/)).toBeTruthy();
    expect(screen.getByLabelText("1 completed meetings")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry undo" }));
    expect(await screen.findByLabelText("0 completed meetings")).toBeTruthy();
    expect(nextId).toBe(3);
  });

  it("reveals check-ins on demand, saves one, and hides without reversing it", async () => {
    const service = createMockControllerService({ delayMs: 0, initialCheckins: 4, registered: 6 });
    render(<StaffController service={service} />);
    await screen.findByRole("button", { name: "Check-ins Controller" });
    expect(screen.queryByRole("heading", { name: "CHECK-INS Controller" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check-ins Controller" }));
    expect(await screen.findByText("of 6 registered")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+1 Check-in" }));
    expect(await screen.findByText("Check-in saved. Total: 5.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("heading", { name: "CHECK-INS Controller" })).toBeNull();
    expect((await service.getCheckins()).checkedIn).toBe(5);
    fireEvent.click(screen.getByRole("button", { name: "Check-ins Controller" }));
    expect(await screen.findByText("of 6 registered")).toBeTruthy();
    expect(screen.getByText("Check-in saved. Total: 5.")).toBeTruthy();
  });

  it("limits expanded history to the five newest combined actions", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    for (let index = 0; index < 6; index++) {
      await service.submitMeeting({ requestId: `history-${index}`, quantity: 1 });
    }
    render(<StaffController service={service} />);
    await screen.findByLabelText("6 completed meetings");
    fireEvent.click(screen.getByText(/Action History/));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(5));
    expect((await service.getStats()).completedMeetings).toBe(6);
  });

  it("keeps an in-flight check-in when the panel is hidden", async () => {
    const service = createMockControllerService({ delayMs: 35, initialCheckins: 4, registered: 6 });
    render(<StaffController service={service} />);
    fireEvent.click(await screen.findByRole("button", { name: "Check-ins Controller" }));
    fireEvent.click(await screen.findByRole("button", { name: "+1 Check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(async () => expect((await service.getCheckins()).checkedIn).toBe(5));
    fireEvent.click(screen.getByRole("button", { name: "Check-ins Controller" }));
    expect(await screen.findByText("Check-in saved. Total: 5.")).toBeTruthy();
  });
});
