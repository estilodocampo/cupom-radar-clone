'use client';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string; total: number | null; admins: number | null; canSend: boolean; inUse?: boolean };

export default function Envio() {
  const [connected, setConnected] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupJid, setGroupJid] = useState('');
  const [autoNovo, setAutoNovo] = useState(true);
  const [linkMode, setLinkMode] = useState('site');
  const [msg, setMsg] = useState('');

  async function loadGroups() {
    const s = await fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null);
    setConnected(Boolean(s?.connected));
    const g = await fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null);
    setGroups(g?.groups || []);
  }

  useEffect(() => {
    loadGroups();
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'envio_auto');
      if (it?.config) {
        const c = it.config as { groupJid?: string; autoNovo?: boolean; linkMode?: string };
        if (c.groupJid) setGroupJid(c.groupJid);
        if (typeof c.autoNovo === 'boolean') setAutoNovo(c.autoNovo);
        if (c.linkMode) setLinkMode(c.linkMode);
      }
    }).catch(() => {});
  }, []);

  async function save() {
    const r = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'envio_auto', config: { groupJid, autoNovo, linkMode } }) }).then((x) => x.json());
    setMsg(r.ok ?? r.item ? '✅ Salvo!' : `❌ ${r.error || 'Falha ao salvar'}`);
  }

  async function sendTest() {
    if (!groupJid) { setMsg('❌ Selecione o grupo'); return; }
    setMsg('Enviando teste...');
    const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: groupJid, text: '✅ Teste do Cupom Radar: envio automático funcionando!' }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Teste enviado!' : `❌ ${r.error}`);
  }

  async function unlink() {
    if (!confirm('Desvincular o WhatsApp? Será preciso escanear o QR de novo.')) return;
    const r = await fetch('/api/whatsapp/unlink', { method: 'POST' }).then((x) => x.json());
    setMsg(r.ok ? '✅ Desvinculado' : `❌ ${r.error}`);
    loadGroups();
  }

  const podeEnviar = groups.filter((g) => g.canSend);
  const semPermissao = groups.filter((g) => !g.canSend);

  return (
    <>
      <div className="topbar">
        <h1 className="h1" style={{ margin: 0 }}>WhatsApp</h1>
        <span className={`badge ${connected ? 'badge-ok' : 'badge-warn'}`}>{connected ? '● conectado' : '▲ desconectado'}</span>
      </div>

      <div className="card">
        <h3>👥 Meus grupos</h3>
        <p className="hint">Grupos em que o número conectado pode enviar. Ao entrar num grupo novo, ele aparece aqui — use “Recarregar grupos”.</p>
        {groups.length === 0 ? (
          <p className="hint" style={{ marginTop: 8 }}>{connected ? 'Nenhum grupo encontrado.' : 'Conecte o WhatsApp no Config Robô para listar os grupos.'}</p>
        ) : (
          <div className="glist" style={{ marginTop: 10 }}>
            {podeEnviar.map((g) => (
              <button
                type="button"
                key={g.id}
                className={`gitem${groupJid === g.id ? ' sel' : ''}${g.inUse ? ' inuse' : ''}`}
                onClick={() => setGroupJid(g.id)}
              >
                <span className="gname">{g.name || g.id}</span>
                <span className="gmeta">
                  {g.total !== null && `${g.total} membros`}
                  {g.inUse && <span className="gtag">em uso</span>}
                </span>
              </button>
            ))}
            {semPermissao.length > 0 && (
              <p className="hint" style={{ marginTop: 8 }}>
                {semPermissao.length} grupo(s) onde você não é admin e não consegue enviar: {semPermissao.map((g) => g.name).join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 14 }}>
          <div>
            <label className="lbl">Grupo do WhatsApp</label>
            <select className="input" value={groupJid} onChange={(e) => setGroupJid(e.target.value)}>
              <option value="">Selecione...</option>
              {podeEnviar.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <p className="hint">Entre com sua conta em pelo menos um grupo para ele aparecer aqui.</p>
          </div>
          <div>
            <label className="lbl">Envio automático</label>
            <button className="switch" aria-checked={autoNovo} onClick={() => setAutoNovo(!autoNovo)}>
              <span className="track" />
              <span>Enviar produto novo sozinho</span>
            </button>
            <p className="hint">Quando ligado, ofertas geradas disparam sozinhas no grupo.</p>
          </div>
        </div>
        <label className="lbl">Link da mensagem</label>
        <select className="input" value={linkMode} onChange={(e) => setLinkMode(e.target.value)}>
          <option value="site">Link do meu site (cliente vê o anúncio aqui primeiro)</option>
          <option value="original">Link original da plataforma</option>
        </select>
        <p className="hint">No site, após entrar na conta, o cliente vê o botão com o link original da plataforma.</p>
        <div className="btn-row">
          <button className="btn btn-primary btn-sm" onClick={save}>💾 Salvar</button>
          <button className="btn btn-test btn-sm" onClick={sendTest}>🚀 Enviar teste</button>
          <button className="btn btn-test btn-sm" onClick={loadGroups}>↻ Recarregar grupos</button>
          <button className="btn btn-danger btn-sm" onClick={unlink}>🔌 Desvincular</button>
        </div>
        {msg && <p>{msg}</p>}
        {!connected && <p className="hint">⚠️ WhatsApp desconectado — escaneie o QR em <a href="/dashboard/robo">Config Robô</a>.</p>}
      </div>
    </>
  );
}
