import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Email demo',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'voce@email.com' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      if (!email || !email.includes('@')) return null;
      let user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      if (!user) {
        user = await prisma.user.create({ data: { email } }).catch(() => null);
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
