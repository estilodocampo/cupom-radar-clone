'use client';
import { useEffect, useState } from 'react';
import { SlotPicker } from '../SlotPicker';

type Group = { id: string; name: string };
type Rule = {
  id: string; name: string; slot: string; hub: string; targets: string[];
  onlyMine: boolean; requireLink: boolean; convert: boolean; stripCoupons: boolean;
  prefix: string; suffix: string; minInterval: number; maxPerDay: number; dedupHoras: number; pausado: boolean;
};

const INTERVALS = [
  { v: 0, l: 'Sem limite (toda mensagem)' },
  { v: 5, l: 'No máximo 1 a cada 5 min' },
  { v: 15, l: 'No máximo 1 a cada 15 min' },
  { v: 30, l: 'No máximo 1 a cada 30 min' },
  { v: 60, l: 'No máximo 1 por hora' },
  { v: 180, l: 'No máximo 1 a cada 3 horas' },
  { v: 1440, l: 'No máximo 1 por dia' },
];

const MAXES = [0, 1, 2, 3, 5, 10, 20, 50];
const DEDUP = [
  { v: 0, l: 'Não bloquear' },
  { v: 6, l: '6 horas' },
  { v: 24, l: '24 horas' },
  { v: 72, l: '3 dias' },
  { v: 168, l: '7 dias' },
];

export default function Distribuidor() {
  const [slot, setSlot] = useState<'wa1' | 'wa2'>('wa1');
  const [phones, setPhones] = useState<Record<string, string | undefined>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
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
  const [dedupHoras, setDedupHoras] = useState(24);
  const [pausado, setPausado] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadGroups(sl: 'wa1' | 'wa2') {
    const g = await fetch(`/api/whatsapp/groups?slot=${sl}`).then((r) => r.json()).catch(() => null);
    setGroups((g?.groups || []) as Group[]);
  }

  async function load() {
    const d = await fetch('/api/distribuidor/rules').then((r) => r.json()).catch(() => null);
    setRules((d?.items || []) as Rule[]);
    const s = await fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null);
    const slots = s?.slots || {};
    const ph: Record<string, string | undefined> = {};
    for (const k of ['wa1', 'wa2']) if (slots[k]?.phone) ph[k] = slots[k].phone;
    setPhones(ph);
  }

  useEffect(() => { loadGroups(slot); load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeSlot(sl: 'wa1' | 'wa2') {
    setSlot(sl);
    resetForm();
    loadGroups(sl);
  }

  function resetForm() {
    setEditing(null); setName(''); setHub(''); setPicked([]); setExtra('');
    setOnlyMine(false); setRequireLink(false); setConvert(true); setStripCoupons(true);
    setPrefix(''); setSuffix(''); setMinInterval(0); setMaxPerDay(0); setDedupHoras(24); setPausado(false);
  }

  function edit(r: Rule) {
    setEditing(r.id); setName(r.name); setHub(r.hub);
    setOnlyMine(r.onlyMine); setRequireLink(r.requireLink); setConvert(r.convert); setStripCoupons(r.stripCoupons);
    setPrefix(r.prefix); setSuffix(r.suffix); setMinInterval(r.minInterval); setMaxPerDay(r.maxPerDay);
    setDedupHoras(r.dedupHoras); setPausado(r.pausado);
    setPicked(r.targets.filter((t) => groups.some((g) => g.id === t)));
    setExtra(r.targets.filter((t) => !groups.some((g) => g.id === t)).join('\n'));
    window.scrollTo({ top: 0 });
  }

  function toggle(id: string) {
    if (id === hub) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function targetsAtuais() {
    const manual = extra.split('\n').map((x) => x.trim()).filter(Boolean);
    return [...new Set([...picked, ...manual])].filter((t) => t !== hub);
  }

  function gname(id: string) {
    return groups.find((g) => g.id === id)?.name || `${id.slice(0, 14)}…`;
  }

  async function save(pausadoOver?: boolean) {
    if (!hub.endsWith('@g.us')) { setMsg('❌ Selecione o SEU grupo (o hub).'); return; }
    const all = targetsAtuais();
    if (!all.length) { setMsg('❌ Selecione ao menos um grupo para receber.'); return; }
    const res = await fetch('/api/distribuidor/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing || undefined, name, slot, hub, targets: all, onlyMine, requireLink, convert,
        stripCoupons, prefix, suffix, minInterval, maxPerDay, dedupHoras,
        pausado: pausadoOver !== undefined ? pausadoOver : pausado,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(`❌ ${d.error || 'Falha ao salvar'}`); return; }
    if (pausadoOver !== undefined) setPausado(pausadoOver);
    resetForm();
    load();
    setMsg('✅ Regra salva! Tudo que passar pelo hub será repassado.');
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta regra de distribuição?')) return;
    await fetch(`/api/distribuidor/rules?id=${id}`, { method: 'DELETE' });
    load();
  }

  const mine = rules.filter((r) => (r.slot || 'wa1') === slot);

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● DISTRIBUIDOR</div>
      <h1 className="h1">Distribuidor</h1>
      <p className="sub">Uma regra por hub: do seu grupo para os demais, com as suas regras.</p>
      {msg && <p>{msg}</p>}

      <label className="lbl">Número que distribui</label>
      <SlotPicker slot={slot} setSlot={changeSlot} phones={phones} />

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>{editing ? 'Editar regra' : 'Nova regra'}</h3>
        <label className="lbl">Nome (opcional)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Country wa1" />

        <div className="dash-section" style={{ marginTop: 12 }}>
          <div className="dash-eyebrow">1 · ENTRADA</div>
        </div>
        <label className="lbl">Seu grupo (hub) — o que passa aqui é distribuído</label>
        <select className="input" value={hub} onChange={(e) => { setHub(e.target.value); setPicked((p) => p.filter((x) => x !== e.target.value)); }}>
          <option value="">Selecione seu grupo...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => loadGroups(slot)}>↻ Recarregar grupos do 📱 {slot === 'wa1' ? '1' : '2'}</button>
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
          <div style={{ flex: '1 1 170px' }}>
            <label className="lbl">Não repetir a mesma oferta</label>
            <select className="input" value={dedupHoras} onChange={(e) => setDedupHoras(Number(e.target.value))}>
              {DEDUP.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        <label className="lbl" style={{ marginTop: 12 }}>Texto antes de cada mensagem (opcional)</label>
        <input className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="🔥 ACHADINHO DO DIA" />
        <label className="lbl">Texto depois de cada mensagem (opcional)</label>
        <input className="input" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Compre pelo link e receba comissão" />

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => save()}>{editing ? 'Atualizar regra' : 'Criar regra'}</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Trava anti-loop ativa: nunca repassa a partir de um grupo que já recebe, e nunca devolve ao seu hub. O worker aplica em até 60s.
        </p>
        <p className="hint">🗑️ Apagou no seu grupo? As cópias saem dos demais automaticamente (dentro da janela do WhatsApp, ~2 dias).</p>
      </div>

      <div style={{ marginTop: 16, maxWidth: 720 }}>
        {mine.length === 0 && <p className="hint">Nenhuma regra neste número ainda.</p>}
        {mine.map((r) => (
          <div className="card" key={r.id} style={{ marginBottom: 8 }}>
            <b>{r.name || 'Distribuição'}</b> {r.pausado ? <span className="badge badge-err">PAUSADO</span> : <span className="badge badge-ok">ATIVO</span>}
            <p className="hint">{gname(r.hub)} → {r.targets.length} grupo(s){r.minInterval ? ` · 1/${r.minInterval}min` : ''}{r.maxPerDay ? ` · máx ${r.maxPerDay}/dia` : ''}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(r)}>Editar</button>
              <button
                className="btn btn-sm"
                style={{ background: r.pausado ? '#1d4ed8' : '#c0362c', color: '#fff' }}
                onClick={async () => {
                  await fetch('/api/distribuidor/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, name: r.name, slot: r.slot, hub: r.hub, targets: r.targets, onlyMine: r.onlyMine, requireLink: r.requireLink, convert: r.convert, stripCoupons: r.stripCoupons, prefix: r.prefix, suffix: r.suffix, minInterval: r.minInterval, maxPerDay: r.maxPerDay, dedupHoras: r.dedupHoras, pausado: !r.pausado }) });
                  load();
                }}
              >
                {r.pausado ? '▶️ Retomar' : '⏸️ Pausar'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
