import React from 'react';
import Providers from './providers';
import './globals.css';

export const metadata = { title: 'Cupom Radar — Automação de Afiliados', description: 'Gere ofertas, conecte o WhatsApp e venda no piloto automático' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
