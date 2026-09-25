'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Whatsapp from './whatsapp';

const PAID_PLANS = [
  { id: 'premium', label: 'Premium - R$159,90/ano' },
  { id: 'diamante', label: 'Diamante - R$299,90/ano' },
  { id: 'master', label: 'Master - R$697,00/ano' },
];

export default function Dashboard() {
  const { data: session, status } = useSession();
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

  async function checkout(plan: string) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || 'Falha no checkout');
  }

  return (
    <main style={{ maxWidth: 700, margin: '30px auto', padding: 24 }}>
      <h1>Dashboard - Gerador de Postagem</h1>
      <p>{status === 'authenticated' ? `Logado: ${session?.user?.email}` : 'Modo demo (sem login). Faça login para limites por plano.'}</p>
      {status === 'authenticated' ? (
        <button onClick={() => signOut({ callbackUrl: '/' })} style={{ marginBottom: 16 }}>Sair</button>
      ) : (
        <a href="/login" style={{ color: '#22c55e' }}>Ir para login</a>
      )}
      <div style={{ display: 'grid', gap: 8, margin: '16px 0' }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole link Shopee https://..." style={{ width: '100%', padding: 10 }} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" style={{ width: '100%', padding: 10 }} />
        <input value={priceTo} onChange={(e) => setPriceTo(e.target.value)} placeholder="Preço" style={{ width: '100%', padding: 10 }} />
        <button onClick={generate} style={{ padding: '10px 20px', background: '#22c55e', border: 0, borderRadius: 8 }}>Gerar</button>
      </div>
      {result && <pre style={{ background: '#111', padding: 16, marginTop: 16, whiteSpace: 'pre-wrap' }}>{result}</pre>}
      <h2 style={{ marginTop: 32 }}>Upgrade de plano (PIX via AbacatePay)</h2>
      {PAID_PLANS.map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #222', padding: 12, borderRadius: 8, marginBottom: 8 }}>
          <span>{p.label}</span>
          <button onClick={() => checkout(p.id)}>Assinar</button>
        </div>
      ))}
      {status === 'authenticated' && <Whatsapp />}
    </main>
  );
}
