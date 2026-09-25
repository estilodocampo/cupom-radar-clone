'use client';
import { useEffect, useState } from 'react';

export default function Dados() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then((d) => { setName(d.name || ''); setEmail(d.email || ''); }).catch(() => {});
  }, []);
  async function save() {
    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Dados salvos!' : `❌ ${r.error}`);
  }
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● CONFIGURAÇÕES</div>
      <h1 className="h1">Seus Dados</h1>
      <p className="sub">Sua identidade nas ofertas.</p>
      <div className="card" style={{ maxWidth: 520 }}>
        <label className="lbl">Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="lbl">Email</label>
        <input className="input" value={email} disabled />
        <button className="btn btn-primary btn-sm" onClick={save}>Salvar</button>
        {msg && <p>{msg}</p>}
      </div>
    </>
  );
}
