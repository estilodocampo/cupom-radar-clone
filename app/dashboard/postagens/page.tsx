const MODES = [
  { href: '/dashboard/postagens/produtos', icon: '📦', name: 'Produtos', desc: 'Gere ofertas a partir do link, com seu ID de afiliado.' },
  { href: '/dashboard/postagens/fila', icon: '📋', name: 'Modo Fila', desc: 'Ofertas enviadas em sequência, no piloto automático.' },
  { href: '/dashboard/postagens/lista', icon: '📝', name: 'Modo Lista', desc: 'Listas fixas de grupos para disparo rápido.', badge: 'NOVO' },
  { href: '/dashboard/postagens/copiador', icon: '📑', name: 'Modo Copiador', desc: 'Replique ofertas convertendo para o seu link.' },
];

export default function PostagensHub() {
  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div className="eyebrow">● POSTAGENS</div>
      <h1 className="h1">Postagens</h1>
      <p className="sub">Escolha o modo de divulgação.</p>
      <div className="grid grid-3">
        {MODES.map((m) => (
          <div className="card" key={m.href}>
            <div className="feat">{m.icon}</div>
            <h3>{m.name} {m.badge && <span className="badge badge-ok">{m.badge}</span>}</h3>
            <p className="hint">{m.desc}</p>
            <a className="btn btn-primary btn-sm" href={m.href}>Abrir</a>
          </div>
        ))}
      </div>
    </>
  );
}
