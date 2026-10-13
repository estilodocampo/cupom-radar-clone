const MODES = [
  { href: '/dashboard/postagens/produtos', icon: '✏️', name: 'Criar oferta', desc: 'Link + seu afiliado.' },
  { href: '/dashboard/postagens/copiador', icon: '📑', name: 'Copiador', desc: 'Replica com seu link.' },
  { href: '/dashboard/postagens/distribuidor', icon: '🔀', name: 'Distribuidor', desc: 'Hub → demais grupos.' },
  { href: '/dashboard/postagens/envio', icon: '🚀', name: 'Envio', desc: 'Grupo padrão + teste.' },
  { href: '/dashboard/postagens/fila', icon: '📋', name: 'Fila', desc: 'Disparo em sequência.' },
  { href: '/dashboard/postagens/sorteio', icon: '🎉', name: 'Sorteio', desc: 'Sorteio + boas-vindas.' },
];

export default function PostagensHub() {
  return (
    <>
      <h1 className="h1">Postagens</h1>
      <div className="grid grid-3">
        {MODES.map((m) => (
          <div className="card" key={m.href}>
            <div className="feat">{m.icon}</div>
            <h3>{m.name}</h3>
            <p className="hint">{m.desc}</p>
            <a className="btn btn-primary btn-sm" href={m.href}>Abrir</a>
          </div>
        ))}
      </div>
    </>
  );
}
