'use client';
import { useEffect, useState } from 'react';
import { SlotPicker, type Slot } from '../SlotPicker';
import Empty from '../../Empty';

type Group = { id: string; name: string; total: number | null; admins: number | null; canSend: boolean; inUse?: boolean };

export default function Envio() {
  const [connected, setConnected] = useState(false);
  const [slot, setSlot] = useState<Slot>('wa1');
  const [phones, setPhones] = useState<Record<string, string | undefined>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupJid, setGroupJid] = useState('');
  const [autoNovo, setAutoNovo] = useState(true);
  const [msg, setMsg] = useState('');

  async function loadGroups(sl: Slot, force = false) {
    const [s, g] = await Promise.all([
      fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null),
      fetch(`/api/whatsapp/groups?slot=${sl}${force ? '&refresh=1' : ''}`).then((r) => r.json()).catch(() => null),
    ]);
    const slots = s?.slots || {};
    setConnected(Boolean(slots[sl]?.connected ?? s?.connected));
    const ph: Record<string, string | undefined> = {};
    for (const k of ['wa1', 'wa2']) if (slots[k]?.phone) ph[k] = slots[k].phone;
    setPhones(ph);
    const list = g?.groups || [];
    setGroups(list);
    setGroupJid((prev) => (list.some((x: Group) => x.id === prev) ? prev : ''));
  }

  useEffect(() => {
    loadGroups(slot);
    fetch('/api/integrations').then((r) => r.json()).then((d) => {
      const it = (d.items || []).find((x: { provider: string }) => x.provider === 'envio_auto');
      if (it?.config) {
        const c = it.config as { groupJid?: string; autoNovo?: boolean; slot?: Slot };
        if (c.slot === 'wa2') { setSlot('wa2'); loadGroups('wa2'); }
        if (c.groupJid) setGroupJid(c.groupJid);
        if (typeof c.autoNovo === 'boolean') setAutoNovo(c.autoNovo);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeSlot(sl: Slot) {
    setSlot(sl);
    loadGroups(sl);
  }

  async function save() {
    const r = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'envio_auto', config: { groupJid, autoNovo, slot } }) }).then((x) => x.json());
    setMsg(r.ok ?? r.item ? '✅ Salvo!' : `❌ ${r.error || 'Falha ao salvar'}`);
  }

  async function sendTest() {
    if (!groupJid) { setMsg('❌ Selecione o grupo'); return; }
    setMsg('Enviando teste...');
    const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: groupJid, text: '✅ Teste OK', slot }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Teste enviado!' : `❌ ${r.error}`);
  }

  async function unlink() {
    if (!confirm('Desvincular? Vai precisar do QR de novo.')) return;
    const r = await fetch('/api/whatsapp/unlink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Desvinculado' : `❌ ${r.error}`);
    loadGroups(slot);
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
        <h3>👥 Grupos</h3>
        <div style={{ marginTop: 8 }}>
          <SlotPicker slot={slot} setSlot={changeSlot} phones={phones} />
        </div>
        {groups.length === 0 ? (
          <div style={{ marginTop: 8 }}>
            <Empty
              icon="👥"
              text={connected ? 'Entre em um grupo com este número primeiro.' : 'Conecte o WhatsApp para ver os grupos.'}
              actionLabel={connected ? undefined : 'Conectar'}
              actionHref={connected ? undefined : '/dashboard/robo'}
            />
          </div>
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
                {semPermissao.length} sem permissão de envio.
              </p>
            )}
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 14 }}>
          <div>
            <label className="lbl">Grupo</label>
            <select className="input" value={groupJid} onChange={(e) => setGroupJid(e.target.value)}>
              <option value="">Selecione...</option>
              {podeEnviar.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Automático</label>
            <button className="switch" aria-checked={autoNovo} onClick={() => setAutoNovo(!autoNovo)}>
              <span className="track" />
              <span>Enviar sozinho</span>
            </button>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary btn-sm" onClick={save}>Salvar</button>
          <button className="btn btn-test btn-sm" onClick={sendTest}>Teste</button>
          <button className="btn btn-test btn-sm" onClick={() => loadGroups(slot, true)}>↻ Grupos</button>
          <button className="btn btn-danger btn-sm" onClick={unlink}>Desvincular</button>
        </div>
        {msg && <p>{msg}</p>}
        {!connected && <p className="hint">⚠️ Desconectado — ver <a href="/dashboard/robo">Robô</a>.</p>}
      </div>
    </>
  );
}
