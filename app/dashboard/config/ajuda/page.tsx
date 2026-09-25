const FAQS = [
  { q: 'Como conecto meu WhatsApp?', a: 'Vá em Config Robô → WhatsApp e escaneie o QR com o celular. Use um número secundário.' },
  { q: 'Como gero meu link de afiliado?', a: 'Cadastre seu ID em Config Robô → Lojas e gere a oferta em Postagens → Produtos.' },
  { q: 'Como funciona o agendamento?', a: 'Na página de Produtos, preencha data/hora e clique em Agendar. O worker dispara sozinho.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. Planos anuais têm garantia de 7 dias.' },
];

export default function Ajuda() {
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● CONFIGURAÇÕES</div>
      <h1 className="h1">Central de Ajuda</h1>
      <p className="sub">Precisa de uma mão para configurar?</p>
      <div className="grid" style={{ maxWidth: 720 }}>
        {FAQS.map((f) => (
          <div className="card" key={f.q}><h3>{f.q}</h3><p className="hint">{f.a}</p></div>
        ))}
      </div>
    </>
  );
}
