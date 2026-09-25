'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

interface Stats {
  totalPosts?: number; plan?: string; memberSince?: string; verified?: boolean; email?: string; name?: string;
}

export default function Dados() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((d) => { setStats(d); setName(d.name || ''); }).catch(() => {});
  }, []);

  async function saveName() {
    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then((x) => x.json());
    setMsg(r.ok ? '✅ Nome salvo!' : `❌ ${r.error}`);
  }

  async function changePw() {
    if (pw1 !== pw2) { setMsg('❌ As senhas não conferem'); return; }
    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw1 }) }).then((x) => x.json());
    if (r.ok) { setMsg('✅ Senha alterada!'); setPw1(''); setPw2(''); }
    else setMsg(`❌ ${r.error}`);
  }

  async function del() {
    if (!confirm('Apagar permanentemente sua conta e todos os dados?')) return;
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    await fetch('/api/profile', { method: 'DELETE' });
    signOut({ callbackUrl: '/' });
  }

  const memberSince = stats?.memberSince ? new Date(stats.memberSince).toLocaleDateString('pt-BR') : '...';

  return (
    <>
      <a className="back" href="/dashboard">← Voltar para o Dashboard</a>
      <div style={{ maxWidth: 640 }}>
        <div className="card account-hero">
          <div className="avatar" style={{ width: 46, height: 46, fontSize: 20 }}>👤</div>
          <div><h3 style={{ fontSize: 18 }}>Minha Conta</h3><p className="hint" style={{ margin: 0 }}>{stats?.email || '...'}</p></div>
        </div>

        <div className="grid grid-3" style={{ marginTop: 10 }}>
          <div className="card"><small className="hint">📄 Postagens</small><div className="price">{stats?.totalPosts ?? '...'}</div><div className="progress"><div style={{ width: '100%' }} /></div></div>
          <div className="card"><small className="hint">⭐ Plano Atual</small><div className="price" style={{ textTransform: 'capitalize' }}>{stats?.plan || '...'}</div></div>
          <div className="card"><small className="hint">📅 Membro desde</small><div className="price" style={{ fontSize: 20 }}>{memberSince}</div></div>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <h3>🟢 Detalhes da Conta</h3>
          <div className="row"><div><small className="hint">EMAIL</small><br /><b>{stats?.email}</b></div></div>
          <div className="row"><div><small className="hint">STATUS DA CONTA</small><br /><b>Ativa</b></div><span className={`badge ${stats?.verified ? 'badge-ok' : 'badge-warn'}`}>{stats?.verified ? '● Verificada' : '○ Não verificada'}</span></div>
          <div className="row"><div style={{ flex: 1 }}><small className="hint">NOME</small><input className="input" style={{ margin: '4px 0 0' }} value={name} onChange={(e) => setName(e.target.value)} /></div><button className="btn btn-ghost btn-sm" onClick={saveName}>Salvar</button></div>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <h3>🔒 Alterar Senha</h3>
          <label className="lbl">🔑 Nova Senha</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show1 ? 'text' : 'password'} value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Digite sua nova senha" style={{ paddingRight: 40 }} />
            <button onClick={() => setShow1(!show1)} style={{ position: 'absolute', right: 8, top: 9, background: 'none', border: 0, cursor: 'pointer', fontSize: 16 }}>👁</button>
          </div>
          <p className="hint">○ Mínimo de 6 caracteres</p>
          <label className="lbl">🔑 Confirmar Nova Senha</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show2 ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirme sua nova senha" style={{ paddingRight: 40 }} />
            <button onClick={() => setShow2(!show2)} style={{ position: 'absolute', right: 8, top: 9, background: 'none', border: 0, cursor: 'pointer', fontSize: 16 }}>👁</button>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={changePw}>🔒 Alterar Senha</button>
          {msg && <p>{msg}</p>}
        </div>

        <div className="card danger" style={{ marginTop: 10 }}>
          <h3>🛑 Excluir Conta</h3>
          <p className="hint">Apaga permanentemente sua conta e todos os dados associados: instâncias de WhatsApp, bots de Telegram, agendamentos, biolinks, credenciais de afiliado, imagens e histórico. Assinaturas recorrentes são canceladas. Esta ação não pode ser desfeita.</p>
          <button className="btn btn-sm" style={{ background: '#3d1414', color: '#fca5a5', border: '1px solid #6e2222' }} onClick={del}>Excluir permanentemente</button>
        </div>
      </div>
    </>
  );
}
