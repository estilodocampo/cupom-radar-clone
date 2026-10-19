'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* =========================================================
   Toasts — feedback global sem re-render de tela
   ========================================================= */
export type ToastKind = 'ok' | 'err' | 'info';
type Toast = { id: number; msg: string; kind: ToastKind };

export function toast(msg: string, kind: ToastKind = 'ok') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cr:toast', { detail: { msg, kind } }));
}

const ICON: Record<ToastKind, string> = { ok: '✓', err: '!', info: 'i' };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ msg?: string; kind?: ToastKind }>).detail || {};
      const msg = String(detail.msg || '').trim();
      if (!msg) return;
      const id = ++seq.current;
      const kind: ToastKind = detail.kind || 'ok';
      setItems((prev) => [...prev.slice(-2), { id, msg, kind }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    };
    window.addEventListener('cr:toast', onToast);
    return () => window.removeEventListener('cr:toast', onToast);
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="toast-ico" aria-hidden>{ICON[t.kind]}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   Barra de progresso de navegação
   ========================================================= */
export function TopProgress({ pathname }: { pathname: string }) {
  const [w, setW] = useState(0);
  const [show, setShow] = useState(false);
  const first = useRef(true);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    timers.current.forEach((t) => window.clearTimeout(t));
    setShow(true);
    setW(10);
    const t1 = window.setTimeout(() => setW(72), 40);
    const t2 = window.setTimeout(() => setW(100), 240);
    const t3 = window.setTimeout(() => setShow(false), 430);
    const t4 = window.setTimeout(() => setW(0), 500);
    timers.current = [t1, t2, t3, t4];
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, [pathname]);

  return (
    <div className={`topprog${show ? ' on' : ''}`} aria-hidden>
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

/* =========================================================
   Moldura da página — transição real a cada rota
   ========================================================= */
export function PageFrame({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <div key={pathname} className="page-frame">
      {children}
    </div>
  );
}
