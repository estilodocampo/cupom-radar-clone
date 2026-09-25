'use client';
import { useState } from 'react';

const PLANS = [
  { id: 'premium', name: 'Premium', price: 'R$ 159,90/ano', desc: 'Para colocar sua divulgação no automático.', feats: ['Posts ilimitados', '1 número WhatsApp', '12 grupos Whats + 12 Telegram', 'Agendamento + Fila/Lista Shopee'] },
  { id: 'diamante', name: 'Diamante', price: 'R$ 299,90/ano', desc: 'Para expandir suas lojas e copiar ofertas.', feats: ['Tudo do Premium', '20 grupos Whats + 20 Telegram', 'Fila/Lista multi-loja', 'Modo Copiador: 1 grupo'] },
  { id: 'master', name: 'Master', price: 'R$ 697,00/ano', desc: 'Mais números, mais grupos, mais escala.', feats: ['Tudo do Diamante', '2 números WhatsApp', '30 grupos Whats', 'Copiador: 3 grupos'] },
];

export default function Planos() {
  async function checkout(plan: string) {
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || 'Falha no checkout');
  }
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● ASSINATURA</div>
      <h1 className="h1">Planos</h1>
      <p className="sub">Pagamento via PIX com ativação automática. Garantia de 7 dias.</p>
      <div className="grid grid-3">
        {PLANS.map((p, i) => (
          <div key={p.id} className={`card${i === 0 ? ' plan-pop' : ''}`}>
            {i === 0 && <span className="tag">MAIS POPULAR</span>}
            <h3>{p.name}</h3>
            <p className="hint">{p.desc}</p>
            <div className="price" style={{ fontSize: 24 }}>{p.price}</div>
            <ul>{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => checkout(p.id)}>Assinar {p.name}</button>
          </div>
        ))}
      </div>
    </>
  );
}
