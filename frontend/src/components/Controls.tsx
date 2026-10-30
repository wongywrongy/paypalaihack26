import { useEffect, useRef, useState, type ReactNode } from 'react';

const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  orders: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  products: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  agent: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  payouts: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  external: 'M7 17 17 7M8 7h9v9',
  check: 'M5 12.5l4.5 4.5L19 7',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  replay: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M10.5 9.5v5l4-2.5z',
  alert: 'M12 8v5M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  right: 'M9 6l6 6-6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 18.5h.01M17 18.5h.01',
  box: 'M4 7h16v13H4zM12 7v13M4 7l3-4h10l3 4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  pause: 'M9 6v12M15 6v12',
  play: 'M8 5v14l11-7z',
  x: 'M6 6l12 12M18 6 6 18',
} as const;
export type IconName = keyof typeof paths;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

/** An error with its own retry. Replaces bare "Try again" links. */
export function Notice({ children, onRetry, retryLabel = 'Try again', busy = false }: { children: ReactNode; onRetry?: () => void; retryLabel?: string; busy?: boolean }) {
  return <div className="notice" role="alert"><Icon name="alert" size={19} /><span className="notice-text">{children}</span>{onRetry && <button type="button" className="button secondary small" onClick={onRetry} disabled={busy}><Icon name="refresh" size={15} />{retryLabel}</button>}</div>;
}

export function Pill({ tone = 'neutral', children, dot = false }: { tone?: 'neutral' | 'won' | 'live' | 'waiting' | 'info'; children: ReactNode; dot?: boolean }) {
  return <span className={`pill pill-${tone}`}>{dot && <span className="pill-dot" aria-hidden="true" />}{children}</span>;
}

/** A "more" button that opens a confirmation before a destructive action. */
export function ConfirmMenu({ label, title, body, confirm, onConfirm, disabled = false }: { label: string; title: string; body: string; confirm: string; onConfirm: () => Promise<void> | void; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="confirm-menu" ref={box}><button type="button" className="icon-button" aria-label={label} aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}><Icon name="more" size={20} /></button>{open && <div className="popover" role="dialog" aria-label={title}><strong>{title}</strong><p>{body}</p><div className="popover-actions"><button type="button" className="button ghost small" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="button danger small" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}><Icon name="refresh" size={15} />{busy ? 'Working…' : confirm}</button></div></div>}</div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { if (!message) return; const timer = setTimeout(onDone, 2800); return () => clearTimeout(timer); }, [message, onDone]);
  return message ? <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={13} /></span>{message}</div> : null;
}
