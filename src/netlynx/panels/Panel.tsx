import type { ReactNode } from 'react';
import { errors, nl } from '../content';
import type { ApiErrorKind } from '../api/http';

type Props = {
  id: string;
  title: string;
  meta?: ReactNode;
  credit: string;
  creditUrl: string;
  actions?: ReactNode;
  children: ReactNode;
  busy?: boolean;
};

export function Panel({ id, title, meta, credit, creditUrl, actions, children, busy }: Props) {
  return (
    <section className="panel" id={`panel-${id}`} aria-labelledby={`panel-${id}-title`} aria-busy={busy || undefined}>
      <header className="panel-head">
        <div>
          <h2 id={`panel-${id}-title`}>{title}</h2>
          {meta && <p className="panel-meta">{meta}</p>}
        </div>
        {actions}
      </header>
      <div className="panel-body">{children}</div>
      <p className="panel-credit">
        <a href={creditUrl} target="_blank" rel="noreferrer">{credit}</a>
      </p>
    </section>
  );
}

export function Skeleton({ rows = 4, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div className="skeleton" aria-hidden>
      {tall && <div className="sk sk--block" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ kind, message, onRetry }: { kind?: ApiErrorKind; message?: string; onRetry?: () => void }) {
  return (
    <div className="panel-error" role="status">
      <p>{message ?? (kind ? errors[kind] : errors.http)}</p>
      {onRetry && kind !== 'not_configured' && (
        <button className="chip" onClick={onRetry}>{nl.retry}</button>
      )}
    </div>
  );
}
