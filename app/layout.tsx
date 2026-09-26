import React from 'react';
import Providers from './providers';
import RegisterSw from './sw';
import './globals.css';

export const metadata = {
  title: 'Cupom Radar — Automação de Afiliados',
  description: 'Gere ofertas, conecte o WhatsApp e venda no piloto automático',
  themeColor: '#0a0f1e',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Cupom Radar' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegisterSw />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
