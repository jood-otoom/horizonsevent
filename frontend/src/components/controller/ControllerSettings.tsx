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
  const [section, setSection] = useState<"sync" | "dashboard" | "reset">("sync");
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
      if (sequence === readSequence.current) {
        accept(next, resetForm);
        const waiting = request.current;
        // Status can confirm a sync switch after a lost receipt. Numerical changes
        // must retain their exact request for an idempotent retry instead.
        if (waiting && next.version > waiting.expectedVersion &&
          (waiting.kind === "start_sync" && next.syncEnabled ||
            waiting.kind === "stop_sync" && !next.syncEnabled)) {
          request.current = null;
          setError("");
          setMessage(waiting.kind === "stop_sync" ? "Sync stopped. Last fetched totals are preserved." : "Sync is running. You can stop it at any time.");
          onSaved();
        }
      }
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
      let response;
      try {
        response = await service.updateSettings(request.current);
      } catch (cause) {
        // A worker may advance the version while Stop is being submitted.
        // A rejected version has no effect, so retry Stop once with fresh state.
        if (!(cause instanceof ControllerConflictError) || request.current.kind !== "stop_sync") throw cause;
        const latest = await service.getSettings();
        request.current = { kind: "stop_sync", requestId: crypto.randomUUID(), expectedVersion: latest.version };
        response = await service.updateSettings(request.current);
      }
      const completed = request.current.kind;
      accept(response.settings, true);
      request.current = null;
      setReview(null); setConfirmation("");
      setMessage(completed === "stop_sync" ? "Sync stopped. Last fetched totals are preserved." :
        completed === "start_sync" ? "Sync started. Fetching now, then every two minutes." :
          completed === "reset_event" ? "MATCH and GROW totals reset. MEET attendance is unchanged." : "Saved. The dashboard is updating.");
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
  const operationName = request.current?.kind === "start_sync" ? "starting sync" :
    request.current?.kind === "stop_sync" ? "stopping sync" :
    request.current?.kind === "reset_event" ? "resetting totals" :
    request.current?.kind === "manual_mode" ? "activating Manual Mode" : "saving dashboard settings";
  const validRegistered = integer(registered) && Number(registered) >= (settings?.checkedIn ?? 0);
  const validTarget = integer(target) && Number(target) > 0;

  return (
    <dialog ref={dialog} className="controller-settings-modal" aria-labelledby="settings-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="controller-settings-header">
        <div className="controller-settings-heading">
          <div><h2 id="settings-title">Controller Settings</h2><p className="controller-settings-note">New Horizons 2026 · Asia/Amman time</p></div>
          <button type="button" className="controller-secondary-action" onClick={onClose} aria-label="Close Settings">Close</button>
        </div>
        <nav className="controller-settings-nav" aria-label="Settings sections">
          {([['sync', 'Sync & attendance'], ['dashboard', 'Dashboard settings'], ['reset', 'Reset totals']] as const).map(([id, label]) =>
            <button key={id} type="button" aria-pressed={section === id} aria-controls={`settings-panel-${id}`}
              onClick={() => setSection(id)}>{label}</button>)}
        </nav>
      </header>
      <div className="controller-settings-content" aria-busy={pending || loading}>
        {loading && <p role="status">Loading settings…</p>}
        {error && review !== "reset" && <p className="controller-message-error" role="alert">{error}</p>}
        {message && <p className="controller-settings-feedback" role="status">{message}</p>}
        {pending && review !== "reset" && <p className="controller-settings-feedback" role="status">{operationName.charAt(0).toUpperCase() + operationName.slice(1)}…</p>}
        {!pending && request.current && review !== "reset" && <div className="controller-confirmation">
          <p>The result of {operationName} is not confirmed. Retry safely using the same request.</p>
          <button type="button" className="controller-secondary-action" onClick={() => { void run(); }}>Retry pending operation</button>
        </div>}
        {!loading && !settings && <button type="button" className="controller-secondary-action" onClick={() => { void refresh(); }}>Retry loading Settings</button>}
        {settings && <>
          {!admin && <p role="status">Settings are available to event administrators only.</p>}
          <div id="settings-panel-sync" hidden={section !== "sync"}>
            <section className="controller-settings-section controller-sync-card" aria-labelledby="settings-sync">
              <div className="controller-settings-section-heading">
                <div><h3 id="settings-sync">B2Match API synchronization</h3>
                  <p className={`controller-sync-state controller-sync-state-${manual ? "manual" : settings.syncState}`} role="status">
                    <span aria-hidden="true" />{manual ? "Manual Mode" : stateLabel[settings.syncState]}
                  </p>
                </div>
                <div className="controller-settings-actions">
                  <button type="button" className={active ? "controller-secondary-action" : "controller-action"} disabled={!admin || locked || manual || active || !settings.canStart}
                    onClick={() => { void run({ kind: "start_sync" }); }}>{pending && request.current?.kind === "start_sync" ? "Starting…" : "Start Sync"}</button>
                  <button type="button" className={active ? "controller-action" : "controller-secondary-action"} disabled={!admin || locked || !active || manual}
                    onClick={() => { void run({ kind: "stop_sync" }); }}>{pending && request.current?.kind === "stop_sync" ? "Stopping…" : "Stop Sync"}</button>
                </div>
              </div>
              <p className="controller-settings-note">{manual ? "API sync is disabled for this event session." :
                active ? "Fetches every two minutes, even when this tab is closed. Stop keeps your current totals." :
                  "Start fetches immediately, then every two minutes. Any API failure stops sync automatically."}</p>
              {settings.error && <p className="controller-message-error" role="alert">{settings.error}</p>}
              {!manual && !active && !settings.canStart && <p role="status">Start Sync is unavailable in the current server configuration.</p>}
              <dl className="controller-settings-details">
                <div><dt>Last successful fetch</dt><dd>{timestamp(settings.lastSuccessAt)}</dd></div>
                <div><dt>Last attempted fetch</dt><dd>{timestamp(settings.lastAttemptAt)}</dd></div>
                <div><dt>Next scheduled fetch</dt><dd>{settings.nextSyncAt ? timestamp(settings.nextSyncAt) : "None scheduled"}</dd></div>
                <div><dt>Last API registered</dt><dd>{settings.apiRegistered?.toLocaleString() ?? "—"}</dd></div>
                <div><dt>Last API checked in</dt><dd>{settings.apiCheckedIn?.toLocaleString() ?? "—"}</dd></div>
              </dl>
            </section>
            <section className="controller-settings-section" aria-labelledby="settings-meet">
              <h3 id="settings-meet">Manual MEET controls</h3>
              <dl className="controller-settings-totals">
                <div><dt>Registered</dt><dd>{settings.registered?.toLocaleString() ?? "—"}</dd></div>
                <div><dt>Checked in</dt><dd>{settings.checkedIn?.toLocaleString() ?? "—"}</dd></div>
              </dl>
              <p className="controller-settings-note">Source: {settings.registeredOverride !== null ? "registration override" :
                settings.source === "api" ? "B2Match API" : settings.source === "snapshot" ? "last saved snapshot" : settings.source === "reset" ? "event reset" : "manual entry"} · Manual fallback {manual ? "active" : "inactive"}</p>
              <p className="controller-settings-note">{manual ? "Use the Check-ins Controller on the main page to enter check-ins." :
                active ? "Stop sync before activating Manual Mode." : "Switch to manual entry if the API is unavailable. This cannot be reversed during this event session."}</p>
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
          </div>
        <section id="settings-panel-dashboard" hidden={section !== "dashboard"} className="controller-settings-section" aria-labelledby="settings-dashboard">
          <h3 id="settings-dashboard">Dashboard settings</h3>
          <p className="controller-settings-note">Update the displayed registration count or meeting goal. Completed meetings and ratings stay unchanged.</p>
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
        <section id="settings-panel-reset" hidden={section !== "reset"} className="controller-settings-section controller-danger" aria-labelledby="settings-danger">
          <h3 id="settings-danger">Reset MATCH &amp; GROW totals</h3>
          <p>Clear testing totals before the event.</p>
          <ul><li>MATCH completed meetings → 0</li><li>GROW rating count and average → cleared</li></ul>
          <p className="controller-settings-note">MEET registration/check-in totals, synchronization, manual mode, the meeting target and audit history are preserved. A separate confirmation is required.</p>
          <button type="button" className="controller-secondary-action" disabled={!admin || locked} onClick={() => { setReview("reset"); setConfirmation(""); }}>Reset MATCH &amp; GROW Totals</button>
          {review === "reset" && <dialog ref={resetDialog} className="controller-settings-modal controller-reset-modal"
            aria-labelledby="reset-title" aria-describedby="reset-warning"
            onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!locked) setReview(null); }}>
            <h3 id="reset-title">Confirm event reset</h3>
            <p id="reset-warning">This will reset MATCH completed meetings and GROW ratings to zero. MEET registration/check-in totals will remain unchanged. This action cannot be undone through the controller.</p>
            {error && <p className="controller-message-error" role="alert">{error}</p>}
            {pending && <p role="status">Saving operation…</p>}
            {!pending && request.current && <button type="button" className="controller-secondary-action" onClick={() => { void run(); }}>Retry pending operation</button>}
            <label htmlFor="reset-confirmation">Type RESET EVENT to confirm</label>
            <input id="reset-confirmation" value={confirmation} autoComplete="off" disabled={locked} onChange={event => setConfirmation(event.target.value)} />
            <div className="controller-settings-actions">
              <button type="button" className="controller-action" disabled={locked || confirmation !== "RESET EVENT"}
                onClick={() => { void run({ kind: "reset_event", scope: "match_grow", confirmation: "RESET EVENT" }); }}>Confirm reset</button>
              <button type="button" className="controller-secondary-action" disabled={locked} onClick={() => setReview(null)}>Cancel</button>
            </div>
          </dialog>}
        </section>
      </>}
      </div>
      <footer className="controller-settings-footer">
        <span className="controller-settings-note">Changes are saved to the live dashboard.</span>
        <button type="button" className="controller-secondary-action" disabled={pending || loading} onClick={() => { void refresh(); }}>Refresh Settings</button>
      </footer>
    </dialog>
  );
}
