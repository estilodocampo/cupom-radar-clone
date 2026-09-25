'use client';
import { useState } from 'react';

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState('');
  async function send() {
    const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).then((x) => x.json());
    if (r.ok) { setMsg('✅ Obrigado pelo feedback!'); setMessage(''); }
    else setMsg(`❌ ${r.error}`);
  }
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● CONFIGURAÇÕES</div>
      <h1 className="h1">Enviar Feedback</h1>
      <p className="sub">Sua opinião melhora a ferramenta.</p>
      <div className="card" style={{ maxWidth: 520 }}>
        <textarea className="input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte o que achou..." />
        <button className="btn btn-primary btn-sm" onClick={send}>Enviar</button>
        {msg && <p>{msg}</p>}
      </div>
    </>
  );
}
