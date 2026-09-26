import { NextResponse } from 'next/server';

// Unifica o domínio: quem abre o endereço antigo do Railway cai no domínio
// oficial, mantendo UM único cookie de sessão (evita "login toda hora"
// ao alternar entre endereços).
export function middleware(req: Request) {
  const url = new URL(req.url);
  if (url.hostname.endsWith('.railway.app')) {
    url.hostname = 'app.estilodocampo.com.br';
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
