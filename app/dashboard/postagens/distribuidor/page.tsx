'use client';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string };

const INTERVALS = [
  { v: 0, l: 'Sem limite (toda mensagem)' },
  { v: 5, l: 'No máximo 1 a cada 5 min' },
  { v: 15, l: 'No máximo 1 a cada 15 min' },
  { v: 30, l: 'No máximo 1 a cada 30 min' },
  { v: 60, l: 'No máximo 1 por hora' },
  { v: 180, l: 'No máximo 1 a cada 3 horas' },
  { v: 1440, l: 'No máximo 1 por dia' },
];

const MAXES = [0, 1, 2, 3, 5, 10, 20];

export default function Distribuidor() {
  const [hub, setHub] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [requireLink, setRequireLink] = useState(false);
  const [convert, setConvert] = useState(true);
  const [stripCoupons, setStripCoupons] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [minInterval, setMinInterval] = useState(0);
  const [maxPerDay, setMaxPerDay] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [msg, setMsg] = useState('');
  const [fila, setFila] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null),
      fetch('/api/integrations').then((r) => r.json()).catch(() => null),
    ]).then(([g, d]) => {
      const gl = (g?.groups || []) as Group[];
      setGroups(gl);
      const it = (d?.items || []).find((x: { provider: string }) => x.provider === 'distribuidor');
      const c = (it?.config || {}) as Record<string, unknown>;
      const saved = (c.targets as string[]) || [];
      setHub((c.hub as string) || '');
      setOnlyMine(!!c.onlyMine);
      setRequireLink(!!c.requireLink);
      setConvert(c.convert !== false);
      setStripCoupons(c.stripCoupons !== false);
      setPrefix((c.prefix as string) || '');
      setSuffix((c.suffix as string) || '');
      setMinInterval(Number(c.minInterval) || 0);
      setMaxPerDay(Number(c.maxPerDay) || 0);
      setPicked(saved.filter((t) => gl.some((x) => x.id === t)));
      setExtra(saved.filter((t) => !gl.some((x) => x.id === t)).join('\n'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => fetch('/api/whatsapp/status').then((r) => r.json()).then((d) => setFila(Number(d?.fila) || 0)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  function toggle(id: string) {
    if (id === hub) return; // nunca distribuir para o próprio hub
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    if (!hub) { setMsg('❌ Selecione o SEU grupo (o hub).'); return; }
    const manual = extra.split('\n').map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...picked, ...manual])].filter((t) => t !== hub);
    if (!all.length) { setMsg('❌ Selecione ao menos um grupo para receber.'); return; }
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'distribuidor', config: { hub, targets: all, onlyMine, requireLink, convert, stripCoupons, prefix, suffix, minInterval, maxPerDay } }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? '✅ Distribuidor salvo! Tudo que você postar no seu grupo será repassado.' : `❌ ${d.error || 'Falha ao salvar'}`);
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● DISTRIBUIDOR</div>
      <h1 className="h1">Distribuidor</h1>
      <p className="sub">
        Fonte → seu grupo → outros grupos. <span className="badge badge-ok">NOVO</span>
      </p>
      {msg && <p>{msg}</p>}

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="dash-section" style={{ marginTop: 0 }}>
          <div className="dash-eyebrow">1 · ENTRADA</div>
        </div>
        <label className="lbl">Seu grupo (hub) — o que você posta aqui é distribuído</label>
        <select className="input" value={hub} onChange={(e) => { setHub(e.target.value); setPicked((p) => p.filter((x) => x !== e.target.value)); }}>
          <option value="">Selecione seu grupo...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <p className="hint">O Modo Copiador pode alimentar este grupo automaticamente a partir da fonte.</p>

        <div className="dash-section">
          <div className="dash-eyebrow">2 · SAÍDA</div>
        </div>
        <label className="lbl">Grupos que recebem</label>
        {groups.map((g) => (
          <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', opacity: g.id === hub ? .45 : 1 }}>
            <input type="checkbox" disabled={g.id === hub} checked={picked.includes(g.id)} onChange={() => toggle(g.id)} />
            {g.name} {g.id === hub && <span className="badge">seu hub</span>}
          </label>
        ))}
        <textarea className="input" rows={2} style={{ marginTop: 8 }} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="JIDs extras, um por linha (opcional)" />

        <div className="dash-section">
          <div className="dash-eyebrow">3 · REGRAS</div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Repassar só o que <b>eu</b> posto
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={requireLink} onChange={(e) => setRequireLink(e.target.checked)} /> Repassar apenas mensagens com link
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={convert} onChange={(e) => setConvert(e.target.checked)} /> Converter links para o meu afiliado
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={stripCoupons} onChange={(e) => setStripCoupons(e.target.checked)} /> Remover cupons
        </label>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="lbl">Frequência</label>
            <select className="input" value={minInterval} onChange={(e) => setMinInterval(Number(e.target.value))}>
              {INTERVALS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="lbl">Máx. por dia</label>
            <select className="input" value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))}>
              {MAXES.map((n) => <option key={n} value={n}>{n === 0 ? 'Sem limite' : n}</option>)}
            </select>
          </div>
        </div>

        <label className="lbl" style={{ marginTop: 12 }}>Texto antes de cada mensagem (opcional)</label>
        <input className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="🔥 ACHADINHO DO DIA" />
        <label className="lbl">Texto depois de cada mensagem (opcional)</label>
        <input className="input" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Compre pelo link e receba comissão" />

        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={save}>Salvar distribuidor</button>
        <p className="hint" style={{ marginTop: 8 }}>
          Trava anti-loop ativa: nunca repassa a partir de um grupo que já recebe, e nunca devolve ao seu hub. O worker aplica em até 60s.
        </p>
        {fila > 0 && <p className="hint">⏳ <b>{fila}</b> mensagem(ns) aguardando envio na fila — nada se perde.</p>}
      </div>
    </>
  );
}
