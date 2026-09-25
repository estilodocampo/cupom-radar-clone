import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

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
      let user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      if (!user) {
        // Primeiro acesso: cria conta (define senha se informada)
        const data: { email: string; passwordHash?: string } = { email };
        if (password.length >= 6) data.passwordHash = await bcrypt.hash(password, 10);
        user = await prisma.user.create({ data }).catch(() => null);
      } else if (user.passwordHash) {
        // Conta com senha: exige conferência
        if (!password || !(await bcrypt.compare(password, user.passwordHash).catch(() => false))) return null;
      }
      if (!user) return null;
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
  session: { strategy: 'database' },
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
