'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('Fone Bluetooth TWS');
  const [priceTo, setPriceTo] = useState('R$ 49,90');
  const [result, setResult] = useState('');

  async function generate() {
    const res = await fetch('/api/generate-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, priceTo }),
    });
    const data = await res.json();
    setResult(data.text || JSON.stringify(data));
  }

  return (
    <main style={{ maxWidth: 700, margin: '30px auto', padding: 24 }}>
      <h1>Dashboard - Gerador de Postagem</h1>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole link Shopee https://..." style={{ width: '100%', padding: 10, marginBottom: 8 }} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" style={{ width: '100%', padding: 10, marginBottom: 8 }} />
      <input value={priceTo} onChange={(e) => setPriceTo(e.target.value)} placeholder="Preço" style={{ width: '100%', padding: 10, marginBottom: 8 }} />
      <button onClick={generate} style={{ padding: '10px 20px', background: '#22c55e', border: 0, borderRadius: 8 }}>Gerar</button>
      {result && <pre style={{ background: '#111', padding: 16, marginTop: 16, whiteSpace: 'pre-wrap' }}>{result}</pre>}
    </main>
  );
}
