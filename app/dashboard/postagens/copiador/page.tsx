'use client';
import { useEffect, useState } from 'react';

export default function Copiador() {
  const [source, setSource] = useState('');
  const [keepCoupons, setKeepCoupons] = useState(false);
  const [hub, setHub] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/integrations').then((r) => r.json()).catch(() => null),
      fetch('/api/whatsapp/groups').then((r) => r.json()).catch(() => null),
    ]).then(([d, g]) => {
      const items = d?.items || [];
      const cop = items.find((x: { provider: string }) => x.provider === 'copiador');
      setSource((cop?.config?.source as string) || '');
      setKeepCoupons(!!(cop?.config?.keepCoupons as boolean));
      const dist = items.find((x: { provider: string }) => x.provider === 'distribuidor');
      const hubId = (dist?.config?.hub as string) || '';
      setHub(hubId);
      const nome = ((g?.groups || []) as { id: string; name: string }[]).find((x) => x.id === hubId)?.name;
      if (hubId) setMsg(`Enviando para o seu grupo: ${nome || hubId}`);
    }).catch(() => {});
  }, []);

  async function save() {
    if (!source) { setMsg('❌ Cole o JID do grupo de origem.'); return; }
    if (!hub) { setMsg('❌ Configure antes o Distribuidor (ele define o seu grupo de destino).'); return; }
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'copiador', config: { source, keepCoupons } }),
    });
    setMsg('✅ Copiador salvo! As ofertas da origem chegam convertidas no seu grupo.');
  }

  return (
    <>
      <a className="back" href="/dashboard/postagens">← Postagens</a>
      <div className="eyebrow">● MODO COPIADOR</div>
      <h1 className="h1">Modo Copiador</h1>
      <p className="sub">Traz as ofertas do grupo de origem para o seu grupo, já com o seu link.</p>
      {msg && <p>{msg}</p>}

      <div className="card" style={{ maxWidth: 720 }}>
        <label className="lbl">Grupo de origem (JID)</label>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="1203...@g.us" />
        <p className="hint">Cole o JID do grupo de onde copiar. Seu número conectado precisa ser membro dele.</p>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input type="checkbox" checked={keepCoupons} onChange={(e) => setKeepCoupons(e.target.checked)} /> Manter cupons da origem
        </label>

        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={save}>Salvar</button>

        <p className="hint" style={{ marginTop: 12 }}>
          O destino e o ritmo de envio ficam no <a href="/dashboard/postagens/distribuidor">Distribuidor</a>
          {' '}— é lá que você escolhe quais grupos recebem e com que frequência.
          {hub ? '' : ' <b>Atenção:</b> nenhum Distribuidor configurado ainda, então o Copiador está sem destino.'}
        </p>
      </div>
    </>
  );
}
