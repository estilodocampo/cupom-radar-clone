'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_NAV, NAV_GROUPS, type NavItem } from '@/lib/nav';

const RECENT_KEY = 'cr:navegou';

function norm(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Trecho pesquisado em destaque. */
function Hi({ text, q }: { text: string; q: string }) {
  const nq = norm(q);
  if (!nq) return <>{text}</>;
  const at = norm(text).indexOf(nq);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + nq.length)}</mark>
      {text.slice(at + nq.length)}
    </>
  );
}

function groupOf(item: NavItem): string {
  for (const g of NAV_GROUPS) if (g.items.some((i) => i.href === item.href)) return g.label;
  if (item.href.startsWith('/dashboard/config')) return 'Conta';
  if (['/dashboard/saldo', '/dashboard/robo', '/dashboard/planos', '/dashboard/relatorios'].includes(item.href)) return 'Operação';
  return 'Menu';
}

export default function CommandPalette({
  open,
  onClose,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) {
      const rec = recent
        .map((h) => ALL_NAV.find((i) => i.href === h))
        .filter((x): x is NavItem => !!x);
      const seen = new Set(rec.map((r) => r.href));
      return [...rec, ...ALL_NAV.filter((i) => !seen.has(i.href))];
    }
    return ALL_NAV.map((item) => {
      const hay = norm(`${item.label} ${item.hint || ''} ${groupOf(item)}`);
      const label = norm(item.label);
      let score = -1;
      if (label.startsWith(nq)) score = 0;
      else if (label.includes(nq)) score = 1;
      else if (hay.includes(nq)) score = 2;
      return { item, score };
    })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.item);
  }, [q, recent]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(raw)) setRecent(raw.filter((x) => typeof x === 'string').slice(0, 5));
    } catch {
      /* storage bloqueado */
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    document.body.classList.add('cmdk-open');
    return () => {
      window.clearTimeout(t);
      document.body.classList.remove('cmdk-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx, open, results.length]);

  const go = useCallback(
    (href: string) => {
      try {
        const next = [href, ...recent.filter((h) => h !== href)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      onClose();
      router.push(href);
    },
    [onClose, recent, router]
  );

  if (!open) return null;

  const total = results.length;

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => (total ? (i + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => (total ? (i - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[idx];
      if (item) go(item.href);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Mantém o foco dentro da paleta
      const focusables = boxRef.current?.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }
  }

  const active = results[Math.min(idx, Math.max(0, total - 1))];

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        ref={boxRef}
        onKeyDown={onKeyDown}
      >
        <div className="cmdk-top">
          <span className="cmdk-ico" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Ir para… ou buscar uma tela"
            aria-label="Buscar telas e ações"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="cmdk-esc" onClick={onClose} aria-label="Fechar busca">esc</button>
        </div>

        <div className="cmdk-list" ref={listRef} role="listbox" aria-label="Resultados">
          {total === 0 && (
            <div className="cmdk-empty">
              <b>Nada encontrado para “{q}”.</b>
              <span>Tente “saldo”, “fila”, “canal” ou “ajuda”.</span>
            </div>
          )}

          {results.map((item, i) => {
            const showGroup = !q && i === 0 && recent.length > 0;
            return (
              <div key={item.href}>
                {showGroup && <div className="cmdk-cap">Recentes</div>}
                {!q && i === recent.length && recent.length > 0 && <div className="cmdk-cap">Todas as telas</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === idx}
                  data-active={i === idx ? 'true' : 'false'}
                  className={`cmdk-item${i === idx ? ' on' : ''}`}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(item.href)}
                >
                  <span className="cmdk-item-ico">{item.icon}</span>
                  <span className="cmdk-item-txt">
                    <b><Hi text={item.label} q={q} /></b>
                    <small>{item.hint || groupOf(item)}</small>
                  </span>
                  <span className="cmdk-item-go" aria-hidden>↵</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> fechar</span>
          {onSignOut && (
            <button
              type="button"
              className="cmdk-signout"
              onClick={() => {
                onClose();
                onSignOut();
              }}
            >
              Sair da conta
            </button>
          )}
        </div>

        <span className="sr-only" aria-live="polite">
          {active ? `${active.label} selecionado` : 'Sem resultados'}
        </span>
      </div>
    </div>
  );
}
