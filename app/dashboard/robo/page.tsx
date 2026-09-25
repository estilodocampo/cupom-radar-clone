'use client';
import { useEffect, useState } from 'react';

const STORES = [
  { id: 'shopee', name: 'Shopee', desc: 'Suas credenciais da API de afiliados.', field: 'ID de afiliado Shopee (af_id)' },
  { id: 'amazon', name: 'Amazon', desc: 'Sua conta de afiliado via Creators API.', field: 'Tag de afiliado (tag)' },
  { id: 'magalu', name: 'Magalu', desc: 'O identificador da sua vitrine de afiliado.', field: 'ID da vitrine' },
  { id: 'mercadolivre', name: 'Mercado Livre', desc: 'Seu cookie para gerar links com sua tag.', field: 'Tag de afiliado' },
  { id: 'shein', name: 'SHEIN', desc: 'Seu identificador de afiliado SHEIN.', field: 'ID de afiliado' },
];

type Modal = null | { type: 'whatsapp' } | { type: 'telegram' } | { type: 'store'; store: string } | { type: 'template' } | { type: 'coupon' } | { type: 'hooks' };

export default function Robo() {
  const [status, setStatus] = useState<{ connected?: boolean; phone?: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [tg, setTg] = useState('');
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

  async function load() {
    const s = await fetch('/api/whatsapp/status').then((r) => r.json()).catch(() => null);
    setStatus(s);
    if (s && !s.connected) {
      const q = await fetch('/api/whatsapp/qr').then((r) => r.json()).catch(() => null);
      setQr(q?.qr || null);
    } else setQr(null);
    const integ = await fetch('/api/integrations').then((r) => r.json()).catch(() => null);
    const map: Record<string, string> = {};
    for (const it of integ?.items || []) {
      if (it.provider === 'telegram') setTg((it.config?.botToken as string) || '');
      else if (it.provider === 'mercadolivre_oauth') setMlOk(true);
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
    if (q === 'ok') alert('✅ Conta Mercado Livre conectada!');
    else if (q === 'negado') alert('❌ Autorização negada no Mercado Livre.');
    else if (q === 'erro_token') alert('❌ ML aprovou, mas a troca do token falhou (confira APP ID/Secret e URI de redirect).');
    else if (q) alert(`❌ Falha na conexão ML (${q}). Tente de novo.`);
  }, []);

  async function save(provider: string, config: Record<string, unknown>) {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, config }) });
    setDone(true);
    setTimeout(() => { setDone(false); setModal(null); load(); }, 900);
  }

  const storeCfg = (id: string) => STORES.find((s) => s.id === id)!;

  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="eyebrow">● SEU ESPAÇO DE TRABALHO</div>
          <h1 className="h1">Configurações</h1>
          <p className="sub">Conecte suas contas e deixe suas ofertas com a sua identidade.</p>
        </div>
        <div className="orbit" style={{ flexShrink: 0 }}><span>☰</span></div>
      </div>

      <div className="step">
        <div className="step-num">01<span className="step-rule" /><b>Canais de envio</b>O caminho entre suas ofertas e o seu público.<span className="step-cap">💬 Conecte suas conversas</span></div>
        <div className="step-cards">
          <div className="chan">
            <span className="watermark">💬</span>
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>💬</span> Grupos de ofertas</div>
            <h3>WhatsApp</h3>
            <p>{status?.connected ? `Conectado (${status.phone || ''}) ✓` : 'Conecte seu número para compartilhar ofertas nos seus grupos.'}</p>
            <div className="chan-foot"><button onClick={() => { setModal({ type: 'whatsapp' }); load(); }}>Gerenciar conexão</button><a href="/dashboard/postagens">↗</a></div>
          </div>
          <div className="chan">
            <span className="watermark">✈️</span>
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12294d' }}>✈️</span> Grupos e canais</div>
            <h3>Telegram</h3>
            <p>{tg ? 'Bot configurado ✓' : 'Configure seu bot para enviar ofertas aos seus grupos e canais.'}</p>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'telegram' })}>Configurar bot</button><span>↗</span></div>
          </div>
        </div>
      </div>

      <div className="step">
        <div className="step-num">02<span className="step-rule" /><b>Lojas e afiliação</b>Suas credenciais e links de afiliado, reunidos aqui.<span className="step-cap">🏬 Conecte suas lojas</span></div>
        <div className="step-cards">
          {STORES.map((s) => (
            <div className="chan" key={s.id}>
              <div className="chan-top"><span className="store-logo">{s.name}</span></div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div className="chan-foot"><button onClick={() => setModal({ type: 'store', store: s.id })}>{forms[s.id] ? 'Configurado ✓' : 'Configurar'}</button><span>↗</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step-num">03<span className="step-rule" /><b>Do seu jeito</b>Os detalhes que tornam cada postagem sua.<span className="step-cap">✨ Personalize suas ofertas</span></div>
        <div className="step-cards">
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12294d' }}>💬</span></div>
            <h3>Mensagens personalizadas</h3>
            <p>Defina o formato e o tom das suas postagens.</p>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'template' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>🎟️</span></div>
            <h3>Cupons</h3>
            <p>Adicione os cupons de cada loja às suas ofertas.</p>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'coupon' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#3a2a10' }}>📢</span></div>
            <h3>Ganchos personalizados</h3>
            <p>Crie chamadas que dão destaque às suas ofertas.</p>
            <div className="chan-foot"><button onClick={() => setModal({ type: 'hooks' })}>Configurar</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#2a1a3d' }}>📅</span></div>
            <h3>Agendamentos WhatsApp</h3>
            <p>Organize as próximas publicações nos seus grupos.</p>
            <div className="chan-foot"><a href="/dashboard/postagens">Abrir</a><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#3d1a2e' }}>🖼️</span></div>
            <h3>Templates de stories</h3>
            <p>Escolha os modelos e as cores dos seus stories.</p>
            <div className="chan-foot"><button disabled style={{ opacity: .5 }}>Em breve</button><span>›</span></div>
          </div>
        </div>
      </div>

      <p className="hint" style={{ marginTop: 8 }}>Precisa de uma mão para configurar? <a href="/dashboard/config/ajuda">Acessar a Central de Ajuda ↗</a></p>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.type === 'whatsapp' && (
              <>
                <h3>💬 Conectar WhatsApp</h3>
                <p className="hint">{status?.connected ? `Conectado (${status.phone})` : 'Escaneie o QR com o celular:'}</p>
                {!status?.connected && qr && <div className="qr-box"><img src={qr} alt="QR WhatsApp" /></div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" onClick={load}>Atualizar QR</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'telegram' && (
              <>
                <h3>✈️ Bot do Telegram</h3>
                <p className="hint">Cole o token criado no BotFather.</p>
                <input className="input" value={tg} onChange={(e) => setTg(e.target.value)} placeholder="Token do bot (BotFather)" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => save('telegram', { botToken: tg })}>{done ? 'Salvo ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'store' && (
              <>
                <h3><span className="store-logo">{storeCfg(modal.store).name}</span></h3>
                <p className="hint">{storeCfg(modal.store).desc}</p>
                <input className="input" value={forms[modal.store] || ''} onChange={(e) => setForms({ ...forms, [modal.store]: e.target.value })} placeholder={storeCfg(modal.store).field} />
                {modal.store === 'mercadolivre' && (
                  <p className="hint">Conta ML: {mlOk ? 'conectada ✓' : 'não conectada'} — <a href="/api/integrations/mercadolivre/auth">Conectar conta</a> (exige APP ID e Secret cadastrados no servidor)</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => save(modal.store, { affiliateId: forms[modal.store] || '' })}>{done ? 'Salvo ✓' : 'Salvar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button>
                </div>
              </>
            )}
            {modal.type === 'template' && (
              <>
                <h3>💬 Mensagem personalizada</h3>
                <p className="hint">Use {'{titulo} {preco} {link} {cupom}'}.</p>
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
                <h3>🎟️ Cupom da loja</h3>
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
