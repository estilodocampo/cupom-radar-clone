'use client';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string };
type Member = { id: string; admin: string | null };

function mask(id: string) {
  const num = id.split('@')[0].split(':')[0];
  return num.length > 4 ? `+${num.slice(0, 2)} ****-${num.slice(-4)}` : num;
}

const DEFAULT_WELCOME = '👋 Bem-vindo(a) ao grupo! Aqui você recebe as melhores ofertas country todos os dias. 🔔 Ative as notificações e convide quem também quer pagar menos!';

export default function Sorteio() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupJid, setGroupJid] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [winner, setWinner] = useState('');
  const [msg, setMsg] = useState('');
  const [bvTargets, setBvTargets] = useState<string[]>([]);
  const [bvText, setBvText] = useState(DEFAULT_WELCOME);

  useEffect(() => {
    fetch('/api/whatsapp/groups').then((r) => r.json()).then((d) => setGroups(d.groups || [])).catch(() => {});
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'boasvindas');
      const cfg = (it?.config || {}) as { targets?: string[]; text?: string };
      if (cfg.targets) setBvTargets(cfg.targets);
      if (cfg.text) setBvText(cfg.text);
    }).catch(() => {});
  }, []);

  async function loadMembers(jid: string) {
    setGroupJid(jid);
    setWinner('');
    setMembers([]);
    if (!jid) return;
    const d = await fetch(`/api/whatsapp/participants?groupJid=${encodeURIComponent(jid)}`).then((r) => r.json()).catch(() => null);
    if (d?.error) setMsg(`❌ ${d.error}`);
    else setMembers(d?.participants || []);
  }

  function draw() {
    if (!members.length) { setMsg('❌ Carregue os membros primeiro.'); return; }
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
      body: JSON.stringify({ to: groupJid, text: `🎉 SORTEIO 🎉\n\nParabéns +${num}! Você foi o ganhador(a)! 🏆` }),
    }).then((x) => x.json());
    setMsg(r.ok ? '✅ Vencedor anunciado no grupo!' : `❌ ${r.error}`);
  }

  function toggleBv(id: string) {
    setBvTargets((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function saveBv() {
    if (!bvTargets.length) { setMsg('❌ Selecione ao menos um grupo para as boas-vindas.'); return; }
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'boasvindas', config: { targets: bvTargets, text: bvText } }),
    });
    setMsg('✅ Boas-vindas ativas! Novos membros serão recebidos automaticamente.');
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● CRESCIMENTO</div>
      <h1 className="h1">Sorteio + Boas-vindas</h1>
      <p className="sub">Ferramentas para crescer o grupo. <span className="badge badge-ok">NOVO</span></p>
      {msg && <p>{msg}</p>}

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>🎉 Sortear membro</h3>
        <label className="lbl">Grupo</label>
        <select className="input" value={groupJid} onChange={(e) => loadMembers(e.target.value)}>
          <option value="">Selecione...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {groupJid && <p className="hint">{members.length} membros carregados.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={draw}>🎲 Sortear</button>
          {winner && <button className="btn btn-ghost btn-sm" onClick={announce}>📢 Anunciar no grupo</button>}
        </div>
        {winner && <p style={{ marginTop: 8 }}>🏆 Vencedor: <b>{mask(winner)}</b></p>}
      </div>

      <div className="card" style={{ maxWidth: 720, marginTop: 12 }}>
        <h3>👋 Boas-vindas automáticas</h3>
        <p className="hint">Todo membro novo recebe esta mensagem com menção.</p>
        <label className="lbl">Grupos</label>
        {groups.map((g) => (
          <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <input type="checkbox" checked={bvTargets.includes(g.id)} onChange={() => toggleBv(g.id)} /> {g.name}
          </label>
        ))}
        <label className="lbl" style={{ marginTop: 8 }}>Mensagem</label>
        <textarea className="input" rows={3} value={bvText} onChange={(e) => setBvText(e.target.value)} />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveBv}>Salvar boas-vindas</button>
      </div>
    </>
  );
}
