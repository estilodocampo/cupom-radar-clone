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
      else map[it.provider] = (it.config?.affiliateId as string) || '';
    }
    setForms(map);
  }

  useEffect(() => { load(); }, []);

  async function save(provider: string, config: Record<string, string>) {
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, config }) });
    setSaved(provider);
    setTimeout(() => setSaved(null), 2500);
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
    </>
  );
}
