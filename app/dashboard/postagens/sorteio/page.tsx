'use client';
import { useEffect, useState } from 'react';
import { SlotPicker } from '../SlotPicker';
import Empty from '../../Empty';

type Group = { id: string; name: string };
type Member = { id: string; admin: string | null };

function mask(id: string) {
  const num = id.split('@')[0].split(':')[0];
  return num.length > 4 ? `+${num.slice(0, 2)} ****-${num.slice(-4)}` : num;
}

const DEFAULT_WELCOME = '👋 Bem-vindo(a) ao grupo! Aqui você recebe as melhores ofertas country todos os dias. 🔔 Ative as notificações e convide quem também quer pagar menos!';

export default function Sorteio() {
  const [slot, setSlot] = useState<'wa1' | 'wa2'>('wa1');
  const [phones, setPhones] = useState<Record<string, string | undefined>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupJid, setGroupJid] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [winner, setWinner] = useState('');
  const [msg, setMsg] = useState('');
  const [bvTargets, setBvTargets] = useState<string[]>([]);
  const [bvText, setBvText] = useState(DEFAULT_WELCOME);

  async function loadGroups(sl: 'wa1' | 'wa2') {
    const d = await fetch(`/api/whatsapp/groups?slot=${sl}`).then((r) => r.json()).catch(() => null);
    const gl = (d?.groups || []) as Group[];
    setGroups(gl);
    return gl;
  }

  useEffect(() => {
    fetch('/api/whatsapp/status').then((r) => r.json()).then((s) => {
      const slots = s?.slots || {};
      const ph: Record<string, string | undefined> = {};
      for (const k of ['wa1', 'wa2']) if (slots[k]?.phone) ph[k] = slots[k].phone;
      setPhones(ph);
    }).catch(() => {});
    loadGroups('wa1');
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'boasvindas');
      const cfg = (it?.config || {}) as { targets?: string[]; text?: string; slot?: string };
      if (cfg.targets) setBvTargets(cfg.targets);
      if (cfg.text) setBvText(cfg.text);
      if (cfg.slot === 'wa2') { setSlot('wa2'); loadGroups('wa2'); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeSlot(sl: 'wa1' | 'wa2') {
    setSlot(sl);
    setGroupJid('');
    setMembers([]);
    setWinner('');
    loadGroups(sl);
  }

  async function loadMembers(jid: string) {
    setGroupJid(jid);
    setWinner('');
    setMembers([]);
    if (!jid) return;
    const d = await fetch(`/api/whatsapp/participants?groupJid=${encodeURIComponent(jid)}&slot=${slot}`).then((r) => r.json()).catch(() => null);
    if (d?.error) setMsg(`❌ ${d.error}`);
    else setMembers(d?.participants || []);
  }

  function draw() {
    if (!members.length) { setMsg('❌ Carregue os membros.'); return; }
    const w = members[Math.floor(Math.random() * members.length)];
    setWinner(w.id);
    setMsg('');
  }

  async function announce() {
    if (!winner || !groupJid) return;
    const num = winner.split('@')[0].split(':')[0];
    const r = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: groupJid, text: `🎉 SORTEIO 🎉\n\nParabéns +${num}! Você foi o ganhador(a)! 🏆`, slot }),
    }).then((x) => x.json());
    setMsg(r.ok ? '✅ Anunciado!' : `❌ ${r.error}`);
  }

  function toggleBv(id: string) {
    setBvTargets((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function saveBv() {
    if (!bvTargets.length) { setMsg('❌ Selecione um grupo.'); return; }
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'boasvindas', config: { targets: bvTargets, text: bvText, slot } }),
    });
    setMsg('✅ Ativo!');
  }

  return (
    <>
      <h1 className="h1">Sorteio</h1>
      {msg && <p>{msg}</p>}

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>🎉 Sortear</h3>
        <SlotPicker slot={slot} setSlot={changeSlot} phones={phones} />
        <label className="lbl">Grupo</label>
        <select className="input" value={groupJid} onChange={(e) => loadMembers(e.target.value)}>
          <option value="">Selecione...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {groups.length === 0 && <Empty icon="👥" text="Entre em grupos com este número para sortear." actionLabel="Conectar" actionHref="/dashboard/robo" />}
        {groupJid && <p className="hint">{members.length} membros.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={draw}>🎲 Sortear</button>
          {winner && <button className="btn btn-ghost btn-sm" onClick={announce}>📢 Anunciar</button>}
        </div>
        {winner && <p style={{ marginTop: 8 }}>🏆 <b>{mask(winner)}</b></p>}
      </div>

      <div className="card" style={{ maxWidth: 720, marginTop: 12 }}>
        <h3>👋 Boas-vindas</h3>
        <label className="lbl">Grupos</label>
        {groups.map((g) => (
          <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <input type="checkbox" checked={bvTargets.includes(g.id)} onChange={() => toggleBv(g.id)} /> {g.name}
          </label>
        ))}
        <label className="lbl" style={{ marginTop: 8 }}>Mensagem</label>
        <textarea className="input" rows={3} value={bvText} onChange={(e) => setBvText(e.target.value)} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveBv}>Salvar</button>
      </div>
    </>
  );
}
