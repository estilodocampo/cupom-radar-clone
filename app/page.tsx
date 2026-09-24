import { PLANS } from '../lib/plans';

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <h1>O Aplicativo dos Top Afiliados (Clone Fase 1)</h1>
      <p>Sua divulgação no piloto automático. Base SaaS: landing + planos + gerador Shopee.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <a href="/login" style={{ background: '#22c55e', color: '#000', padding: '10px 20px', borderRadius: 8, textDecoration: 'none' }}>Comece agora</a>
        <a href="/dashboard" style={{ border: '1px solid #333', padding: '10px 20px', borderRadius: 8, color: '#fff' }}>Dashboard</a>
      </div>
      <h2 style={{ marginTop: 40 }}>Planos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {PLANS.map((p) => (
          <div key={p.id} style={{ border: '1px solid #222', borderRadius: 12, padding: 16, background: '#111827' }}>
            <h3>{p.name}</h3>
            <p>R$ {p.priceYearly.toFixed(2)}/ano</p>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ))}
      </div>
    </main>
  );
}
