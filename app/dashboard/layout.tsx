'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_TOP, NAV_GROUPS, NAV_ACCOUNT } from '@/lib/nav';
import CommandPalette from '@/components/command-palette';
import { PageFrame, TopProgress, Toaster } from '@/components/chrome';

// Rótulo amigável da tela atual (breadcrumb do topo)
const LABELS: [string, string][] = [
  ['/dashboard/postagens/produtos', 'Criar oferta'],
  ['/dashboard/postagens/copiador', 'Copiador'],
  ['/dashboard/postagens/radar', 'Radar Shopee'],
  ['/dashboard/postagens/sorteio', 'Sorteio'],
  ['/dashboard/postagens/envio', 'Envio'],
  ['/dashboard/postagens/fila', 'Fila'],
  ['/dashboard/postagens', 'Automação'],
  ['/dashboard/robo', 'Robô'],
  ['/dashboard/planos', 'Planos'],
  ['/dashboard/relatorios', 'Relatórios'],
  ['/dashboard/saldo', 'Saldo'],
  ['/dashboard/config/dados', 'Seus Dados'],
  ['/dashboard/config/ajuda', 'Ajuda'],
  ['/dashboard/config/feedback', 'Feedback'],
  ['/dashboard', 'Início'],
];

const TABS = [
  { href: '/dashboard', label: 'Início', icon: '🏠' },
  { href: '/dashboard/postagens/produtos', label: 'Criar', icon: '✏️' },
  { href: '/dashboard/postagens/copiador', label: 'Copiador', icon: '📑' },
  { href: '/dashboard/postagens/distribuidor', label: 'Distribuidor', icon: '🔀' },
];

// Atalhos "g + tecla" (estilo GitHub)
const GO: Record<string, string> = {
  i: '/dashboard',
  s: '/dashboard/saldo',
  o: '/dashboard/postagens/produtos',
  c: '/dashboard/postagens/copiador',
  d: '/dashboard/postagens/distribuidor',
  e: '/dashboard/postagens/envio',
  f: '/dashboard/postagens/fila',
  r: '/dashboard/relatorios',
  a: '/dashboard/config/ajuda',
  p: '/dashboard/planos',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function labelFor(path: string) {
  for (const [prefix, label] of LABELS) if (path === prefix) return label;
  for (const [prefix, label] of LABELS) if (path.startsWith(prefix + '/')) return label;
  return 'Painel';
}

function crumbs(path: string): { label: string; href: string | null }[] {
  const segs = path.split('/').filter(Boolean);
  const out: { label: string; href: string | null }[] = [];
  let acc = '';
  for (const s of segs) {
    acc += '/' + s;
    out.push({ label: labelFor(acc), href: acc });
  }
  // Máx. 2 níveis (pai › atual) para não poluir
  const cut = out.slice(-2);
  return cut.map((c, i) => (i === cut.length - 1 ? { ...c, href: null } : c));
}

function initials(name?: string | null, email?: string | null) {
  return (name || email || 'U').slice(0, 2).toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({ Automação: true });
  const [mobOpen, setMobOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [palette, setPalette] = useState(false);
  const [kbd, setKbd] = useState('Ctrl K');
  const name = session?.user?.name || session?.user?.email?.split('@')[0] || 'Usuário';
  const first = name.split(' ')[0];
  const [plan, setPlan] = useState('');
  const [waOn, setWaOn] = useState(false);
  const active = (href: string) => (href === '/dashboard' ? path === href : path.startsWith(href));
  const railOn = rail && desktop;

  React.useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((d) => setPlan(d?.plan || '')).catch(() => {});
    fetch('/api/whatsapp/status').then((r) => r.json()).then((d) => {
      const s = d?.slots || {};
      setWaOn(Object.values(s).some((v) => (v as { connected?: boolean })?.connected));
    }).catch(() => {});
  }, []);

  // Preferências de layout (sidebar recolhida) e rótulo de atalho
  React.useEffect(() => {
    try {
      if (localStorage.getItem('cr:rail') === '1') setRail(true);
    } catch { /* storage bloqueado */ }
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) setKbd('⌘ K');
    const mq = window.matchMedia('(min-width: 1025px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  function toggleRail() {
    setRail((v) => {
      const next = !v;
      try { localStorage.setItem('cr:rail', next ? '1' : '0'); } catch { /* ignora */ }
      return next;
    });
  }

  React.useEffect(() => { setMobOpen(false); }, [path]);

  // Atalhos globais: ⌘/Ctrl+K · / · ? · g+tecla · Esc
  React.useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setMobOpen(false);
        return;
      }
      if (typing) return;
      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        armed = true;
        clearTimeout(timer);
        timer = setTimeout(() => { armed = false; }, 1400);
        return;
      }
      if (armed) {
        const dest = GO[e.key.toLowerCase()];
        armed = false;
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [router]);

  React.useEffect(() => {
    document.body.classList.toggle('mob-open', mobOpen);
    return () => document.body.classList.remove('mob-open');
  }, [mobOpen]);

  const navLink = (item: { href: string; label: string; icon: string; badge?: string }) => (
    <Link
      key={item.href + item.label}
      href={item.href}
      className={`nav-item${active(item.href) ? ' active' : ''}`}
      data-tip={item.label}
      title={item.label}
      aria-current={active(item.href) ? 'page' : undefined}
    >
      <span className="nav-ico" aria-hidden>{item.icon}</span>
      <span className="nav-txt">{item.label}</span>
      {item.badge && <span className="nav-txt new">{item.badge}</span>}
    </Link>
  );

  return (
    <div className="shell">
      <TopProgress pathname={path} />
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      {mobOpen && <button className="mob-backdrop" aria-label="Fechar menu" onClick={() => setMobOpen(false)} />}

      <aside className={`sidebar${railOn ? ' rail' : ''}`} aria-label="Menu principal">
        <div className="brand">
          <span className="brand-badge" aria-hidden>📡</span>
          <span className="brand-name">Cupom Radar</span>
          {waOn && <span className="op-live rail-hide"><span className="op-pulse" />AO VIVO</span>}
          <button
            className="rail-btn"
            onClick={toggleRail}
            aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
            title={rail ? 'Expandir menu' : 'Recolher menu'}
          >
            {rail ? '»' : '«'}
          </button>
        </div>

        <div className="side-user">
          <div className="avatar">{initials(session?.user?.name, session?.user?.email)}</div>
          <div className="rail-hide"><small>USUÁRIO</small><b>{name}</b></div>
        </div>

        <nav>
          {NAV_TOP.map((n) => navLink(n))}
          {NAV_GROUPS.map((g) => {
            const expanded = railOn || open[g.label];
            return (
              <div key={g.label}>
                <button
                  className="nav-item nav-group-btn"
                  data-tip={g.label}
                  title={g.label}
                  aria-expanded={expanded}
                  onClick={() => setOpen({ ...open, [g.label]: !open[g.label] })}
                >
                  <span className="nav-ico" aria-hidden>{g.icon}</span>
                  <span className="nav-txt">{g.label}</span>
                  <span className="nav-arrow nav-txt" aria-hidden>{expanded ? '▾' : '▸'}</span>
                </button>
                {expanded && g.items.map((it) => navLink(it))}
              </div>
            );
          })}
          {NAV_ACCOUNT.map((n) => navLink(n))}
        </nav>

        <div className="side-foot">
          <a className="btn btn-primary btn-sm side-cta" href="https://wa.me/5548996911387" target="_blank" rel="noreferrer" data-tip="Falar com Suporte">
            <span className="nav-ico" aria-hidden>💬</span>
            <span className="nav-txt">Falar com Suporte</span>
          </a>
          {session?.user ? (
            <button className="nav-item side-btn" data-tip="Sair" onClick={() => signOut({ callbackUrl: '/' })}>
              <span className="nav-ico" aria-hidden>🚪</span>
              <span className="nav-txt">Sair</span>
            </button>
          ) : (
            <Link className="btn btn-ghost btn-sm side-cta" href="/login" data-tip="Entrar">
              <span className="nav-ico" aria-hidden>🔑</span>
              <span className="nav-txt">Entrar</span>
            </Link>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar-app">
          <button className="mob-menu" aria-label="Abrir menu" aria-expanded={mobOpen} onClick={() => setMobOpen(true)}>☰</button>
          <div className="topbar-hello">
            <small>{greeting()}, {first}</small>
            <nav className="crumbs" aria-label="Você está aqui">
              {crumbs(path).map((c, i) => (
                <span key={`${c.href || 'cur'}-${i}`}>
                  {i > 0 && <span aria-hidden> › </span>}
                  {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="cur">{c.label}</span>}
                </span>
              ))}
            </nav>
          </div>

          <button className="cmdk-hint" onClick={() => setPalette(true)} aria-label={`Buscar telas (${kbd})`}>
            <span aria-hidden>⌕</span>
            <span className="cmdk-hint-txt">Buscar…</span>
            <kbd>{kbd}</kbd>
          </button>

          {plan && <Link className="topbar-plan" href="/dashboard/planos">💎 {plan}</Link>}
        </header>

        <div className="container" id="conteudo" style={{ paddingTop: 24 }}>
          <PageFrame pathname={path}>{children}</PageFrame>
        </div>

        <nav className="tabbar" aria-label="Navegação rápida">
          {TABS.map((t) => (
            <Link key={t.href} className={`tabitem${active(t.href) ? ' active' : ''}`} href={t.href} aria-current={active(t.href) ? 'page' : undefined}>
              <span className="tabico" aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}
          <button className={`tabitem${mobOpen ? ' active' : ''}`} onClick={() => setMobOpen(true)}>
            <span className="tabico" aria-hidden>☰</span>
            <span>Menu</span>
          </button>
        </nav>
      </div>

      <a className="help-fab" style={{ textDecoration: 'none' }} href="/dashboard/config/ajuda">💬 Ajuda</a>

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onSignOut={session?.user ? () => signOut({ callbackUrl: '/' }) : undefined}
      />
      <Toaster />
    </div>
  );
}
