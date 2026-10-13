const FAQS = [
  { q: 'Conectar o WhatsApp?', a: 'Robô → WhatsApp, escaneie o QR. Use número secundário.' },
  { q: 'Link de afiliado?', a: 'Cadastre o ID em Robô → Lojas e gere em Criar oferta.' },
  { q: 'Agendamento?', a: 'Em Criar oferta, preencha data/hora e Agendar.' },
  { q: 'Cancelar?', a: 'Sim. Anuais têm 7 dias de garantia.' },
];

export default function Ajuda() {
  return (
    <>
      <h1 className="h1">Ajuda</h1>
      <div className="grid" style={{ maxWidth: 720 }}>
        {FAQS.map((f) => (
          <div className="card" key={f.q}><h3>{f.q}</h3><p className="hint">{f.a}</p></div>
        ))}
        <div className="card"><h3>💭 Sugestão?</h3><p className="hint"><a href="/dashboard/config/feedback">Enviar feedback →</a></p></div>
      </div>
    </>
  );
}
