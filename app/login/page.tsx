'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  return (
    <div className="container">
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><span className="brand-badge">📡</span> Cupom Radar</div>
          <h2 style={{ margin: '8px 0' }}>Bem-vindo de volta</h2>
          <p className="hint">Entre para gerar ofertas e automatizar seus grupos.</p>
          <label className="lbl" style={{ textAlign: 'left' }}>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" type="email" />
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => signIn('credentials', { email, callbackUrl: '/dashboard' })}>
            Entrar com Email
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
            Continuar com Google
          </button>
        </div>
      </div>
    </div>
  );
}
