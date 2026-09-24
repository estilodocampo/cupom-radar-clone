# Cupom Radar Clone - Fase 1
Base SaaS Next.js + Vercel.

## Rodar
```
npm.cmd install
npm.cmd run dev
```
Abrir http://localhost:3000

## O que já tem
- Landing com planos (lib/plans.ts)
- Login mock (/login)
- Dashboard gerador (/dashboard)
- API POST /api/generate-post -> detecta loja, converte link afiliado, gera texto

## Deploy

GitHub: https://github.com/estilodocampo/cupom-radar-clone

### Railway (recomendado p/ Fase 2 com WhatsApp)
1. Acesse railway.app -> New Project -> Deploy from GitHub -> selecione `cupom-radar-clone`
2. Build: `npm run build` | Start: `npm run start`
3. Adicione variável `PORT=3000` se necessário
4. Se der "Free plan resource limit": delete um projeto antigo ou adicione como novo Service dentro de um projeto existente.

### Vercel (mais simples p/ Next.js)
1. vercel.com -> Add New -> Project -> Import `cupom-radar-clone`
2. Framework: Next.js, sem config extra.

## Próximos passos
- Fase 1b: NextAuth + Postgres + Stripe/MercadoPago
- Fase 2: Baileys WhatsApp + Telegram + agendador
- Fase 3: Modo Copiador / Fila / Lista
