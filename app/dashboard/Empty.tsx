'use client';

export default function Empty({ icon = '📭', text, actionLabel, actionHref, onAction }: {
  icon?: string;
  text: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-ico" aria-hidden>{icon}</span>
      <p><b>Nada aqui ainda.</b> {text}</p>
      {actionLabel && (actionHref
        ? <a className="btn btn-primary btn-sm" href={actionHref}>{actionLabel}</a>
        : <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>)}
    </div>
  );
}
