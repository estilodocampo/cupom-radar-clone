const TOOLS = [
  { name: 'Bio Link Pro', desc: 'Sua vitrine de ofertas em um link.', tag: null as string | null },
  { name: 'Rotacionador', desc: 'Alterne links e evite bloqueios.', tag: 'NOVO' },
  { name: 'Aulas', desc: 'Aprenda a encher grupos e vender mais.', tag: null as string | null },
];

export default function Ferramentas() {
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● FERRAMENTAS</div>
      <h1 className="h1">Ferramentas</h1>
      <p className="sub">Recursos extras da sua operação.</p>
      <div className="grid grid-3">
        {TOOLS.map((t) => (
          <div className="card" key={t.name}>
            <h3>{t.name} {t.tag && <span className="badge badge-ok">{t.tag}</span>}</h3>
            <p className="hint">{t.desc}</p>
            <button className="btn btn-ghost btn-sm" disabled>Em breve</button>
          </div>
        ))}
      </div>
    </>
  );
}
