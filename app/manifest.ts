import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cupom Radar — Automação de Afiliados',
    short_name: 'Cupom Radar',
    description: 'Gere ofertas, conecte o WhatsApp e venda no piloto automático',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0f1e',
    theme_color: '#0a0f1e',
    lang: 'pt-BR',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
