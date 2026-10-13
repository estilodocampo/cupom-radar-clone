'use client';
import { useState } from 'react';

const PLANS = [
  { id: 'premium', name: 'Premium', price: 'R$ 159,90/ano', desc: 'No automático.', feats: ['Posts ilimitados', '1 número WhatsApp', 'Copiador + Distribuidor', 'Agendamento, Fila e envio automático'] },
  { id: 'diamante', name: 'Diamante', price: 'R$ 299,90/ano', desc: 'Mais lojas.', feats: ['Tudo do Premium', 'Shopee, Amazon, ML, Magalu e Shein', 'Relatórios de cliques'] },
  { id: 'master', name: 'Master', price: 'R$ 697,00/ano', desc: 'Máxima escala.', feats: ['Tudo do Diamante', '2 números WhatsApp', 'Regras ilimitadas por número'] },
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
      <h1 className="h1">Planos</h1>
      <p className="sub">PIX · ativação automática · 7 dias de garantia.</p>
      <div className="grid grid-3">
        {PLANS.map((p, i) => (
          <div key={p.id} className={`card${i === 0 ? ' plan-pop' : ''}`}>
            {i === 0 && <span className="tag">MAIS POPULAR</span>}
            <h3>{p.name}</h3>
            <p className="hint">{p.desc}</p>
            <div className="price" style={{ fontSize: 24 }}>{p.price}</div>
            <ul>{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => checkout(p.id)}>Assinar</button>
          </div>
        ))}
      </div>
    </>
  );
}
