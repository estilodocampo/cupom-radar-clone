'use client';
import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface Item { href: string; label: string; badge?: string }
interface Group { label: string; icon: string; items: Item[] }

const TOP: Item[] = [
  { href: '/dashboard', label: '🏠 Dashboard' },
  { href: '/dashboard/robo', label: '🤖 Config Robô' },
  { href: '/dashboard/planos', label: '💎 Planos' },
];

const GROUPS: Group[] = [
  { label: 'Postagens', icon: '✉️', items: [
    { href: '/dashboard/postagens/produtos', label: '📦 Produtos' },
    { href: '/dashboard/postagens/fila', label: '📋 Modo Fila' },
    { href: '/dashboard/postagens/lista', label: '📝 Modo Lista', badge: 'NOVO' },
    { href: '/dashboard/postagens/copiador', label: '📑 Modo Copiador' },
  ]},
  { label: 'Ferramentas', icon: '🛠️', items: [
    { href: '/dashboard/ferramentas', label: '🔗 Bio Link Pro' },
    { href: '/dashboard/ferramentas', label: '🔄 Rotacionador', badge: 'NOVO' },
    { href: '/dashboard/ferramentas', label: '🎓 Aulas' },
  ]},
  { label: 'Crescimento', icon: '📈', items: [
    { href: '/dashboard/crescimento', label: '📊 Analytics de Grupos', badge: 'NOVO' },
    { href: '/dashboard/crescimento', label: '🎁 Indique e ganhe', badge: 'NOVO' },
  ]},
  { label: 'Configurações', icon: '⚙️', items: [
    { href: '/dashboard/config/ajuda', label: '❓ Central de Ajuda' },
    { href: '/dashboard/config/suporte-ia', label: '✨ Suporte IA' },
    { href: '/dashboard/config/dados', label: '👤 Seus Dados' },
    { href: '/dashboard/config/feedback', label: '💭 Enviar Feedback' },
  ]},
];

function initials(name?: string | null, email?: string | null) {
  return (name || email || 'U').slice(0, 2).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const path = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({ Postagens: true, Configurações: true });
  const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuário';
  const active = (href: string) => (href === '/dashboard' ? path === href : path.startsWith(href));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-badge">📡</span> Cupom Radar</div>
        <div className="side-user">
          <div className="avatar">{initials(session?.user?.name, session?.user?.email)}</div>
          <div><small>USUÁRIO</small><b>{name}</b></div>
        </div>
        <nav>
          {TOP.map((n) => <a key={n.href} className={`nav-item${active(n.href) ? ' active' : ''}`} href={n.href}>{n.label}</a>)}
          <a className={`nav-item${path.startsWith('/dashboard/relatorios') ? ' active' : ''}`} href="/dashboard/relatorios">📊 Relatórios</a>
          {GROUPS.map((g) => (
            <div key={g.label}>
              <button className="nav-item" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setOpen({ ...open, [g.label]: !open[g.label] })}>
                <span>{g.icon} {g.label}</span><span style={{ marginLeft: 'auto' }}>{open[g.label] ? '▾' : '▸'}</span>
              </button>
              {open[g.label] && g.items.map((it) => (
                <a key={it.href + it.label} className={`nav-item${active(it.href) ? ' active' : ''}`} style={{ paddingLeft: 30 }} href={it.href}>
                  {it.label}{it.badge && <span className="new">{it.badge}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'grid', gap: 8 }}>
          <a className="btn btn-primary btn-sm" style={{ textAlign: 'center' }} href="https://wa.me/5548996911387" target="_blank" rel="noreferrer">💬 Falar com Suporte</a>
          {session?.user ? (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => signOut({ callbackUrl: '/' })}>Sair</button>
          ) : (
            <a className="btn btn-ghost btn-sm" style={{ width: '100%', textAlign: 'center' }} href="/login">Entrar</a>
          )}
        </div>
      </aside>
      <div className="main">
        <div className="container" style={{ paddingTop: 24 }}>
          {children}
        </div>
        <button className="help-fab">💬 Precisa de ajuda?</button>
      </div>
    </div>
  );
}
