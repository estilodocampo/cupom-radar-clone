import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Anti-força-bruta: 10 falhas em 10 min por e-mail bloqueiam temporariamente.
// Memória local (zera no deploy); login Google não é afetado.
const loginFails = new Map<string, number[]>();
const LOGIN_MAX = 10;
const LOGIN_WIN = 10 * 60 * 1000;

function loginBloqueado(email: string): boolean {
  const now = Date.now();
  const arr = (loginFails.get(email) || []).filter((t) => now - t < LOGIN_WIN);
  if (loginFails.size > 5000) loginFails.clear();
  else loginFails.set(email, arr);
  return arr.length >= LOGIN_MAX;
}

function marcarFalhaLogin(email: string) {
  const arr = loginFails.get(email) || [];
  arr.push(Date.now());
  loginFails.set(email, arr);
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'voce@email.com' },
      password: { label: 'Senha', type: 'password' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      const password = credentials?.password || '';
      if (!email || !email.includes('@')) return null;
      if (loginBloqueado(email)) return null;
      let user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      if (!user) {
        // Primeiro acesso: cria conta — exige senha válida (nunca cria conta sem senha)
        if (password.length < 6) return null;
        const passwordHash = await bcrypt.hash(password, 10).catch(() => null);
        if (!passwordHash) return null;
        user = await prisma.user.create({ data: { email, passwordHash } }).catch(() => null);
      } else if (!user.passwordHash) {
        // Conta OAuth (Google) ou legada sem senha: só entra pelo botão do Google
        return null;
      } else if (!password || !(await bcrypt.compare(password, user.passwordHash).catch(() => false))) {
        marcarFalhaLogin(email);
        return null;
      }
      if (!user) return null;
      loginFails.delete(email);
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

// Google só ativa se credenciais configuradas (build não quebra sem elas)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Sessão longa: 90 dias, renovada a cada 24h de uso (não pede login ao sair do app)
  session: { strategy: 'database', maxAge: 90 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers,
  pages: { signIn: '/login' },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
};
