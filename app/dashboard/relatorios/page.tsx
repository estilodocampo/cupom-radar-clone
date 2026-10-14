'use client';
import { useEffect, useState } from 'react';
import Empty from '../Empty';

interface Disp { id: string; groupJid: string; status: string; sentAt: string; error: string | null }
interface LinkStat { code: string; clicks: number; slot: string; url: string }
interface RuleStat { id: string; name: string; kind: string; slot: string; active: boolean; alvos: number; sent: number; failed: number }

export default function Relatorios() {
  const [logs, setLogs] = useState<Disp[]>([]);
  const [totals, setTotals] = useState<{ sent: number; failed: number } | null>(null);
  const [bySlot, setBySlot] = useState<{ slot: string; clicks: number; links: number }[]>([]);
  const [top, setTop] = useState<LinkStat[]>([]);
  const [rules, setRules] = useState<RuleStat[]>([]);
  const [shopee, setShopee] = useState<{ configured?: boolean; totals?: { clicks: number; orders: number; commission: number; rows: number }; topProducts?: { name: string; orders: number; commission: number; clicks: number }[]; error?: string } | null>(null);
  useEffect(() => {
    fetch('/api/dispatches').then((r) => r.json()).then((d) => { setLogs(d.items || []); if (d.totals) setTotals(d.totals); }).catch(() => {});
    fetch('/api/links/stats').then((r) => r.json()).then((d) => { setBySlot(d.bySlot || []); setTop(d.top || []); }).catch(() => {});
    fetch('/api/rules/stats').then((r) => r.json()).then((d) => setRules(d.items || [])).catch(() => {});
    fetch('/api/shopee/report').then((r) => r.json()).then(setShopee).catch(() => setShopee({ error: 'Falha ao consultar' }));
  }, []);
  const sent = totals ? totals.sent : logs.filter((l) => l.status === 'sent').length;
  const failed = totals ? totals.failed : logs.filter((l) => l.status !== 'sent').length;
  return (
    <>
      <h1 className="h1">Relatórios</h1>
      <div className="grid grid-3">
        <div className="card"><small className="hint">ENVIADOS (TOTAL)</small><div className="price">{sent}</div></div>
        <div className="card"><small className="hint">FALHAS (TOTAL)</small><div className="price">{failed}</div></div>
        <div className="card"><small className="hint">DISPAROS (TOTAL)</small><div className="price">{sent + failed}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>📱 Cliques</h3>
        {bySlot.length === 0 ? <Empty icon="👆" text="Compartilhe uma oferta para ver os cliques." actionLabel="Criar" actionHref="/dashboard/postagens/produtos" /> : (
          <div className="grid grid-4">
            {bySlot.map((b) => (
              <div className="card" key={b.slot}>
                <small className="hint">Nº {b.slot === 'wa2' ? '2' : '1'}</small>
                <div className="price">{b.clicks}</div>
                <p className="hint">{b.links} link{b.links === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>🔝 Top links</h3>
        {top.length === 0 ? <Empty icon="🔗" text="Seus links aparecem aqui por cliques." actionLabel="Criar" actionHref="/dashboard/postagens/produtos" /> : (
          <ul className="list">{top.map((l) => (
            <li key={l.code}><b>/r/{l.code}</b> <span className="badge">📱 {l.slot === 'wa2' ? '2' : '1'}</span> — {l.clicks} cliques<br /><span className="hint">{l.url}</span></li>
          ))}</ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>🎯 Por regra</h3>
        {rules.length === 0 ? <Empty icon="🎯" text="Crie Copiador ou Distribuidor para ver o desempenho." actionLabel="Automação" actionHref="/dashboard/postagens" /> : (
          <ul className="list">{rules.map((r) => (
            <li key={r.id}>
              <b>{r.name}</b>{' '}
              <span className="badge">{r.kind === 'copiador' ? '📑' : '🔀'} {r.slot === 'wa2' ? '2' : '1'}</span>{' '}
              {r.active ? <span className="badge badge-ok">ativa</span> : <span className="badge">pausada</span>}
              <br /><span className="hint">{r.alvos} alvo(s) · ✅ {r.sent} · {r.failed > 0 ? `❌ ${r.failed}` : 'sem falhas'}</span>
            </li>
          ))}</ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>🛒 Shopee (API)</h3>
        {shopee == null ? <p className="hint">Consultando a Shopee...</p>
          : shopee.configured === false ? <Empty icon="🛒" text="Cadastre App ID + Secret no Robô para ver cliques e comissão." actionLabel="Robô" actionHref="/dashboard/robo" />
          : shopee.error ? <p className="hint">⚠️ {shopee.error}</p>
          : (
            <>
              <div className="grid grid-4">
                <div className="card"><small className="hint">CLIQUES</small><div className="price">{shopee.totals?.clicks ?? 0}</div></div>
                <div className="card"><small className="hint">PEDIDOS</small><div className="price">{shopee.totals?.orders ?? 0}</div></div>
                <div className="card"><small className="hint">COMISSÃO EST.</small><div className="price">R$ {(shopee.totals?.commission ?? 0).toFixed(2).replace('.', ',')}</div></div>
              </div>
              {(shopee.topProducts || []).length > 0 && (
                <ul className="list" style={{ marginTop: 10 }}>{(shopee.topProducts || []).map((p, i) => (
                  <li key={i}><b>{p.name}</b><br /><span className="hint">{p.orders} pedido(s){p.commission > 0 ? ` · R$ ${p.commission.toFixed(2).replace('.', ',')}` : ''}</span></li>
                ))}</ul>
              )}
            </>
          )}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recentes</h3>
        {logs.length === 0 ? <Empty icon="📤" text="Os disparos aparecem aqui." actionLabel="Envio" actionHref="/dashboard/postagens/envio" /> : (
          <ul className="list">{logs.map((l) => <li key={l.id}><b>{new Date(l.sentAt).toLocaleString()}</b> — {l.groupJid} — <span className={`badge ${l.status === 'sent' ? 'badge-ok' : 'badge-err'}`}>{l.status}</span></li>)}</ul>
        )}
      </div>
    </>
  );
}
