'use client';
import { useEffect, useState } from 'react';

type StoreStat = { store: string; links: number; clicks: number };
type Shopee = {
  configured?: boolean;
  totals?: { clicks: number; orders: number; commission: number; rows: number };
  topProducts?: { name: string; orders: number; commission: number; clicks: number }[];
  at?: string;
  cached?: boolean;
  error?: string;
};

function haQuanto(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

const STORES = [
  { id: 'mercadolivre', icon: '🟦', name: 'Mercado Livre', panel: 'https://www.mercadolivre.com.br/afiliados/' },
  { id: 'amazon', icon: '🟧', name: 'Amazon', panel: 'https://associados.amazon.com.br/' },
  { id: 'magalu', icon: '🟥', name: 'Magalu', panel: '' },
  { id: 'shein', icon: '⬛', name: 'SHEIN', panel: '' },
];

const br = (v: number, d = 0) => v.toFixed(d).replace('.', ',');

const parseBr = (s: string): number => {
  const n = Number(String(s || '').replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export default function Saldo() {
  const [byStore, setByStore] = useState<StoreStat[]>([]);
  const [shopee, setShopee] = useState<Shopee | null>(null);
  const [saldos, setSaldos] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/links/stats').then((r) => r.json()).then((d) => setByStore(d.byStore || [])).catch(() => {});
    fetch('/api/shopee/report').then((r) => r.json()).then(setShopee).catch(() => setShopee({ error: 'Falha ao consultar' }));
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d?.items || []).find((x: { provider: string }) => x.provider === 'saldos');
      const c = (it?.config || {}) as Record<string, number>;
      const m: Record<string, string> = {};
      for (const s of STORES) if (c[s.id] > 0) m[s.id] = String(c[s.id]).replace('.', ',');
      setSaldos(m);
    }).catch(() => {});
  }, []);

  const st = (id: string) => byStore.find((b) => b.store === id) || { links: 0, clicks: 0 };
  const saldoDe = (id: string) => parseBr(saldos[id] || '');

  async function salvarSaldos() {
    const cfg: Record<string, number> = {};
    for (const s of STORES) {
      const v = parseBr(saldos[s.id] || '');
      if (v > 0) cfg[s.id] = v;
    }
    const r = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'saldos', config: cfg }) }).then((x) => x.json()).catch(() => null);
    setMsg(r?.ok ? '✅ Salvo!' : '❌ Falha ao salvar');
    setTimeout(() => setMsg(''), 2500);
  }

  return (
    <div className="dash">
      <div className="dash-hello">
        <h1 className="h1" style={{ margin: 0 }}>Saldo 💰</h1>
        <p className="sub" style={{ margin: 0 }}>Ganhos por plataforma.</p>
      </div>

      <div className="op-sec" style={{ marginTop: 4 }}>
        <h3>🛒 Shopee</h3>
        <small>API{shopee?.at ? ` · ${haQuanto(shopee.at)}` : ' ao vivo'}</small>
      </div>
      {shopee == null ? (
        <div className="op-today">
          <div className="op-mini"><small>CLIQUES</small><b>…</b></div>
          <div className="op-mini"><small>PEDIDOS</small><b>…</b></div>
          <div className="op-mini"><small>COMISSÃO</small><b>…</b></div>
        </div>
      ) : shopee.configured === false ? (
        <div className="empty">
          <span className="empty-ico">🛒</span>
          <p><b>API Shopee desligada.</b><br />Cadastre App ID + Secret no Robô.</p>
          <a className="btn btn-primary btn-sm" href="/dashboard/robo">Robô</a>
        </div>
      ) : shopee.error ? (
        <div className="empty">
          <span className="empty-ico">⚠️</span>
          <p>{shopee.error}</p>
        </div>
      ) : (
        <>
          <div className="op-today">
            <div className="op-mini"><small>CLIQUES</small><b>{shopee.totals?.clicks ?? 0}</b></div>
            <div className="op-mini"><small>PEDIDOS</small><b>{shopee.totals?.orders ?? 0}</b></div>
            <div className="op-mini"><small>COMISSÃO</small><b>R$ {br(shopee.totals?.commission ?? 0, 2)}</b></div>
          </div>
          {(shopee.topProducts || []).length > 0 && (
            <ul className="list" style={{ marginTop: 10 }}>{(shopee.topProducts || []).map((p, i) => (
              <li key={i}><b>{p.name}</b><br /><span className="hint">{p.orders} pedido(s){p.commission > 0 ? ` · R$ ${br(p.commission, 2)}` : ''}</span></li>
            ))}</ul>
          )}
        </>
      )}

      {STORES.map((s) => {
        const v = st(s.id);
        const sd = saldoDe(s.id);
        return (
          <div key={s.id}>
            <div className="op-sec">
              <h3>{s.icon} {s.name}</h3>
              <small>/r/{sd > 0 ? ` · R$ ${br(sd, 2)}` : ''}</small>
              {s.panel ? <a href={s.panel} target="_blank" rel="noreferrer">painel ↗</a> : null}
            </div>
            <div className="op-today">
              <div className="op-mini"><small>LINKS</small><b>{v.links}</b></div>
              <div className="op-mini"><small>CLIQUES</small><b>{v.clicks}</b></div>
              <div className="op-mini"><small>MÉDIA</small><b>{v.links ? br(v.clicks / v.links, 1) : '0'}</b></div>
            </div>
          </div>
        );
      })}

      <div className="op-sec">
        <h3>💰 Meus saldos</h3>
        <small>manual</small>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        {STORES.map((s) => (
          <div className="row" key={s.id}>
            <div style={{ flex: 1 }}><small className="hint">{s.icon} {s.name.toUpperCase()} (R$)</small>
              <input className="input" style={{ margin: '4px 0 0' }} inputMode="decimal" placeholder="0,00"
                value={saldos[s.id] || ''} onChange={(e) => setSaldos({ ...saldos, [s.id]: e.target.value })} />
            </div>
          </div>
        ))}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={salvarSaldos}>Salvar saldos</button>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
