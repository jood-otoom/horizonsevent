export default function ControllerHeader({ onSettings, disabled = false }: { onSettings?: () => void; disabled?: boolean }) {
  return (
    <header className="controller-header">
      <h1><span>EVENT OPERATIONS</span> Staff Controller</h1>
      <button type="button" className="controller-secondary-action controller-settings-button" onClick={onSettings}
        aria-label="Settings" aria-haspopup="dialog" disabled={disabled}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m9.5 3-.6 2.2-1.4.8-2.2-.6-2.5 4.2 1.6 1.6v1.6L2.8 14l2.5 4.2 2.2-.6 1.4.8.6 2.6h5l.6-2.6 1.4-.8 2.2.6 2.5-4.2-1.6-1.2v-1.6l1.6-1.6-2.5-4.2-2.2.6-1.4-.8L14.5 3z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </button>
    </header>
  );
}
