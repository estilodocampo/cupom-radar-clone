'use client';
import { useState } from 'react';
import Whatsapp from '../../whatsapp';

export default function Produtos() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('Fone Bluetooth TWS');
  const [priceTo, setPriceTo] = useState('R$ 49,90');
  const [result, setResult] = useState('');

  async function generate() {
    setResult('Gerando...');
    const res = await fetch('/api/generate-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, title, priceTo }) });
    const data = await res.json();
    setResult((data.text || JSON.stringify(data)) + (data.warning ? `\n\n⚠️ ${data.warning}` : ''));
  }

  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● POSTAGENS</div>
      <h1 className="h1">Produtos</h1>
      <p className="sub">Gere a oferta e dispare nos seus grupos.</p>
      <div className="grid" style={{ maxWidth: 720 }}>
        <div className="card">
          <h3>✨ Gerar oferta</h3>
          <label className="lbl">Link do produto</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <label className="lbl">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="lbl">Preço</label>
          <input className="input" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={generate}>Gerar postagem</button>
          {result && <div className="result">{result}</div>}
        </div>
        <Whatsapp />
      </div>
    </>
  );
}
