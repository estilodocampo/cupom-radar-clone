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
    setMsg(r.ok ? '✅ Enviado!' : `❌ Erro: ${r.error}`);
    load();
  }

  async function schedule() {
    setMsg('Agendando...');
    const g = groups.find((x) => x.id === to);
    const r = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupJid: to, groupName: g?.name, message: text, scheduledAt: when }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Agendado!' : `❌ Erro: ${r.error}`);
    load();
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 720 }}>
      <div className="card">
        <h3>📲 Conexão WhatsApp</h3>
        <p>
          {status == null ? 'Verificando...' : status.connected
            ? <><span className="badge badge-ok">Conectado</span> <span className="hint">{status.phone || ''}</span></>
            : <><span className="badge badge-warn">Desconectado</span> <span className="hint">escaneie o QR abaixo</span></>}
        </p>
        {!status?.connected && qr && <div className="qr-box"><img src={qr} alt="QR WhatsApp" /></div>}
        <div style={{ marginTop: 12 }}><button className="btn btn-ghost btn-sm" onClick={load}>Atualizar status</button></div>
      </div>

      <div className="card">
        <h3>📤 Enviar / agendar oferta</h3>
        <label className="lbl">Grupo</label>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Selecione o grupo...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Ou cole o JID do grupo" />
        <label className="lbl">Mensagem</label>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui o texto gerado na aba Gerar oferta" rows={4} />
        <label className="lbl">Agendar para (opcional p/ envio imediato)</label>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={sendTest}>Enviar agora</button>
          <button className="btn btn-ghost" onClick={schedule}>Agendar</button>
        </div>
        {msg && <p>{msg}</p>}
      </div>

      <div className="card">
        <h3>⏰ Agendados</h3>
        {sched.length === 0 ? <p className="hint">Nenhum agendamento.</p> : (
          <ul className="list">{sched.map((s) => <li key={s.id}><b>{new Date(s.scheduledAt).toLocaleString()}</b> — {s.groupName || s.groupJid} — <span className="badge badge-info">{s.status}</span></li>)}</ul>
        )}
      </div>

      <div className="card">
        <h3>📜 Histórico de disparos</h3>
        {logs.length === 0 ? <p className="hint">Nenhum disparo ainda.</p> : (
          <ul className="list">{logs.map((l) => <li key={l.id}><b>{new Date(l.sentAt).toLocaleString()}</b> — {l.groupJid} — <span className={`badge ${l.status === 'sent' ? 'badge-ok' : 'badge-err'}`}>{l.status}</span>{l.error ? ` (${l.error})` : ''}</li>)}</ul>
        )}
      </div>
    </div>
  );
}
