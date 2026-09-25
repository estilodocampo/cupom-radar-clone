'use client';
import { useEffect, useState } from 'react';

export default function Lista() {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/whatsapp/groups').then((r) => r.json()).then((d) => setGroups(d.groups || [])).catch(() => {});
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'lista_envio');
      setSel((it?.config?.groupJids as string[]) || []);
    }).catch(() => {});
  }, []);

  function toggle(id: string) {
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  }

  async function save() {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'lista_envio', config: { groupJids: sel } }) });
    alert('Lista salva!');
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO LISTA <span className="badge badge-ok">NOVO</span></div>
      <h1 className="h1">Modo Lista</h1>
      <p className="sub">Monte sua lista fixa de grupos para disparo rápido.</p>
      <div className="card" style={{ maxWidth: 720 }}>
        {groups.length === 0 ? <p className="hint">Conecte o WhatsApp no Config Robô para listar os grupos.</p> : (
          <ul className="list">{groups.map((g) => (
            <li key={g.id}><label><input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggle(g.id)} /> <b>{g.name}</b></label></li>
          ))}</ul>
        )}
        <button className="btn btn-primary btn-sm" onClick={save}>Salvar lista ({sel.length})</button>
      </div>
    </>
  );
}
