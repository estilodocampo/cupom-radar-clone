'use client';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string };
type Radar = {
  id: string; name: string; keywords: string[]; targetGroups: string[];
  intervalMinutes: number; maxPostsPerRun: number; active: boolean;
  lastRunAt: string | null; _count?: { posts: number };
};

const INTERVALS = [
  { v: 30, l: 'A cada 30 min' },
  { v: 60, l: 'A cada 1 hora' },
  { v: 120, l: 'A cada 2 horas' },
  { v: 240, l: 'A cada 4 horas' },
  { v: 480, l: 'A cada 8 horas' },
  { v: 1440, l: '1x ao dia' },
];

export default function Radar() {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shopeeOk, setShopeeOk] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [interval, setInterval] = useState(120);
  const [maxPosts, setMaxPosts] = useState(3);
  const [active, setActive] = useState(true);

  async function load() {
    const d = await fetch('/api/radar').then((r) => r.json()).catch(() => null);
    setRadars(d?.items || []);
    const g = await fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null);
    setGroups(g?.groups || []);
    const integ = await fetch('/api/integrations').then((r) => r.json()).catch(() => null);
    const sh = (integ?.items || []).find((x: { provider: string; config?: { appId?: string } }) => x.provider === 'shopee_api');
    setShopeeOk(!!(sh?.config?.appId));
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditing(null); setName(''); setKeywords(''); setPicked([]); setExtra('');
    setInterval(120); setMaxPosts(3); setActive(true);
  }

  function edit(r: Radar) {
    setEditing(r.id);
    setName(r.name);
    setKeywords(r.keywords.join(', '));
    setPicked(r.targetGroups.filter((t) => groups.some((g) => g.id === t)));
    setExtra(r.targetGroups.filter((t) => !groups.some((g) => g.id === t)).join('\n'));
    setInterval(r.intervalMinutes);
    setMaxPosts(r.maxPostsPerRun);
    setActive(r.active);
    window.scrollTo({ top: 0 });
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    const kws = keywords.split(',').map((x) => x.trim()).filter(Boolean);
    const manual = extra.split('\n').map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...picked, ...manual])];
    if (!kws.length) { alert('Informe ao menos uma palavra-chave.'); return; }
    if (!all.length) { alert('Selecione ao menos um grupo destino.'); return; }
    const res = await fetch('/api/radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing || undefined, name, keywords: kws, targetGroups: all,
        intervalMinutes: interval, maxPostsPerRun: maxPosts, active,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || 'Falha ao salvar'); return; }
    resetForm();
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir este radar?')) return;
    await fetch(`/api/radar/${id}`, { method: 'DELETE' });
    load();
  }

  async function toggleActive(r: Radar) {
    await fetch('/api/radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: r.id, name: r.name, keywords: r.keywords, targetGroups: r.targetGroups,
        intervalMinutes: r.intervalMinutes, maxPostsPerRun: r.maxPostsPerRun, active: !r.active,
      }),
    });
    load();
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● RADAR SHOPEE</div>
      <h1 className="h1">Radar Shopee</h1>
      <p className="sub">
        Importação automática por palavras-chave.
        {shopeeOk
          ? <span className="badge badge-ok"> API Shopee conectada</span>
          : <span className="badge"> ⚠️ Conecte App ID + Secret no <a href="/dashboard/robo">Config Robô → Shopee</a></span>}
      </p>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>{editing ? 'Editar radar' : 'Novo radar'}</h3>
        <label className="lbl">Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Achadinhos tech" />
        <label className="lbl">Palavras-chave (separadas por vírgula)</label>
        <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="fone bluetooth, camisa country, botina" />
        <label className="lbl" style={{ marginTop: 12 }}>Grupos destino</label>
        {groups.length === 0 && <p className="hint">Conecte o WhatsApp no Config Robô para listar os grupos.</p>}
        {groups.map((g) => (
          <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id)} /> {g.name}
          </label>
        ))}
        <textarea className="input" rows={2} style={{ marginTop: 8 }} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="JIDs extras, um por linha (opcional)" />
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="lbl">Frequência</label>
            <select className="input" value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
              {INTERVALS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="lbl">Máx. posts por rodada</label>
            <select className="input" value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Radar ativo
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={save}>{editing ? 'Atualizar' : 'Criar radar'}</button>
          {editing && <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      <div style={{ marginTop: 16, maxWidth: 720 }}>
        {radars.map((r) => (
          <div className="card" key={r.id} style={{ marginBottom: 8 }}>
            <b>{r.name}</b> {r.active ? <span className="badge badge-ok">ativo</span> : <span className="badge">pausado</span>}
            <p className="hint">{r.keywords.join(', ')} · {INTERVALS.find((o) => o.v === r.intervalMinutes)?.l || `${r.intervalMinutes} min`} · {r._count?.posts ?? 0} enviados · última rodada: {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString('pt-BR') : 'nunca'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(r)}>Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(r)}>{r.active ? 'Pausar' : 'Ativar'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
