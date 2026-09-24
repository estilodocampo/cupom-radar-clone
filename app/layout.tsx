import React from 'react';

export const metadata = { title: 'Cupom Radar Clone - Fase 1', description: 'Base SaaS afiliados' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0b0f14', color: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
