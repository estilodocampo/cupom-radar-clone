'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type Stats = { plan?: string; postsToday?: number; scheduledPending?: number; sentTotal?: number; clicks?: number };

const QUICK = [
  { href: '/dashboard/postagens/produtos', icon: '📝', tone: 'green', name: 'Gerar Postagem', desc: 'Crie postagens prontas para compartilhar.' },
  { href: '/dashboard/postagens/copiador', icon: '📑', tone: 'blue', name: 'Modo Copiador', desc: 'Replique ofertas do grupo de origem com o seu link.' },
  { href: '/dashboard/postagens/distribuidor', icon: '🔀', tone: 'amber', name: 'Distribuidor', desc: 'Repasse o que posta no seu grupo para os demais.' },
  { href: '/dashboard/postagens/sorteio', icon: '🎉', tone: 'purple', name: 'Sorteio + Boas-vindas', desc: 'Sorteie membros e receba novatos automaticamente.' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Overview() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const first = (session?.user?.name || session?.user?.email || '').split(/[\s@]/)[0] || 'você';

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => setStats({}));
  }, []);

  return (
    <div className="dash">
      <div className="dash-hello">
        <h1 className="h1" style={{ margin: 0 }}>{greeting()}, {first} 👋</h1>
        <p className="sub" style={{ margin: 0 }}>Crie postagens, automatize envios e encontre o que precisa para avançar.</p>
      </div>

      <div className="dash-section">
        <div className="dash-eyebrow">DESTAQUES</div>
        <h2 className="dash-h2">Sua operação</h2>
      </div>
      <div className="grid grid-4">
        <div className="card"><small className="hint">PLANO ATUAL</small><div className="price" style={{ textTransform: 'capitalize' }}>{stats?.plan || '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/planos">Gerenciar</a></div>
        <div className="card"><small className="hint">POSTS HOJE</small><div className="price">{stats?.postsToday ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/postagens/produtos">Gerar oferta</a></div>
        <div className="card"><small className="hint">AGENDADOS</small><div className="price">{stats?.scheduledPending ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/postagens">Ver fila</a></div>
        <div className="card"><small className="hint">DISPAROS ENVIADOS</small><div className="price">{stats?.sentTotal ?? '...'}</div><a className="btn btn-ghost btn-sm" href="/dashboard/relatorios">Relatórios</a></div>
      </div>

      <div className="dash-section">
        <div className="dash-eyebrow">MÁIS</div>
        <h2 className="dash-h2">Continue configurando</h2>
      </div>
      <div className="grid grid-3">
        <a className="card" href="/dashboard/robo"><div className="feat">🤖</div><h3>Configure o robô</h3><p className="hint">Conecte o WhatsApp e suas lojas de afiliado.</p></a>
        <a className="card" href="/dashboard/postagens/envio"><div className="feat">🚀</div><h3>Envio automático</h3><p className="hint">Defina o grupo padrão e dispare sozinho.</p></a>
        <a className="card" href="/dashboard/relatorios"><div className="feat">📊</div><h3>Relatórios</h3><p className="hint">Acompanhe cliques e disparos enviados.</p></a>
      </div>
    </div>
  );
}