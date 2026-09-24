'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  return (
    <main style={{ maxWidth: 420, margin: '60px auto', padding: 24 }}>
      <h1>Entrar</h1>
      <p>Acesso com email (demo) ou Google, quando configurado.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" type="email" style={{ width: '100%', padding: 10, marginBottom: 10 }} />
      <button onClick={() => signIn('credentials', { email, callbackUrl: '/dashboard' })} style={{ width: '100%', padding: 12, background: '#22c55e', border: 0, borderRadius: 8, marginBottom: 10 }}>
        Entrar com Email
      </button>
      <button onClick={() => signIn('google', { callbackUrl: '/dashboard' })} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}>
        Continuar com Google
      </button>
    </main>
  );
}
