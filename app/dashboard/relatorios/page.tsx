'use client';
import { useEffect, useState } from 'react';

interface Disp { id: string; groupJid: string; status: string; sentAt: string; error: string | null }

export default function Relatorios() {
  const [logs, setLogs] = useState<Disp[]>([]);
  useEffect(() => {
    fetch('/api/dispatches').then((r) => r.json()).then((d) => setLogs(d.items || [])).catch(() => {});
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
        <h3>Últimos disparos</h3>
        {logs.length === 0 ? <p className="hint">Nenhum disparo ainda.</p> : (
          <ul className="list">{logs.map((l) => <li key={l.id}><b>{new Date(l.sentAt).toLocaleString()}</b> — {l.groupJid} — <span className={`badge ${l.status === 'sent' ? 'badge-ok' : 'badge-err'}`}>{l.status}</span></li>)}</ul>
        )}
      </div>
    </>
  );
}
