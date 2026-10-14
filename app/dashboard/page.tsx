'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type Stats = { plan?: string; postsToday?: number; scheduledPending?: number; sentTotal?: number };
type Slot = { connected?: boolean; phone?: string };
type CopRule = { id: string; name?: string; slot?: string; source?: string; hub?: string; keepCoupons?: boolean; active?: boolean };
type DisRule = { id: string; name?: string; slot?: string; hub?: string; targets?: string[]; onlyMine?: boolean; requireLink?: boolean; convert?: boolean; stripCoupons?: boolean; prefix?: string; suffix?: string; minInterval?: number; maxPerDay?: number; dedupHoras?: number; pausado?: boolean };
type Dispatch = { message?: string; groupJid?: string; kind?: string; status?: string; sentAt?: string };
type Group = { id: string; name: string };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Título da oferta: maior linha sem link (mesma heurística do worker)
function offerTitle(text: string): string {
  const ls = (text || '').split('\n')
    .map((l) => l.replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '').trim())
    .filter((l) => l.length >= 12 && !/https?:\/\//.test(l) && !/^(por|cupom|link|de:|r\$|preço|preco|estoque)/i.test(l))
    .sort((a, b) => b.length - a.length);
  return ls[0] || 'Oferta';
}

function offerPrice(text: string): { de?: string; por?: string } {
  const por = (text.match(/POR:\s*R\$\s*[\d.,]+/i) || [])[0]?.replace(/POR:\s*/i, '');
  const de = (text.match(/(?:DE|DE:)\s*R\$\s*[\d.,]+/i) || [])[0]?.replace(/DE:\s*/i, '');
  return { de, por };
}

function shortJid(jid?: string): string {
  if (!jid) return '—';
  return jid.replace('@g.us', '').replace('@lid', '').slice(-6);
}

function hourOf(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function Overview() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [health, setHealth] = useState<Record<string, { score?: number; motivos?: string[]; paused?: boolean }>>({});
  const [cop, setCop] = useState<CopRule[]>([]);
  const [dis, setDis] = useState<DisRule[]>([]);
  const [offers, setOffers] = useState<Dispatch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const first = (session?.user?.name || session?.user?.email || '').split(/[\s@]/)[0] || 'você';
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleRegra(kind: 'cop' | 'dis', id: string) {
    if (toggling) return;
    setToggling(id);
    try {
      if (kind === 'cop') {
        const r = cop.find((x) => x.id === id);
        if (!r) return;
        const active = r.active === false;
        setCop((cs) => cs.map((x) => (x.id === id ? { ...x, active } : x)));
        const res = await fetch('/api/copiador/rules', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, name: r.name || '', slot: r.slot || 'wa1', source: r.source || '', hub: r.hub || '', keepCoupons: !!r.keepCoupons, active }),
        });
        if (!res.ok) setCop((cs) => cs.map((x) => (x.id === id ? { ...x, active: !active } : x)));
      } else {
        const r = dis.find((x) => x.id === id);
        if (!r) return;
        const pausado = !r.pausado;
        setDis((ds) => ds.map((x) => (x.id === id ? { ...x, pausado } : x)));
        const res = await fetch('/api/distribuidor/rules', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...r, pausado }),
        });
        if (!res.ok) setDis((ds) => ds.map((x) => (x.id === id ? { ...x, pausado: !pausado } : x)));
      }
    } finally {
      setToggling(null);
    }
  }

  useEffect(() => {
    function carregar() {
      fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => setStats({}));
      fetch('/api/whatsapp/status').then((r) => r.json()).then((d) => { setSlots(d?.slots || {}); setHealth(d?.health || {}); }).catch(() => {});
      fetch('/api/copiador/rules').then((r) => r.json()).then((d) => setCop(d?.items || [])).catch(() => {});
      fetch('/api/distribuidor/rules').then((r) => r.json()).then((d) => setDis(d?.items || [])).catch(() => {});
      fetch('/api/dispatches').then((r) => r.json()).then((d) => {
        const items = ((d?.items || []) as Dispatch[]).filter((o) => (o.status || 'sent') === 'sent');
        // 1 linha por destino: colapsa a mesma oferta (hub + distribuidor) numa só
        const seen = new Set<string>();
        const uniq = items.filter((o) => {
          const fp = (o.message || '').replace(/⁣/g, '').trim();
          if (!fp || seen.has(fp)) return false;
          seen.add(fp);
          return true;
        });
        setOffers(uniq.slice(0, 3));
      }).catch(() => {});
      (async () => {
        const map: Record<string, string> = {};
        for (const slot of ['wa1', 'wa2']) {
          try {
            const r = await fetch(`/api/whatsapp/groups?slot=${slot}`);
            const d = await r.json();
            for (const g of (d?.groups || []) as Group[]) map[g.id] = g.name;
          } catch { /* mantém JID curto */ }
        }
        setNames(map);
      })();
    }
    carregar();
    const t = setInterval(carregar, 60000); // centro de operação ao vivo
    return () => clearInterval(t);
  }, []);

  const gname = (jid?: string) => (jid && names[jid]) || shortJid(jid);
  const wa1 = slots.wa1 || {}, wa2 = slots.wa2 || {};
  const anyOn = !!(wa1.connected || wa2.connected);
  const groupsOf = (slot?: string) => dis.filter((d) => (d.slot || 'wa1') === (slot || 'wa1')).reduce((a, d) => a + (d.targets || []).length, 0);
  const rulesOn = cop.filter((c) => c.active !== false).length + dis.filter((d) => !d.pausado).length;
  const rulesTotal = cop.length + dis.length;

  return (
    <div className="dash">
      <div className="dash-hello">
        <h1 className="h1" style={{ margin: 0 }}>{greeting()}, {first} 👋</h1>
        <p className="sub" style={{ margin: 0 }}>Conexões, regras e ofertas.</p>
      </div>

      <div className="op-status">
        <div className="op-status-head">
          <span className="op-pulse" style={anyOn ? undefined : { background: '#ef4444', boxShadow: 'none' }} />
          {anyOn ? 'OPERAÇÃO ATIVA' : 'OPERAÇÃO PAUSADA'}
          <span>{stats ? `${stats.postsToday ?? 0} criadas hoje` : 'carregando…'}</span>
        </div>
        {(['wa1', 'wa2'] as const).map((s) => {
          const sl = slots[s] || {};
          const ng = groupsOf(s);
          return (
            <div className="op-num" key={s}>
              <span className={`d${sl.connected ? '' : ' off'}`} />
              <b>{s}</b>
              <code>{sl.phone || 'desconectado'}</code>
              <em>{ng} grupo{ng === 1 ? '' : 's'}</em>
            </div>
          );
        })}
        <div className="op-today">
          <div className="op-mini"><small>CRIADAS HOJE</small><b>{stats?.postsToday ?? '…'}</b></div>
          <div className="op-mini"><small>NA FILA</small><b>{stats?.scheduledPending ?? '…'}</b></div>
          <div className="op-mini"><small>DISPAROS</small><b>{stats?.sentTotal ?? '…'}</b></div>
        </div>
      </div>

      <div className="op-cta">
        <a className="btn btn-primary" href="/dashboard/postagens/produtos">＋ Criar oferta</a>
        <a className="btn btn-ghost" href="/dashboard/postagens/envio" aria-label="Envio automático">⚡</a>
        <a className="btn btn-ghost" href="/dashboard/postagens/fila" aria-label="Fila">📋</a>
      </div>

      <div className="op-sec">
        <h3>🛡️ Saúde</h3>
        <small>modo seguro</small>
      </div>
      <div className="op-status">
        {(['wa1', 'wa2'] as const).map((s) => {
          const h = health[s] || {};
          const score = h.score ?? 0;
          const cor = h.paused || score >= 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#34d399';
          return (
            <div className="op-num" key={s}>
              <span className="d" style={{ background: cor, boxShadow: `0 0 8px ${cor}` }} />
              <b>{s}</b>
              <code>{score}/100</code>
              <em>{h.paused ? 'em pausa' : (h.motivos || []).join(' · ') || 'tudo calmo'}</em>
            </div>
          );
        })}
      </div>

      <div className="op-sec">
        <h3>Regras ativas</h3>
        <small>{rulesOn} de {rulesTotal} ligadas</small>
        <a href="/dashboard/postagens/copiador">Gerenciar →</a>
      </div>
      {rulesTotal === 0 && (
        <div className="empty">
          <span className="empty-ico">📑</span>
          <p><b>Sem regras.</b><br />Crie um Copiador para começar.</p>
          <a className="btn btn-primary btn-sm" href="/dashboard/postagens/copiador">Criar</a>
        </div>
      )}
      {cop.slice(0, 2).map((c) => (
        <div className="op-rule" key={c.id}>
          <a href="/dashboard/postagens/copiador" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
            <div className="op-rtile">📑</div>
            <div><b>Copiador · {c.slot || 'wa1'}{c.name ? ` · ${c.name}` : ''}</b><small>{gname(c.source)} <i>→</i> {gname(c.hub)}</small></div>
          </a>
          <button type="button" className={`op-tgl${c.active === false ? ' off' : ''}`} aria-pressed={c.active !== false} aria-label={c.active === false ? 'Ligar regra' : 'Desligar regra'} disabled={toggling === c.id} onClick={() => toggleRegra('cop', c.id)} />
        </div>
      ))}
      {dis.slice(0, 2).map((d) => (
        <div className="op-rule" key={d.id}>
          <a href="/dashboard/postagens/distribuidor" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
            <div className="op-rtile" style={{ background: '#252a45' }}>🔀</div>
            <div><b>Distribuidor · {d.slot || 'wa1'}{d.name ? ` · ${d.name}` : ''}</b><small>{gname(d.hub)} <i>→</i> {(d.targets || []).length} grupo{((d.targets || []).length === 1) ? '' : 's'}</small></div>
          </a>
          <button type="button" className={`op-tgl${d.pausado ? ' off' : ''}`} aria-pressed={!d.pausado} aria-label={d.pausado ? 'Ligar regra' : 'Desligar regra'} disabled={toggling === d.id} onClick={() => toggleRegra('dis', d.id)} />
        </div>
      ))}

      <div className="op-sec">
        <h3>Últimas ofertas</h3>
        <a href="/dashboard/relatorios">Ver tudo →</a>
      </div>
      {offers.length === 0 && (
        <div className="empty">
          <span className="empty-ico">🚀</span>
          <p><b>Nada enviado ainda.</b></p>
          <a className="btn btn-primary btn-sm" href="/dashboard/postagens/produtos">Criar oferta</a>
        </div>
      )}
      {offers.map((o, i) => {
        const t = offerTitle(o.message || '');
        const p = offerPrice(o.message || '');
        return (
          <div className="op-offer" key={i}>
            <div className="op-thumb">🛍️</div>
            <div className="op-oinfo">
              <p>{t}</p>
              <div className="op-ometa">
                {p.de && <span className="op-was">{p.de}</span>}
                {p.por && <span className="op-price">{p.por}</span>}
                <span className="op-time">{hourOf(o.sentAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
