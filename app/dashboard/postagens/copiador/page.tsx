'use client';
import { useEffect, useState } from 'react';

export default function Copiador() {
  const [source, setSource] = useState('');
  const [targets, setTargets] = useState('');

  useEffect(() => {
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'copiador');
      setSource((it?.config?.source as string) || '');
      setTargets(((it?.config?.targets as string[]) || []).join('\n'));
    }).catch(() => {});
  }, []);

  async function save() {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'copiador', config: { source, targets: targets.split('\n').map((x) => x.trim()).filter(Boolean) } }) });
    alert('✅ Copiador ativo! Novas ofertas do grupo de origem serão replicadas com seu link.');
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO COPIADOR</div>
      <h1 className="h1">Modo Copiador</h1>
      <p className="sub">Monitore um grupo de origem e replique as ofertas com o seu link. <span className="badge badge-ok">Monitor ativo</span></p>
      <div className="card" style={{ maxWidth: 720 }}>
        <label className="lbl">Grupo de origem (JID)</label>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="1203...@g.us" />
        <label className="lbl">Seus grupos destino (um JID por linha)</label>
        <textarea className="input" rows={4} value={targets} onChange={(e) => setTargets(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={save}>Salvar configuração</button>
      </div>
    </>
  );
}
