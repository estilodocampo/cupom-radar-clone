'use client';
import { useEffect, useState } from 'react';

interface Disp { id: string; groupJid: string; status: string; sentAt: string; error: string | null }
interface LinkStat { code: string; clicks: number; slot: string; url: string }

export default function Relatorios() {
  const [logs, setLogs] = useState<Disp[]>([]);
  const [bySlot, setBySlot] = useState<{ slot: string; clicks: number; links: number }[]>([]);
  const [top, setTop] = useState<LinkStat[]>([]);
  useEffect(() => {
    fetch('/api/dispatches').then((r) => r.json()).then((d) => setLogs(d.items || [])).catch(() => {});
    fetch('/api/links/stats').then((r) => r.json()).then((d) => { setBySlot(d.bySlot || []); setTop(d.top || []); }).catch(() => {});
  }, []);
  const sent = logs.filter((l) => l.status === 'sent').length;
  const failed = logs.filter((l) => l.status !== 'sent').length;
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● DESEMPENHO</div>
      <h1 className="h1">Relatórios</h1>
      <p className="sub">Acompanhe seus disparos.</p>
      <div className="grid grid-3">
        <div className="card"><small className="hint">ENVIADOS</small><div className="price">{sent}</div></div>
        <div className="card"><small className="hint">FALHAS</small><div className="price">{failed}</div></div>
        <div className="card"><small className="hint">TOTAL</small><div className="price">{logs.length}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>📱 Cliques por número</h3>
        {bySlot.length === 0 ? <p className="hint">Nenhum clique ainda.</p> : (
          <div className="grid grid-4">
            {bySlot.map((b) => (
              <div className="card" key={b.slot}>
                <small className="hint">WHATSAPP {b.slot === 'wa2' ? '2' : '1'}</small>
                <div className="price">{b.clicks}</div>
                <p className="hint">{b.links} links</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>🔝 Links mais clicados</h3>
        {top.length === 0 ? <p className="hint">Nenhum link ainda.</p> : (
          <ul className="list">{top.map((l) => (
            <li key={l.code}><b>/r/{l.code}</b> <span className="badge">📱 {l.slot === 'wa2' ? '2' : '1'}</span> — {l.clicks} cliques<br /><span className="hint">{l.url}</span></li>
          ))}</ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Últimos disparos</h3>
        {logs.length === 0 ? <p className="hint">Nenhum disparo ainda.</p> : (
          <ul className="list">{logs.map((l) => <li key={l.id}><b>{new Date(l.sentAt).toLocaleString()}</b> — {l.groupJid} — <span className={`badge ${l.status === 'sent' ? 'badge-ok' : 'badge-err'}`}>{l.status}</span></li>)}</ul>
        )}
      </div>
    </>
  );
}
