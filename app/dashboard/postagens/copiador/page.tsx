'use client';
import { useEffect, useState } from 'react';
import { SlotPicker } from '../SlotPicker';

type Group = { id: string; name: string };
type Rule = { id: string; name: string; slot: string; source: string; hub: string; keepCoupons: boolean; active: boolean };

export default function Copiador() {
  const [slot, setSlot] = useState<'wa1' | 'wa2'>('wa1');
  const [phones, setPhones] = useState<Record<string, string | undefined>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [hub, setHub] = useState('');
  const [keepCoupons, setKeepCoupons] = useState(false);
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState('');

  async function loadGroups(sl: 'wa1' | 'wa2') {
    const g = await fetch(`/api/whatsapp/groups?slot=${sl}`).then((r) => r.json()).catch(() => null);
    setGroups((g?.groups || []) as Group[]);
  }

  async function load() {
    const d = await fetch('/api/copiador/rules').then((r) => r.json()).catch(() => null);
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
    setEditing(null); setName(''); setSource(''); setHub(''); setKeepCoupons(false); setActive(true);
  }

  function edit(r: Rule) {
    setEditing(r.id); setName(r.name); setSource(r.source); setHub(r.hub);
    setKeepCoupons(r.keepCoupons); setActive(r.active);
    window.scrollTo({ top: 0 });
  }

  function gname(id: string) {
    return groups.find((g) => g.id === id)?.name || `${id.slice(0, 14)}…`;
  }

  async function save() {
    if (!source.endsWith('@g.us')) { setMsg('❌ Cole o JID do grupo de origem.'); return; }
    if (!hub.endsWith('@g.us')) { setMsg('❌ Selecione o grupo hub.'); return; }
    const res = await fetch('/api/copiador/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing || undefined, name, slot, source: source.trim(), hub, keepCoupons, active }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(`❌ ${d.error || 'Falha ao salvar'}`); return; }
    resetForm();
    load();
    setMsg('✅ Regra salva! Ofertas da origem chegam convertidas no hub.');
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta regra de cópia?')) return;
    await fetch(`/api/copiador/rules?id=${id}`, { method: 'DELETE' });
    load();
  }

  const mine = rules.filter((r) => (r.slot || 'wa1') === slot);

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO COPIADOR</div>
      <h1 className="h1">Modo Copiador</h1>
      <p className="sub">Uma regra por origem: cada grupo de origem alimenta o seu hub, já com o seu link.</p>
      {msg && <p>{msg}</p>}

      <label className="lbl">Número que monitora</label>
      <SlotPicker slot={slot} setSlot={changeSlot} phones={phones} />

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>{editing ? 'Editar regra' : 'Nova regra de cópia'}</h3>
        <label className="lbl">Nome (opcional)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Achados Cuiudos" />
        <label className="lbl">Grupo de origem (JID)</label>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="1203...@g.us (grupo da fonte)" />
        <p className="hint">O número 📱 {slot === 'wa1' ? '1' : '2'} precisa ser membro do grupo de origem.</p>
        <label className="lbl">Grupo hub (seu grupo que recebe)</label>
        <select className="input" value={hub} onChange={(e) => setHub(e.target.value)}>
          <option value="">Selecione seu grupo...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => loadGroups(slot)}>↻ Recarregar grupos do 📱 {slot === 'wa1' ? '1' : '2'}</button>
        <input className="input" style={{ marginTop: 8 }} value={hub} onChange={(e) => setHub(e.target.value)} placeholder="Ou cole o JID do hub" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={keepCoupons} onChange={(e) => setKeepCoupons(e.target.checked)} /> Manter cupons da origem
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Regra ativa
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={save}>{editing ? 'Atualizar' : 'Criar regra'}</button>
          {editing && <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      <div style={{ marginTop: 16, maxWidth: 720 }}>
        {mine.length === 0 && <p className="hint">Nenhuma regra neste número ainda.</p>}
        {mine.map((r) => (
          <div className="card" key={r.id} style={{ marginBottom: 8 }}>
            <b>{r.name || 'Cópia'}</b> {r.active ? <span className="badge badge-ok">ativa</span> : <span className="badge">pausada</span>}
            <p className="hint">{r.source.slice(0, 18)}… → {gname(r.hub)}{r.keepCoupons ? ' · mantém cupons' : ''}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(r)}>Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
