'use client';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string };

export default function Copiador() {
  const [source, setSource] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [keepCoupons, setKeepCoupons] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/integrations').then((r) => r.json()).catch(() => null),
      fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null),
    ]).then(([d, g]) => {
      const it = (d?.items || []).find((x: { provider: string }) => x.provider === 'copiador');
      const cfg = (it?.config || {}) as { source?: string; targets?: string[]; keepCoupons?: boolean };
      const saved = cfg.targets || [];
      const gl = (g?.groups || []) as Group[];
      setGroups(gl);
      setSource(cfg.source || '');
      setKeepCoupons(!!cfg.keepCoupons);
      setPicked(saved.filter((t) => gl.some((x) => x.id === t)));
      setExtra(saved.filter((t) => !gl.some((x) => x.id === t)).join('\n'));
    }).catch(() => {});
  }, []);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    if (!source) { alert('Selecione o grupo de origem.'); return; }
    const manual = extra.split('\n').map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...picked, ...manual])];
    if (!all.length) { alert('Selecione ao menos um grupo destino.'); return; }
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'copiador', config: { source, targets: all, keepCoupons } }) });
    alert('✅ Copiador ativo! Novas ofertas do grupo de origem serão replicadas com seu link.');
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO COPIADOR</div>
      <h1 className="h1">Modo Copiador</h1>
      <p className="sub">Monitore um grupo de origem e replique as ofertas com o seu link. <span className="badge badge-ok">Monitor ativo</span></p>
      <div className="card" style={{ maxWidth: 720 }}>
        <label className="lbl">Grupo de origem (JID — manual)</label>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="1203...@g.us" />
        <p className="hint">Cole o JID do grupo de onde copiar. Seu número conectado precisa ser membro dele.</p>
        <label className="lbl" style={{ marginTop: 12 }}>Seus grupos destino (para onde enviar)</label>
        {groups.map((g) => (
          <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id)} /> {g.name}
          </label>
        ))}
        <textarea className="input" rows={2} style={{ marginTop: 8 }} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="JIDs extras, um por linha (opcional)" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={keepCoupons} onChange={(e) => setKeepCoupons(e.target.checked)} /> Manter cupons da origem
        </label>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={save}>Salvar configuração</button>
        <p className="hint" style={{ marginTop: 8 }}>O número conectado precisa ser membro do grupo de origem. O worker recarrega a config em até 60s. Só replica mensagens novas com link de loja que você configurou.</p>
      </div>
    </>
  );
}
