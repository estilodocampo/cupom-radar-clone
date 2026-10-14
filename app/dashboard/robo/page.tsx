'use client';
import { useEffect, useState } from 'react';

const STORES = [
  { id: 'shopee', name: 'Shopee', desc: 'API de afiliados.', field: 'af_id' },
  { id: 'amazon', name: 'Amazon', desc: 'Creators API.', field: 'tag' },
  { id: 'magalu', name: 'Magalu', desc: 'ID da vitrine.', field: 'ID da vitrine' },
  { id: 'mercadolivre', name: 'Mercado Livre', desc: 'Tag de afiliado.', field: 'Tag' },
  { id: 'shein', name: 'SHEIN', desc: 'ID de afiliado.', field: 'ID' },
];

type Modal = null | { type: 'whatsapp'; slot: 'wa1' | 'wa2' } | { type: 'store'; store: string } | { type: 'template' } | { type: 'coupon' } | { type: 'hooks' };

type WaState = { connected?: boolean; phone?: string; qr?: string | null; qrError?: string };

export default function Robo() {
  const [wa, setWa] = useState<Record<'wa1' | 'wa2', WaState>>({ wa1: {}, wa2: {} });
  const [plan, setPlan] = useState('');
  const [forms, setForms] = useState<Record<string, string>>({});
  const [tplStore, setTplStore] = useState('shopee');
  const [tplText, setTplText] = useState('');
  const [tplMap, setTplMap] = useState<Record<string, string>>({});
  const [cpStore, setCpStore] = useState('shopee');
  const [cpText, setCpText] = useState('');
  const [cpMap, setCpMap] = useState<Record<string, string>>({});
  const [hooks, setHooks] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [done, setDone] = useState(false);
  const [mlOk, setMlOk] = useState(false);
  const [mlMatt, setMlMatt] = useState('');
  const [shAppId, setShAppId] = useState('');
  const [shSecret, setShSecret] = useState('');
  const [linkDireto, setLinkDireto] = useState(false);

  async function load() {
    const s = await fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null);
    const slots = (s?.slots || {}) as Record<string, { connected?: boolean; phone?: string }>;
    const next: Record<'wa1' | 'wa2', WaState> = { wa1: {}, wa2: {} };
    for (const slot of ['wa1', 'wa2'] as const) {
      const st = slots[slot] || (slot === 'wa1' ? s : null);
      next[slot] = { connected: st?.connected, phone: st?.phone };
      if (st && !st.connected) {
        const q = await fetch(`/api/whatsapp/qr?slot=${slot}`).then((r) => r.json()).catch(() => null);
        next[slot].qr = q?.qr || null;
        if (q?.needUpgrade) next[slot].qrError = q.error;
        else if (q?.error && !q?.qr) next[slot].qrError = q.error;
      }
    }
    setWa(next);
    const st2 = await fetch('/api/stats').then((r) => r.json()).catch(() => null);
    if (st2?.plan) setPlan(st2.plan);
    const integ = await fetch('/api/integrations').then((r) => r.json()).catch(() => null);
    const map: Record<string, string> = {};
    for (const it of integ?.items || []) {
      if (it.provider === 'mercadolivre') { setMlMatt((it.config?.mattTool as string) || ''); map[it.provider] = (it.config?.affiliateId as string) || ''; }
      else if (it.provider === 'mercadolivre_oauth') setMlOk(true);
      else if (it.provider === 'shopee_api') { setShAppId((it.config?.appId as string) || ''); setShSecret((it.config?.secret as string) || ''); }
      else if (it.provider === 'link_prefs') setLinkDireto(!!(it.config as { rawLink?: boolean } | null)?.rawLink);
      else if (it.provider === 'templates') { const m = (it.config || {}) as Record<string, string>; setTplMap(m); setTplText((prev) => prev || m[tplStore] || ''); }
      else if (it.provider === 'cupons') { const m = (it.config || {}) as Record<string, string>; setCpMap(m); setCpText((prev) => prev || m[cpStore] || ''); }
      else if (it.provider === 'ganchos') setHooks(((it.config?.items as string[]) || []).join('\n'));
      else map[it.provider] = (it.config?.affiliateId as string) || '';
    }
    setForms(map);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('ml');
    if (q === 'ok') alert('✅ ML conectada!');
    else if (q === 'negado') alert('❌ ML negada.');
    else if (q === 'erro_token') alert('❌ Falha no token ML.');
    else if (q) alert(`❌ ML: ${q}`);
  }, []);

  async function save(provider: string, config: Record<string, unknown>) {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, config }) });
    setDone(true);
    setTimeout(() => { setDone(false); setModal(null); load(); }, 900);
  }

  const storeCfg = (id: string) => STORES.find((s) => s.id === id)!;

  async function unlink(slot: 'wa1' | 'wa2') {
    if (!confirm(`Desvincular o nº ${slot === 'wa1' ? '1' : '2'}? Vai precisar do QR.`)) return;
    await fetch('/api/whatsapp/unlink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) });
    setModal(null);
    load();
  }

  const waCard = (slot: 'wa1' | 'wa2', n: string, locked: boolean) => (
    <div className="chan">
      <span className="watermark">💬</span>
      <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>💬</span> Grupos de ofertas</div>
      <h3>WhatsApp {n}</h3>
      <p>{locked
        ? 'Plano Master: 2º número.'
        : wa[slot]?.connected ? `Conectado (${wa[slot].phone || ''}) ✓` : 'Conecte para enviar nos grupos.'}</p>
      <div className="chan-foot"><button onClick={() => { if (locked) { window.location.href = '/dashboard/planos'; return; } setModal({ type: 'whatsapp', slot }); load(); }}>{locked ? 'Ver planos' : 'Gerenciar'}</button><a href="/dashboard/postagens">↗</a></div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="h1">Robô</h1>
          <p className="sub">WhatsApp, lojas e formato.</p>
        </div>
        <div className="orbit" style={{ flexShrink: 0 }}><span>☰</span></div>
      </div>

      <div className="step">
        <div className="step-num">01<span className="step-rule" /><b>WhatsApp</b></div>
        <div className="step-cards">
          {waCard('wa1', '1', false)}
          {waCard('wa2', '2', plan !== '' && plan !== 'master')}
        </div>
      </div>

      <div className="step">
        <div className="step-num">02<span className="step-rule" /><b>Lojas</b></div>
        <div className="step-cards">
          {STORES.map((s) => (
            <div className="chan" key={s.id}>
              <div className="chan-top"><span className="store-logo">{s.name}</span></div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div className="chan-foot"><button onClick={() => setModal({ type: 'store', store: s.id })}>{forms[s.id] ? 'Configurado ✓' : 'Configurar'}</button><span>↗</span></div>
            </div>
          ))}
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#22331a' }}>🔗</span> Links</div>
            <h3>Direto do afiliado</h3>
            <p>Sem /r/: sem contagem de cliques. Vale nas próximas ofertas.</p>
            <div className="chan-foot">
              <button className="switch" aria-checked={linkDireto} onClick={async () => { const v = !linkDireto; setLinkDireto(v); await save('link_prefs', { rawLink: v }); }}>
                <span className="track" />
                <span>{linkDireto ? 'Ligado' : 'Desligado'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="step">
        <div className="step-num">03<span className="step-rule" /><b>Formato</b></div>
        <div className="step-cards">
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12294d' }}>💬</span></div>
            <h3>Modelo</h3>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'template' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>🎟️</span></div>
            <h3>Cupons</h3>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'coupon' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#3a2a10' }}>📢</span></div>
            <h3>Ganchos</h3>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'hooks' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#2a1a3d' }}>📅</span></div>
            <h3>Fila</h3>
            <div className="chan-foot"><a href="/dashboard/postagens/fila">Abrir</a><span>›</span></div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.type === 'whatsapp' && (
              <>
                <h3>💬 WhatsApp {modal.slot === 'wa2' ? '2' : '1'}</h3>
                <p className="hint">{wa[modal.slot]?.connected ? `Conectado (${wa[modal.slot].phone})` : wa[modal.slot]?.qrError || 'Escaneie o QR:'}</p>
                {!wa[modal.slot]?.connected && wa[modal.slot]?.qr && <div className="qr-box"><img src={wa[modal.slot].qr!} alt="QR" /></div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={load}>Atualizar</button>
                  {wa[modal.slot]?.connected && <button className="btn btn-ghost btn-sm" onClick={() => unlink(modal.slot)}>Desvincular</button>}
                  <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'store' && (
              <>
                <h3><span className="store-logo">{storeCfg(modal.store).name}</span></h3>
                <p className="hint">{storeCfg(modal.store).desc}</p>
                <input className="input" value={forms[modal.store] || ''} onChange={(e) => setForms({ ...forms, [modal.store]: e.target.value })} placeholder={storeCfg(modal.store).field} />
                {modal.store === 'mercadolivre' && (
                  <>
                    <label className="lbl">Matt Tool ID</label>
                    <input className="input" value={mlMatt} onChange={(e) => setMlMatt(e.target.value)} placeholder="Ex: 78793736" />
                    <p className="hint">Copie o <b>matt_tool</b> do Gerador de links ML.</p>
                  </>
                )}
                {modal.store === 'shopee' && (
                  <>
                    <label className="lbl">App ID da API de afiliado</label>
                    <input className="input" value={shAppId} onChange={(e) => setShAppId(e.target.value)} placeholder="App ID" />
                    <label className="lbl">Secret da API</label>
                    <input className="input" value={shSecret} onChange={(e) => setShSecret(e.target.value)} placeholder="Secret" type="password" />
                    <p className="hint">Gera links shope.ee comissionáveis.</p>
                  </>
                )}
                {modal.store === 'mercadolivre' && (
                  <p className="hint">ML: {mlOk ? 'conectada ✓' : 'desconectada'} — <a href="/api/integrations/mercadolivre/auth">Conectar</a></p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    const cfg: Record<string, string> = { affiliateId: forms[modal.store] || '' };
                    if (modal.store === 'mercadolivre' && mlMatt) cfg.mattTool = mlMatt;
                    await save(modal.store, cfg);
                    if (modal.store === 'shopee' && shAppId && shSecret) await save('shopee_api', { appId: shAppId, secret: shSecret });
                  }}>{done ? 'Salvo ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'template' && (
              <>
                <h3>💬 Modelo</h3>
                <p className="hint">{'{titulo} {preco} {link} {link2} {cupom}'}</p>
                <select className="input" value={tplStore} onChange={(e) => { setTplStore(e.target.value); setTplText(tplMap[e.target.value] || ''); }}>
                  {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <textarea className="input" rows={4} value={tplText} onChange={(e) => setTplText(e.target.value)} placeholder={'🔥 {titulo}\n✅ Por: {preco}\n👉 {link}'} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={async () => { const m = { ...tplMap, [tplStore]: tplText }; setTplMap(m); await save('templates', m); }}>{done ? 'Salvo ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'coupon' && (
              <>
                <h3>🎟️ Cupom</h3>
                <select className="input" value={cpStore} onChange={(e) => { setCpStore(e.target.value); setCpText(cpMap[e.target.value] || ''); }}>
                  {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="input" value={cpText} onChange={(e) => setCpText(e.target.value)} placeholder="Ex: ACHADINHO10" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={async () => { const m = { ...cpMap, [cpStore]: cpText }; setCpMap(m); await save('cupons', m); }}>{done ? 'Salvo ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'hooks' && (
              <>
                <h3>📢 Ganchos (um por linha)</h3>
                <textarea className="input" rows={4} value={hooks} onChange={(e) => setHooks(e.target.value)} placeholder={'🔥 IMPERDÍVEL\n⚡ Só hoje'} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => save('ganchos', { items: hooks.split('\n').map((x) => x.trim()).filter(Boolean) })}>{done ? 'Salvos ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
