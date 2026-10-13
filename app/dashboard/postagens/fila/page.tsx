'use client';
import { useEffect, useState } from 'react';
import Empty from '../../Empty';

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
      <h1 className="h1">Fila</h1>
      <div className="card" style={{ maxWidth: 720 }}>
        {pending.length === 0 ? <Empty icon="📋" text="Agende uma oferta para vê-la aqui." actionLabel="Criar" actionHref="/dashboard/postagens/produtos" /> : (
          <ul className="list">{pending.map((s, i) => (
            <li key={s.id}><b>#{i + 1} {new Date(s.scheduledAt).toLocaleString()}</b> — {s.groupName || s.groupJid} <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => sendNow(s.id)}>Disparar</button></li>
          ))}</ul>
        )}
      </div>
    </>
  );
}
