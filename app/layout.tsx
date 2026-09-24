import React from 'react';
import Providers from './providers';

export const metadata = { title: 'Cupom Radar Clone - Fase 1b', description: 'SaaS afiliados com auth + pagamento' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0b0f14', color: '#fff' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
