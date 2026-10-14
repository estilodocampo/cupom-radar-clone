'use client';
import { useEffect, useState } from 'react';

type StoreStat = { store: string; links: number; clicks: number };
type Shopee = {
  configured?: boolean;
  totals?: { clicks: number; orders: number; commission: number; rows: number };
  topProducts?: { name: string; orders: number; commission: number; clicks: number }[];
  error?: string;
};

const STORES = [
  { id: 'mercadolivre', icon: '🟦', name: 'Mercado Livre', panel: 'https://www.mercadolivre.com.br/afiliados/' },
  { id: 'amazon', icon: '🟧', name: 'Amazon', panel: 'https://associados.amazon.com.br/' },
  { id: 'magalu', icon: '🟥', name: 'Magalu', panel: '' },
  { id: 'shein', icon: '⬛', name: 'SHEIN', panel: '' },
];

const br = (v: number, d = 0) => v.toFixed(d).replace('.', ',');

export default function Saldo() {
  const [byStore, setByStore] = useState<StoreStat[]>([]);
  const [shopee, setShopee] = useState<Shopee | null>(null);

  useEffect(() => {
    fetch('/api/links/stats').then((r) => r.json()).then((d) => setByStore(d.byStore || [])).catch(() => {});
    fetch('/api/shopee/report').then((r) => r.json()).then(setShopee).catch(() => setShopee({ error: 'Falha ao consultar' }));
  }, []);

  const st = (id: string) => byStore.find((b) => b.store === id) || { links: 0, clicks: 0 };

  return (
    <div className="dash">
      <div className="dash-hello">
        <h1 className="h1" style={{ margin: 0 }}>Saldo 💰</h1>
        <p className="sub" style={{ margin: 0 }}>Ganhos por plataforma.</p>
      </div>

      <div className="op-sec" style={{ marginTop: 4 }}>
        <h3>🛒 Shopee</h3>
        <small>API ao vivo</small>
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
        return (
          <div key={s.id}>
            <div className="op-sec">
              <h3>{s.icon} {s.name}</h3>
              <small>/r/</small>
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
    </div>
  );
}
