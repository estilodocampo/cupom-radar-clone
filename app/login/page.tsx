export default function Login() {
  return (
    <main style={{ maxWidth: 420, margin: '60px auto', padding: 24 }}>
      <h1>Entrar</h1>
      <p>Fase 1: auth mock. Fase 2: NextAuth Google + email.</p>
      <form action="/dashboard">
        <input placeholder="Email" type="email" required style={{ width: '100%', padding: 10, marginBottom: 10 }} />
        <input placeholder="Senha" type="password" required style={{ width: '100%', padding: 10, marginBottom: 10 }} />
        <button style={{ width: '100%', padding: 12, background: '#22c55e', border: 0, borderRadius: 8 }}>Entrar</button>
      </form>
      <a href="/dashboard" style={{ color: '#22c55e' }}>Continuar com Google (mock)</a>
    </main>
  );
}
