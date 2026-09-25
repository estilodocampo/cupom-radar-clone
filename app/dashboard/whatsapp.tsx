'use client';
import { useEffect, useState } from 'react';

interface Group { id: string; name: string }
interface Sched { id: string; groupName: string | null; groupJid: string; message: string; scheduledAt: string; status: string }
interface Disp { id: string; groupJid: string; status: string; sentAt: string; error: string | null }

export default function Whatsapp() {
  const [status, setStatus] = useState<{ connected?: boolean; phone?: string; error?: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [sched, setSched] = useState<Sched[]>([]);
  const [logs, setLogs] = useState<Disp[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const s = await fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null);
    setStatus(s);
    if (s && !s.connected) {
      const q = await fetch('/api/whatsapp/qr').then((r) => r.json()).catch(() => null);
      setQr(q?.qr || null);
    } else setQr(null);
    const g = await fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null);
    setGroups(g?.groups || []);
    const sc = await fetch('/api/schedule').then((r) => r.json()).catch(() => null);
    setSched(sc?.items || []);
    const dl = await fetch('/api/dispatches').then((r) => r.json()).catch(() => null);
    setLogs(dl?.items || []);
  }

  useEffect(() => { load(); }, []);

  async function sendTest() {
    setMsg('Enviando...');
    const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, text }) }).then((x) => x.json());
    setMsg(r.ok ? 'Enviado!' : `Erro: ${r.error}`);
    load();
  }

  async function schedule() {
    setMsg('Agendando...');
    const g = groups.find((x) => x.id === to);
    const r = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupJid: to, groupName: g?.name, message: text, scheduledAt: when }) }).then((x) => x.json());
    setMsg(r.ok ? 'Agendado!' : `Erro: ${r.error}`);
    load();
  }

  return (
    <section style={{ marginTop: 32, borderTop: '1px solid #222', paddingTop: 24 }}>
      <h2>WhatsApp (Fase 2)</h2>
      <p>Status: {status == null ? '...' : status.connected ? `Conectado (${status.phone || ''})` : 'Desconectado — escaneie o QR'}</p>
      {!status?.connected && qr && <img src={qr} alt="QR WhatsApp" style={{ width: 220, background: '#fff', padding: 8, borderRadius: 8 }} />}
      <div style={{ marginTop: 8 }}><button onClick={load}>Atualizar</button></div>
      <h3>Enviar / Agendar</h3>
      <select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }}>
        <option value="">Selecione o grupo...</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Ou JID do grupo" style={{ width: '100%', padding: 8, marginBottom: 8 }} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem (cole o texto gerado acima)" rows={4} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ padding: 8, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={sendTest}>Enviar agora</button>
        <button onClick={schedule}>Agendar</button>
      </div>
      {msg && <p>{msg}</p>}
      <h3>Agendados</h3>
      <ul>{sched.map((s) => <li key={s.id}>{new Date(s.scheduledAt).toLocaleString()} — {s.groupName || s.groupJid} — {s.status}</li>)}</ul>
      <h3>Histórico</h3>
      <ul>{logs.map((l) => <li key={l.id}>{new Date(l.sentAt).toLocaleString()} — {l.groupJid} — {l.status}{l.error ? ` (${l.error})` : ''}</li>)}</ul>
    </section>
  );
}
