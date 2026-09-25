'use client';
import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '🏠 Dashboard', exact: true },
  { href: '/dashboard/robo', label: '🤖 Config Robô' },
  { href: '/dashboard/planos', label: '💎 Planos' },
  { href: '/dashboard/postagens', label: '✉️ Postagens' },
  { href: '/dashboard/ferramentas', label: '🛠️ Ferramentas' },
  { href: '/dashboard/relatorios', label: '📊 Relatórios' },
  { href: '/dashboard/crescimento', label: '📈 Crescimento' },
];

function initials(name?: string | null, email?: string | null) {
  const base = name || email || 'U';
  return base.slice(0, 2).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const path = usePathname();
  const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuário';
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-badge">📡</span> Cupom Radar</div>
        <div className="side-user">
          <div className="avatar">{initials(session?.user?.name, session?.user?.email)}</div>
          <div><small>USUÁRIO</small><b>{name}</b></div>
        </div>
        <nav>
          {NAV.map((n) => (
            <a key={n.href} className={`nav-item${n.exact ? (path === n.href ? ' active' : '') : (path.startsWith(n.href) ? ' active' : '')}`} href={n.href}>{n.label}</a>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          {session?.user ? (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => signOut({ callbackUrl: '/' })}>Sair</button>
          ) : (
            <a className="btn btn-primary btn-sm" style={{ width: '100%', textAlign: 'center' }} href="/login">Entrar</a>
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
