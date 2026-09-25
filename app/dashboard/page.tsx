'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Whatsapp from './whatsapp';

const PAID_PLANS = [
  { id: 'premium', label: 'Premium', desc: 'Automação Shopee no dia a dia', price: 'R$ 159,90/ano' },
  { id: 'diamante', label: 'Diamante', desc: 'Multi-lojas + Modo Copiador', price: 'R$ 299,90/ano' },
  { id: 'master', label: 'Master', desc: 'Operação grande, 2 números', price: 'R$ 697,00/ano' },
];

const TABS = [
  { id: 'gerar', label: '✨ Gerar oferta' },
  { id: 'whats', label: '📲 WhatsApp' },
  { id: 'planos', label: '💎 Assinatura' },
];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState('gerar');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('Fone Bluetooth TWS');
  const [priceTo, setPriceTo] = useState('R$ 49,90');
  const [result, setResult] = useState('');

  async function generate() {
    setResult('Gerando...');
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
    <div className="container">
      <div className="topbar">
        <div className="brand"><span className="brand-badge">📡</span> Cupom Radar</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {status === 'authenticated' ? (
            <>
              <span className="badge badge-ok">{session?.user?.email}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/' })}>Sair</button>
            </>
          ) : (
            <a className="btn btn-primary btn-sm" href="/login">Entrar</a>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'gerar' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr', maxWidth: 640 }}>
          <div className="card">
            <h3>✨ Nova oferta</h3>
            <p className="hint">Cole o link e gere o texto pronto com seu link de afiliado.</p>
            <label className="lbl">Link do produto</label>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://shopee.com.br/..." />
            <label className="lbl">Título</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do produto" />
            <label className="lbl">Preço</label>
            <input className="input" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} placeholder="R$ 49,90" />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={generate}>Gerar postagem</button>
            {result && <div className="result">{result}</div>}
          </div>
        </div>
      )}

      {tab === 'whats' && (
        status === 'authenticated' ? <Whatsapp /> : <div className="card"><p>Faça <a href="/login">login</a> para usar a automação WhatsApp.</p></div>
      )}

      {tab === 'planos' && (
        <>
          <h2 className="section-title" style={{ marginTop: 8 }}>Sua assinatura</h2>
          <p className="section-sub">Pagamento via PIX com ativação automática.</p>
          <div className="grid grid-3">
            {PAID_PLANS.map((p) => (
              <div key={p.id} className="card">
                <h3>{p.label}</h3>
                <p className="hint">{p.desc}</p>
                <div className="price" style={{ fontSize: 22 }}>{p.price}</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => checkout(p.id)}>Assinar {p.label}</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
