'use client';
import { useEffect, useState } from 'react';

const STORES = [
  { id: 'shopee', name: 'Shopee', desc: 'Suas credenciais da API de afiliados.', field: 'ID de afiliado Shopee (af_id)' },
  { id: 'amazon', name: 'Amazon', desc: 'Sua conta de afiliado via Creators API.', field: 'Tag de afiliado (tag)' },
  { id: 'magalu', name: 'Magalu', desc: 'O identificador da sua vitrine de afiliado.', field: 'ID da vitrine' },
  { id: 'mercadolivre', name: 'Mercado Livre', desc: 'Seu cookie para gerar links com sua tag.', field: 'Tag de afiliado' },
  { id: 'shein', name: 'SHEIN', desc: 'Seu identificador de afiliado SHEIN.', field: 'ID de afiliado' },
];

export default function Robo() {
  const [status, setStatus] = useState<{ connected?: boolean; phone?: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [tg, setTg] = useState('');
  const [tplStore, setTplStore] = useState('shopee');
  const [tplText, setTplText] = useState('');
  const [tplMap, setTplMap] = useState<Record<string, string>>({});
  const [cpStore, setCpStore] = useState('shopee');
  const [cpText, setCpText] = useState('');
  const [cpMap, setCpMap] = useState<Record<string, string>>({});
  const [hooks, setHooks] = useState('');

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
      else if (it.provider === 'templates') { const m = (it.config || {}) as Record<string, string>; setTplMap(m); setTplText(m[tplStore] || ''); }
      else if (it.provider === 'cupons') { const m = (it.config || {}) as Record<string, string>; setCpMap(m); setCpText(m[cpStore] || ''); }
      else if (it.provider === 'ganchos') setHooks(((it.config?.items as string[]) || []).join('\n'));
      else map[it.provider] = (it.config?.affiliateId as string) || '';
    }
    setForms(map);
  }

  useEffect(() => { load(); }, []);

  async function save(provider: string, config: Record<string, unknown>) {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, config }) });
    setSaved(provider);
    setTimeout(() => setSaved(null), 2500);
  }

  async function saveTpl() {
    const m = { ...tplMap, [tplStore]: tplText };
    setTplMap(m);
    await save('templates', m);
  }

  async function saveCp() {
    const m = { ...cpMap, [cpStore]: cpText };
    setCpMap(m);
    await save('cupons', m);
  }

  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● SEU ESPAÇO DE TRABALHO</div>
      <h1 className="h1">Configurações</h1>
      <p className="sub">Conecte suas contas e deixe suas ofertas com a sua identidade.</p>

      <div className="step">
        <div className="step-num">01<b>Canais de envio</b><span className="hint">O caminho entre suas ofertas e o seu público.</span></div>
        <div className="step-cards">
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>💬</span> Grupos de ofertas</div>
            <h3>WhatsApp</h3>
            <p>{status?.connected ? `Conectado (${status.phone || ''})` : 'Conecte seu número para compartilhar ofertas nos seus grupos.'}</p>
            {!status?.connected && qr && <div className="qr-box"><img src={qr} alt="QR WhatsApp" /></div>}
            <div className="chan-foot"><button onClick={load}>{status?.connected ? 'Conexão ativa ✓' : 'Gerenciar conexão ↻'}</button><a href="/dashboard/postagens">↗</a></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12294d' }}>✈️</span> Grupos e canais</div>
            <h3>Telegram</h3>
            <p>Configure seu bot para enviar ofertas aos seus grupos e canais.</p>
            <input className="input" value={tg} onChange={(e) => setTg(e.target.value)} placeholder="Token do bot (BotFather)" />
            <div className="chan-foot"><button onClick={() => save('telegram', { botToken: tg })}>{saved === 'telegram' ? 'Salvo ✓' : 'Configurar bot'}</button><span>↗</span></div>
          </div>
        </div>
      </div>

      <div className="step">
        <div className="step-num">02<b>Lojas e afiliação</b><span className="hint">Suas credenciais e links de afiliado, reunidos aqui.</span></div>
        <div className="step-cards">
          {STORES.map((s) => (
            <div className="chan" key={s.id}>
              <div className="chan-top"><span className="store-logo">{s.name}</span></div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <input className="input" value={forms[s.id] || ''} onChange={(e) => setForms({ ...forms, [s.id]: e.target.value })} placeholder={s.field} />
              <div className="chan-foot"><button onClick={() => save(s.id, { affiliateId: forms[s.id] || '' })}>{saved === s.id ? 'Salvo ✓' : 'Configurar'}</button><span>↗</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="step">
        <div className="step-num">03<b>Do seu jeito</b><span className="hint">Os detalhes que tornam cada postagem sua.</span></div>
        <div className="step-cards">
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12294d' }}>💬</span></div>
            <h3>Mensagens personalizadas</h3>
            <p>Defina o formato e o tom das suas postagens. Use {'{titulo} {preco} {link} {cupom}'}.</p>
            <select className="input" value={tplStore} onChange={(e) => { setTplStore(e.target.value); setTplText(tplMap[e.target.value] || ''); }}>
              {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <textarea className="input" rows={3} value={tplText} onChange={(e) => setTplText(e.target.value)} placeholder={'🔥 {titulo}\n✅ Por: {preco}\n👉 {link}'} />
            <div className="chan-foot"><button onClick={() => saveTpl()}>{saved === 'templates' ? 'Salvo ✓' : 'Salvar modelo'}</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#12332a' }}>🎟️</span></div>
            <h3>Cupons</h3>
            <p>Adicione os cupons de cada loja às suas ofertas.</p>
            <select className="input" value={cpStore} onChange={(e) => { setCpStore(e.target.value); setCpText(cpMap[e.target.value] || ''); }}>
              {STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="input" value={cpText} onChange={(e) => setCpText(e.target.value)} placeholder="Ex: ACHADINHO10" />
            <div className="chan-foot"><button onClick={() => saveCp()}>{saved === 'cupons' ? 'Salvo ✓' : 'Salvar cupom'}</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#3a2a10' }}>📢</span></div>
            <h3>Ganchos personalizados</h3>
            <p>Crie chamadas que dão destaque às suas ofertas (uma por linha).</p>
            <textarea className="input" rows={3} value={hooks} onChange={(e) => setHooks(e.target.value)} placeholder={'🔥 IMPERDÍVEL\n⚡ Só hoje'} />
            <div className="chan-foot"><button onClick={() => save('ganchos', { items: hooks.split('\n').map((x) => x.trim()).filter(Boolean) })}>{saved === 'ganchos' ? 'Salvos ✓' : 'Salvar ganchos'}</button><span>›</span></div>
          </div>
          <div className="chan">
            <div className="chan-top"><span className="chan-ico" style={{ background: '#2a1a3d' }}>📅</span></div>
            <h3>Agendamentos WhatsApp</h3>
            <p>Organize as próximas publicações nos seus grupos.</p>
            <div className="chan-foot"><a href="/dashboard/postagens">Abrir agendamentos</a><span>›</span></div>
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
    </>
  );
}
