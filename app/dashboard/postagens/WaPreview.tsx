'use client';

// Prévia fiel de como a oferta vai aparecer no WhatsApp:
// bolha de mensagem enviada, links em azul e horário + ✓✓.
const URL_RE = /(https?:\/\/[^\s)]+)/g;
const TRAIL_RE = /[.,!?;:]+$/;

function renderWithLinks(text: string) {
  const parts = text.split(URL_RE);
  return parts.map((p, i) => {
    if (i % 2 === 0 || !p) return <span key={i}>{p}</span>;
    const trail = p.match(TRAIL_RE)?.[0] || '';
    const href = trail ? p.slice(0, -trail.length) : p;
    return (
      <span key={i}>
        <a className="wa-link" href={href} target="_blank" rel="noreferrer">{href}</a>
        {trail}
      </span>
    );
  });
}

export default function WaPreview({ text }: { text: string }) {
  if (!text.trim()) return null;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="wa-phone" aria-label="Prévia da mensagem no WhatsApp">
      <div className="wa-bubble">
        <span>{renderWithLinks(text)}</span>
        <span className="wa-meta">{time} <span className="wa-check">✓✓</span></span>
      </div>
    </div>
  );
}
