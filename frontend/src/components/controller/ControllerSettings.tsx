import { useEffect, useRef, useState } from "react";
import type { ControllerService } from "../../services/controllerService";
import { ControllerConflictError } from "../../services/controllerService";
import type { ControllerSettings as Settings, SettingsAction, SettingsRequest } from "../../types/controller";

interface Props {
  open: boolean;
  service: ControllerService;
  onClose: () => void;
  onSaved: () => void;
}

const stateLabel: Record<Settings["syncState"], string> = {
  stopped: "Stopped", starting: "Starting", running: "Running", syncing: "Syncing", failed: "Failed", manual: "Manual Mode",
};
const timestamp = (value: string | null) => value === null ? "—" : new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Amman" });
const integer = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

export default function ControllerSettings({ open, service, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState("");
  const [target, setTarget] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [review, setReview] = useState<"manual" | "reset" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const request = useRef<SettingsRequest | null>(null);
  const busy = useRef(false);
  const readSequence = useRef(0);

  function accept(next: Settings, resetForm: boolean) {
    setSettings(next);
    if (resetForm) {
      setRegistered(next.registered?.toString() ?? "");
      setTarget(next.meetingTarget?.toString() ?? "");
      setFormVersion(next.version);
    }
  }

  async function refresh(resetForm = true) {
    if (busy.current) return;
    const sequence = ++readSequence.current;
    if (resetForm) { setLoading(true); setError(""); }
    try {
      const next = await service.getSettings();
      if (sequence === readSequence.current) accept(next, resetForm);
    } catch (cause) {
      if (sequence === readSequence.current) setError(cause instanceof Error ? cause.message : "Settings could not be loaded.");
    } finally {
      if (sequence === readSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    if (node && !node.open) {
      if (typeof node.showModal === "function") node.showModal();
      else node.setAttribute("open", "");
    }
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(false); }, 5_000);
    return () => { window.clearInterval(timer); ++readSequence.current; };
    // Refresh reads status only; synchronization runs on the server.
  }, [open, service]);

  useEffect(() => {
    const node = resetDialog.current;
    if (!open || review !== "reset" || !node || node.open) return;
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", "");
  }, [open, review]);

  async function run(action?: SettingsAction) {
    if (busy.current || !settings || settings.role !== "admin") return;
    if (!request.current && action) request.current = { ...action, requestId: crypto.randomUUID(),
      expectedVersion: action.kind === "update_settings" ? formVersion : settings.version };
    if (!request.current) return;
    busy.current = true;
    ++readSequence.current;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await service.updateSettings(request.current);
      accept(response.settings, true);
      request.current = null;
      setReview(null); setConfirmation("");
      setMessage("Saved. The dashboard is updating.");
      onSaved();
    } catch (cause) {
      if (cause instanceof ControllerConflictError) request.current = null;
      setError(cause instanceof Error ? cause.message : "The request was not confirmed. Retry safely.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (!open) return null;
  const locked = pending || !!request.current;
  const admin = settings?.role === "admin";
  const active = settings?.syncEnabled || settings?.syncState === "starting" || settings?.syncState === "syncing";
  const manual = settings?.mode === "manual";
  const validRegistered = integer(registered) && Number(registered) >= (settings?.checkedIn ?? 0);
  const validTarget = integer(target) && Number(target) > 0;

  return (
    <dialog ref={dialog} className="controller-settings-modal" aria-labelledby="settings-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="controller-settings-heading">
        <h2 id="settings-title">Controller Settings</h2>
        <button type="button" className="controller-secondary-action" onClick={onClose} aria-label="Close Settings">Close</button>
      </div>
      <p className="controller-settings-note">Administrator controls · All times Asia/Amman</p>
      {loading && <p role="status">Loading settings…</p>}
      {error && review !== "reset" && <p className="controller-message-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {pending && review !== "reset" && <p role="status">Saving operation…</p>}
      {!pending && request.current && review !== "reset" && <button type="button" className="controller-secondary-action" onClick={() => { void run(); }}>Retry pending operation</button>}
      {!loading && !settings && <button type="button" className="controller-secondary-action" onClick={() => { void refresh(); }}>Retry loading Settings</button>}
      {settings && <>
        {!admin && <p role="status">Settings are available to event administrators only.</p>}
        <section className="controller-settings-section" aria-labelledby="settings-sync">
          <h3 id="settings-sync">B2Match API synchronization</h3>
          <p className="controller-sync-state" role="status">{manual ? "Manual Mode" : stateLabel[settings.syncState]}</p>
          <div className="controller-settings-actions">
            <button type="button" className="controller-action" disabled={!admin || locked || manual || active || !settings.canStart}
              onClick={() => { void run({ kind: "start_sync" }); }}>Start Sync</button>
            <button type="button" className="controller-secondary-action" disabled={!admin || locked || !active || manual}
              onClick={() => { void run({ kind: "stop_sync" }); }}>Stop Sync</button>
          </div>
          <dl className="controller-settings-details">
            <div><dt>Last successful fetch</dt><dd>{timestamp(settings.lastSuccessAt)}</dd></div>
            <div><dt>Last attempted fetch</dt><dd>{timestamp(settings.lastAttemptAt)}</dd></div>
            <div><dt>Next scheduled fetch</dt><dd>{timestamp(settings.nextSyncAt)}</dd></div>
            <div><dt>Last API registered</dt><dd>{settings.apiRegistered?.toLocaleString() ?? "—"}</dd></div>
            <div><dt>Last API checked in</dt><dd>{settings.apiCheckedIn?.toLocaleString() ?? "—"}</dd></div>
          </dl>
          {settings.error && <p className="controller-message-error" role="alert">{settings.error}</p>}
          {!manual && !active && !settings.canStart && <p role="status">Start Sync is unavailable in the current server configuration.</p>}
          <p className="controller-settings-note">Start fetches immediately, then every two minutes on the server. Any failure stops synchronization until an administrator acts.</p>
        </section>
        <section className="controller-settings-section" aria-labelledby="settings-meet">
          <h3 id="settings-meet">Manual MEET controls</h3>
          <p>Registered: <strong>{settings.registered?.toLocaleString() ?? "—"}</strong> · Checked in: <strong>{settings.checkedIn?.toLocaleString() ?? "—"}</strong></p>
          <p>Current source: {settings.source}. Manual fallback: {manual ? "active" : "inactive"}.</p>
          <p className="controller-settings-note">Use the Check-ins Controller on the main page to enter check-ins.</p>
          {!manual && <button type="button" className="controller-secondary-action" disabled={!admin || locked || !!active}
            onClick={() => setReview("manual")}>Activate Manual Mode</button>}
          {review === "manual" && <div className="controller-confirmation" role="group" aria-label="Confirm Manual Mode">
            <p>Manual Mode stops API synchronization and cannot return to API mode during this event. API results will no longer replace manual totals.</p>
            <div className="controller-settings-actions">
              <button type="button" className="controller-action" disabled={locked} onClick={() => { void run({ kind: "manual_mode" }); }}>Confirm Manual Mode</button>
              <button type="button" className="controller-secondary-action" disabled={locked} onClick={() => setReview(null)}>Cancel</button>
            </div>
          </div>}
        </section>
        <section className="controller-settings-section" aria-labelledby="settings-dashboard">
          <h3 id="settings-dashboard">Dashboard settings</h3>
          <form onSubmit={event => {
            event.preventDefault();
            if (!validRegistered || !validTarget || locked) return;
            void run({ kind: "update_settings", ...(Number(registered) !== settings.registered ? { registeredOverride: Number(registered) } : {}),
              ...(Number(target) !== settings.meetingTarget ? { meetingTarget: Number(target) } : {}) });
          }}>
            <label htmlFor="registered-override">Registered participants override</label>
            <input id="registered-override" type="number" inputMode="numeric" min={settings.checkedIn ?? 0} step="1" value={registered}
              disabled={!admin || locked} onChange={event => setRegistered(event.target.value)} />
            <small>Exact effective total. Must be at least the current checked-in count. Last API value stays separate.</small>
            <label htmlFor="meeting-target">MATCH target meetings</label>
            <input id="meeting-target" type="number" inputMode="numeric" min="1" step="1" value={target}
              disabled={!admin || locked} onChange={event => setTarget(event.target.value)} />
            <button type="submit" className="controller-secondary-action" disabled={!admin || locked || !validRegistered || !validTarget ||
              Number(registered) === settings.registered && Number(target) === settings.meetingTarget}>Save dashboard settings</button>
          </form>
        </section>
        <section className="controller-settings-section controller-danger" aria-labelledby="settings-danger">
          <h3 id="settings-danger">Critical operations</h3>
          <button type="button" className="controller-secondary-action" disabled={!admin || locked} onClick={() => { setReview("reset"); setConfirmation(""); }}>Reset MATCH &amp; MEET Totals</button>
          {review === "reset" && <dialog ref={resetDialog} className="controller-settings-modal controller-reset-modal"
            aria-labelledby="reset-title" aria-describedby="reset-warning"
            onCancel={event => { event.preventDefault(); if (!locked) setReview(null); }}>
            <h3 id="reset-title">Confirm event reset</h3>
            <p id="reset-warning">This will reset MATCH completed meetings and MEET registration/check-in totals to zero. This action cannot be undone through the controller.</p>
            {error && <p className="controller-message-error" role="alert">{error}</p>}
            {pending && <p role="status">Saving operation…</p>}
            {!pending && request.current && <button type="button" className="controller-secondary-action" onClick={() => { void run(); }}>Retry pending operation</button>}
            <label htmlFor="reset-confirmation">Type RESET EVENT to confirm</label>
            <input id="reset-confirmation" value={confirmation} autoComplete="off" disabled={locked} onChange={event => setConfirmation(event.target.value)} />
            <div className="controller-settings-actions">
              <button type="button" className="controller-action" disabled={locked || confirmation !== "RESET EVENT"}
                onClick={() => { void run({ kind: "reset_event", confirmation: "RESET EVENT" }); }}>Confirm reset</button>
              <button type="button" className="controller-secondary-action" disabled={locked} onClick={() => setReview(null)}>Cancel</button>
            </div>
          </dialog>}
        </section>
        <button type="button" className="controller-secondary-action" disabled={locked || loading} onClick={() => { void refresh(); }}>Refresh Settings</button>
      </>}
    </dialog>
  );
}
