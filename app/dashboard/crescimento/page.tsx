export default function Crescimento() {
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● CRESCIMENTO</div>
      <h1 className="h1">Crescimento</h1>
      <p className="sub">Escale sua audiência e seus ganhos.</p>
      <div className="grid grid-3">
        <div className="card"><h3>Analytics de Grupos <span className="badge badge-ok">NOVO</span></h3><p className="hint">Descubra quais grupos mais convertem.</p><button className="btn btn-ghost btn-sm" disabled>Em breve</button></div>
        <div className="card"><h3>Indique e ganhe <span className="badge badge-ok">NOVO</span></h3><p className="hint">Ganhe bônus indicando afiliados.</p><button className="btn btn-ghost btn-sm" disabled>Em breve</button></div>
      </div>
    </>
  );
}
