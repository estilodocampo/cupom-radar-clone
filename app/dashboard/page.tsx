'use client';
import { useEffect, useState } from 'react';

export default function Overview() {
  const [stats, setStats] = useState<{ plan?: string; postsToday?: number; scheduledPending?: number; sentTotal?: number } | null>(null);
  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => setStats({}));
  }, []);
  return (
    <>
      <a className="back" href="/">← Voltar para o site</a>
      <div className="eyebrow">● SEU ESPAÇO DE TRABALHO</div>
      <h1 className="h1">Dashboard</h1>
      <p className="sub">Sua operação de afiliado em um só lugar.</p>
      <div className="grid grid-4">
        <div className="card"><small className="hint">PLANO ATUAL</small><div className="price" style={{ textTransform: 'capitalize' }}>{stats?.plan || '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/planos">Gerenciar</a></div>
        <div className="card"><small className="hint">POSTS HOJE</small><div className="price">{stats?.postsToday ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/postagens">Gerar oferta</a></div>
        <div className="card"><small className="hint">AGENDADOS</small><div className="price">{stats?.scheduledPending ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/postagens">Ver fila</a></div>
        <div className="card"><small className="hint">DISPAROS ENVIADOS</small><div className="price">{stats?.sentTotal ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/relatorios">Relatórios</a></div>
      </div>
      <h2 className="section-title">Comece por aqui</h2>
      <p className="section-sub">Três passos para colocar no automático.</p>
      <div className="grid grid-3">
        <div className="card"><div className="feat">🤖</div><h3>1. Configure o robô</h3><p className="hint">Conecte WhatsApp, Telegram e suas lojas.</p><a className="btn btn-primary btn-sm" href="/dashboard/robo">Config Robô</a></div>
        <div className="card"><div className="feat">✨</div><h3>2. Gere ofertas</h3><p className="hint">Cole o link e receba o texto pronto.</p><a className="btn btn-primary btn-sm" href="/dashboard/postagens">Gerar oferta</a></div>
        <div className="card"><div className="feat">⏰</div><h3>3. Agende disparos</h3><p className="hint">Programe e venda até dormindo.</p><a className="btn btn-primary btn-sm" href="/dashboard/postagens">Agendar</a></div>
      </div>
    </>
  );
}
