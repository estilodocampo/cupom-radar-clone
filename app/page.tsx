import { PLANS } from '../lib/plans';

const STORES = ['Shopee', 'Amazon', 'Mercado Livre', 'SHEIN', 'Magalu'];

export default function Home() {
  return (
    <div className="container">
      <nav className="nav">
        <div className="brand"><span className="brand-badge">📡</span> Cupom Radar</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a className="btn btn-ghost btn-sm" href="/login">Entrar</a>
          <a className="btn btn-primary btn-sm" href="/login">Começar grátis</a>
        </div>
      </nav>

      <header className="hero">
        <span className="pill">🚀 A automação dos top afiliados</span>
        <h1>Sua divulgação no <span>piloto automático</span></h1>
        <p>Cole o link do produto, gere a postagem pronta e dispare nos seus grupos de WhatsApp e Telegram — no horário ideal, mesmo offline.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <a className="btn btn-primary" href="/login">Começar agora</a>
          <a className="btn btn-ghost" href="#planos">Ver planos</a>
        </div>
        <div className="logos">{STORES.map((s) => <span key={s} className="logo-chip">{s}</span>)}</div>
        <div className="stats"><span>✅ Grátis para começar</span><span>⚡ Posts em segundos</span><span>🛡️ Garantia de 7 dias</span></div>
      </header>

      <h2 className="section-title">Tudo que você precisa para vender mais</h2>
      <p className="section-sub">Do link ao disparo, sem trabalho manual.</p>
      <div className="grid grid-3">
        <div className="card"><div className="feat">✨</div><h3>Gerador de postagens</h3><p className="hint">Texto pronto com preço, cupom e seu link de afiliado em segundos.</p></div>
        <div className="card"><div className="feat">📲</div><h3>Automação WhatsApp</h3><p className="hint">Conecte via QR, escolha os grupos e agende os disparos.</p></div>
        <div className="card"><div className="feat">⏰</div><h3>Agendamento inteligente</h3><p className="hint">Programe ofertas para os melhores horários e venda dormindo.</p></div>
      </div>

      <h2 className="section-title" id="planos">Um plano para cada momento</h2>
      <p className="section-sub">Comece grátis e evolua quando precisar.</p>
      <div className="grid grid-4">
        {PLANS.map((p) => (
          <div key={p.id} className={`card${p.id === 'premium' ? ' plan-pop' : ''}`}>
            {p.id === 'premium' && <span className="tag">MAIS POPULAR</span>}
            <h3>{p.name}</h3>
            <div className="price">R$ {p.priceYearly.toFixed(2).replace('.', ',')}<small>/ano</small></div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            <a className={`btn ${p.id === 'gratuito' ? 'btn-ghost' : 'btn-primary'}`} style={{ width: '100%', textAlign: 'center' }} href="/login">
              {p.id === 'gratuito' ? 'Começar grátis' : `Assinar ${p.name}`}
            </a>
          </div>
        ))}
      </div>

      <footer className="footer">© 2026 Cupom Radar Clone · Fase 2 · Feito para afiliados brasileiros</footer>
    </div>
  );
}
