// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockControllerService } from "../../services/mockControllerProvider";
import StaffController from "./StaffController";

afterEach(cleanup);

async function openSettings(service = createMockControllerService({ delayMs: 0 })) {
  render(<StaffController service={service} />);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  await screen.findByRole("heading", { name: "B2Match API synchronization" });
  return service;
}

describe("controller Settings", () => {
  it("opens and closes a labelled modal without executing a reset", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    const update = vi.spyOn(service, "updateSettings");
    await openSettings(service);
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe("settings-title");
    fireEvent.click(screen.getByRole("button", { name: "Reset MATCH & MEET Totals" }));
    expect(screen.getByRole("button", { name: "Confirm reset" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Type RESET EVENT to confirm"), { target: { value: "RESET" } });
    expect(screen.getByRole("button", { name: "Confirm reset" }).hasAttribute("disabled")).toBe(true);
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("requires typed confirmation and preserves GROW and target during synthetic reset", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    await service.submitMeeting({ requestId: "seed-meeting", quantity: 3 });
    await service.submitFeedback({ requestId: "seed-rating", rating: 5 });
    await openSettings(service);
    fireEvent.click(screen.getByRole("button", { name: "Reset MATCH & MEET Totals" }));
    fireEvent.change(screen.getByLabelText("Type RESET EVENT to confirm"), { target: { value: "RESET EVENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    await screen.findByText("Saved. The dashboard is updating.");
    expect(await service.getStats()).toMatchObject({ completedMeetings: 0, feedbackCount: 1, averageRating: 5 });
    expect(await service.getSettings()).toMatchObject({ registered: 0, checkedIn: 0, meetingTarget: 1200 });
  });

  it("saves exact registrations and target while preserving completed meetings", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    await service.submitMeeting({ requestId: "seed-meeting", quantity: 2 });
    await openSettings(service);
    fireEvent.change(screen.getByLabelText("Registered participants override"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("MATCH target meetings"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
    await screen.findByText("Saved. The dashboard is updating.");
    expect(await service.getSettings()).toMatchObject({ registered: 150, registeredOverride: 150, meetingTarget: 1500 });
    expect((await service.getStats()).completedMeetings).toBe(2);
  });

  it("confirms Manual Mode and permanently disables Start Sync", async () => {
    const service = createMockControllerService({ delayMs: 0, initialMode: "api" });
    const update = vi.spyOn(service, "updateSettings");
    await openSettings(service);
    fireEvent.click(screen.getByRole("button", { name: "Activate Manual Mode" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Manual Mode" }));
    await screen.findByText("Saved. The dashboard is updating.");
    expect(screen.getByRole("button", { name: "Start Sync" }).hasAttribute("disabled")).toBe(true);
    expect((await service.getSettings()).mode).toBe("manual");
  });

  it("denies staff access and exposes no admin operation controls", async () => {
    const service = createMockControllerService({ delayMs: 0, role: "staff" });
    const update = vi.spyOn(service, "updateSettings");
    render(<StaffController service={service} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Settings and exact-total corrections are available to event administrators only.");
    expect(screen.queryByRole("button", { name: "Start Sync" })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("retains one request ID after an uncertain response and blocks conflicting actions", async () => {
    const service = createMockControllerService({ delayMs: 0 });
    const real = service.updateSettings;
    let loseResponse = true;
    const update = vi.spyOn(service, "updateSettings").mockImplementation(async request => {
      const response = await real(request);
      if (loseResponse) { loseResponse = false; throw new Error("Response lost"); }
      return response;
    });
    await openSettings(service);
    fireEvent.change(screen.getByLabelText("MATCH target meetings"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
    await screen.findByText("Response lost");
    expect(screen.getByRole("button", { name: "Reset MATCH & MEET Totals" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry pending operation" }));
    await screen.findByText("Saved. The dashboard is updating.");
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0]).toEqual(update.mock.calls[1][0]);
    await waitFor(async () => expect((await service.getSettings()).meetingTarget).toBe(1500));
  });
});

it("shows a stopped API failure and manual fallback without issuing an automatic mutation", async () => {
  const service = createMockControllerService({ delayMs: 0, initialMode: "api", initialCheckins: 4, registered: 30 });
  const real = await service.getSettings();
  vi.spyOn(service, "getSettings").mockResolvedValue({ ...real, syncState: "failed", syncEnabled: false,
    error: "API rate limit reached (429). Automatic synchronization stopped.", httpStatus: 429 });
  const mutate = vi.spyOn(service, "updateSettings");
  await openSettings(service);
  expect(screen.getByText("Failed")).toBeTruthy();
  expect(screen.getByText("API rate limit reached (429). Automatic synchronization stopped.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Activate Manual Mode" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Stop Sync" }).hasAttribute("disabled")).toBe(true);
  expect(mutate).not.toHaveBeenCalled();
  expect((await service.getCheckins()).checkedIn).toBe(4);
});

it("allows a registration override in API mode without activating Manual Mode", async () => {
  const service = await openSettings(createMockControllerService({ delayMs: 0, initialMode: "api" }));
  fireEvent.change(screen.getByLabelText("Registered participants override"), { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
  await screen.findByText("Saved. The dashboard is updating.");
  expect(await service.getSettings()).toMatchObject({ registered: 150, registeredOverride: 150, mode: "api" });
});

it("rejects a stale Settings form until the administrator refreshes and reviews it", async () => {
  const service = await openSettings();
  fireEvent.change(screen.getByLabelText("MATCH target meetings"), { target: { value: "1500" } });
  const initial = await service.getSettings();
  await service.updateSettings({ kind: "update_settings", requestId: "another-admin", expectedVersion: initial.version, registeredOverride: 130 });
  fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
  await screen.findByText("The event values changed. Refresh the latest values before trying again.");
  expect((await service.getSettings()).meetingTarget).toBe(1200);
  fireEvent.click(screen.getByRole("button", { name: "Refresh Settings" }));
  await waitFor(() => expect((screen.getByLabelText("Registered participants override") as HTMLInputElement).value).toBe("130"));
  fireEvent.change(screen.getByLabelText("MATCH target meetings"), { target: { value: "1500" } });
  fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
  await screen.findByText("Saved. The dashboard is updating.");
  expect(await service.getSettings()).toMatchObject({ registered: 130, meetingTarget: 1500 });
});

it("keeps uncertain reset errors and safe retry inside the active confirmation dialog", async () => {
  const service = createMockControllerService({ delayMs: 0 });
  const real = service.updateSettings;
  let loseResponse = true;
  const update = vi.spyOn(service, "updateSettings").mockImplementation(async request => {
    const result = await real(request);
    if (loseResponse) { loseResponse = false; throw new Error("Reset response lost"); }
    return result;
  });
  await openSettings(service);
  fireEvent.click(screen.getByRole("button", { name: "Reset MATCH & MEET Totals" }));
  const confirmation = screen.getByRole("dialog", { name: "Confirm event reset" });
  fireEvent.change(within(confirmation).getByLabelText("Type RESET EVENT to confirm"), { target: { value: "RESET EVENT" } });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm reset" }));
  expect(await within(confirmation).findByRole("alert")).toHaveProperty("textContent", "Reset response lost");
  fireEvent.click(within(confirmation).getByRole("button", { name: "Retry pending operation" }));
  await screen.findByText("Saved. The dashboard is updating.");
  expect(update.mock.calls[0][0]).toEqual(update.mock.calls[1][0]);
});

it("clears successful pre-reset totals after resetting through Settings", async () => {
  const service = createMockControllerService({ delayMs: 0, initialCheckins: 4, registered: 2000 });
  render(<StaffController service={service} />);
  fireEvent.click(await screen.findByRole("button", { name: "1 Meeting" }));
  await screen.findByText("Meeting recorded successfully. Total: 1.");
  fireEvent.click(screen.getByRole("button", { name: "Check-ins Controller" }));
  fireEvent.change(await screen.findByLabelText("Exact checked-in total"), { target: { value: "1500" } });
  fireEvent.click(screen.getByRole("button", { name: "Set exact total" }));
  await screen.findByText("Exact check-in total saved: 1500.");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(await screen.findByRole("button", { name: "Reset MATCH & MEET Totals" }));
  const confirmation = screen.getByRole("dialog", { name: "Confirm event reset" });
  fireEvent.change(within(confirmation).getByLabelText("Type RESET EVENT to confirm"), { target: { value: "RESET EVENT" } });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm reset" }));
  await screen.findByText("Saved. The dashboard is updating.");
  await screen.findByLabelText("0 completed meetings");
  expect(screen.queryByText("Meeting recorded successfully. Total: 1.")).toBeNull();
  expect(screen.queryByText("Exact check-in total saved: 1500.")).toBeNull();
  expect(await service.getCheckins()).toMatchObject({ registered: 0, checkedIn: 0 });
});

it("preserves an uncertain check-in retry across a successful Settings save", async () => {
  const service = createMockControllerService({ delayMs: 0, initialCheckins: 4, registered: 30, failNext: { checkin: 1 } });
  const submit = vi.spyOn(service, "submitCheckin");
  render(<StaffController service={service} />);
  fireEvent.click(await screen.findByRole("button", { name: "Check-ins Controller" }));
  fireEvent.click(await screen.findByRole("button", { name: "+5 Check-ins" }));
  await screen.findByText("Check-in was not confirmed. Retry with the same submission ID.");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(await screen.findByLabelText("MATCH target meetings"), { target: { value: "1500" } });
  fireEvent.click(screen.getByRole("button", { name: "Save dashboard settings" }));
  await screen.findByText("Saved. The dashboard is updating.");
  fireEvent.click(screen.getByRole("button", { name: "Close Settings" }));
  const retry = await screen.findByRole("button", { name: "+5 Check-ins" });
  expect(screen.getByRole("button", { name: "+1 Check-in" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(retry);
  await screen.findByText("Check-in saved. Total: 9.");
  expect(submit.mock.calls[0][0]).toEqual(submit.mock.calls[1][0]);
});
