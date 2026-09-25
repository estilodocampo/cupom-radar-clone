'use client';
import { useEffect, useState } from 'react';

interface Sched { id: string; groupName: string | null; groupJid: string; message: string; scheduledAt: string; status: string }

export default function Fila() {
  const [items, setItems] = useState<Sched[]>([]);
  async function load() {
    const r = await fetch('/api/schedule').then((x) => x.json()).catch(() => null);
    setItems(r?.items || []);
  }
  useEffect(() => { load(); }, []);

  async function sendNow(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: it.groupJid, text: it.message }) }).then((x) => x.json());
    alert(r.ok ? 'Enviado!' : `Erro: ${r.error}`);
    load();
  }

  const pending = items.filter((x) => x.status === 'pending');
  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO FILA</div>
      <h1 className="h1">Modo Fila</h1>
      <p className="sub">Ofertas na fila disparam em sequência pelo worker. Adiante qualquer item manualmente.</p>
      <div className="card" style={{ maxWidth: 720 }}>
        {pending.length === 0 ? <p className="hint">Fila vazia. Agende ofertas na página de Produtos.</p> : (
          <ul className="list">{pending.map((s, i) => (
            <li key={s.id}><b>#{i + 1} {new Date(s.scheduledAt).toLocaleString()}</b> — {s.groupName || s.groupJid} <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => sendNow(s.id)}>Disparar agora</button></li>
          ))}</ul>
        )}
      </div>
    </>
  );
}
