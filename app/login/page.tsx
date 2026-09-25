'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  return (
    <div className="container">
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 8 }}><span className="brand-badge">📡</span> Cupom Radar</div>
          <h2 style={{ margin: '8px 0' }}>Bem-vindo de volta</h2>
          <p className="hint">Entre para gerar ofertas e automatizar seus grupos.</p>
          <label className="lbl" style={{ textAlign: 'left' }}>Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" type="email" />
          <label className="lbl" style={{ textAlign: 'left' }}>Senha <span className="hint">(mín. 6 caracteres; no 1º acesso ela é criada)</span></label>
          <div style={{ position: 'relative' }}>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" type={show ? 'text' : 'password'} style={{ paddingRight: 40 }} />
            <button onClick={() => setShow(!show)} style={{ position: 'absolute', right: 8, top: 9, background: 'none', border: 0, cursor: 'pointer', fontSize: 16 }}>👁</button>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => signIn('credentials', { email, password, callbackUrl: '/dashboard' })}>
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
