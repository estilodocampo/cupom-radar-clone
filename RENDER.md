# Migração para o Render

O projeto já está preparado: `render.yaml` cria **web + worker WhatsApp + Postgres** de uma vez.

## Custo estimado
| Recurso | Plano | Aprox. |
|---|---|---|
| Web (Next.js) | Starter | US$ 7/mês |
| Worker WhatsApp (privado + disco 1 GB) | Starter | US$ 7/mês |
| Postgres 256 MB | Basic | US$ 6/mês |

> O worker **não pode** ser free: precisa de disco persistente e de ficar sempre acordado para o Baileys.

## 1. Aplicar o Blueprint
1. Acesse [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Conecte o GitHub e escolha `estilodocampo/cupom-radar-clone`.
3. O Render lê o `render.yaml` e mostra os 3 recursos. Confirme o plano e clique em **Apply**.

## 2. Preencher as variáveis (marcadas `sync: false`)
No serviço **cupom-radar-web** → Environment:

| Variável | Valor |
|---|---|
| `NEXTAUTH_URL` | `https://app.estilodocampo.com.br` (ou a URL `onrender.com` no primeiro teste) |
| `GOOGLE_CLIENT_ID` | o mesmo do Railway |
| `GOOGLE_CLIENT_SECRET` | o mesmo do Railway |
| `ABACATEPAY_API_KEY` | o mesmo do Railway |
| `ABACATEPAY_WEBHOOK_SECRET` | o mesmo do Railway |
| `ML_CLIENT_ID` | `1653415201948706` |
| `ML_CLIENT_SECRET` | o mesmo do Railway |
| `ADMIN_EMAILS` | o mesmo do Railway |

No **cupom-radar-wa** → Environment:

| Variável | Valor |
|---|---|
| `WEB_URL` | `https://app.estilodocampo.com.br` |

`DATABASE_URL`, `WORKER_TOKEN` e `NEXTAUTH_SECRET` são gerados/conectados automaticamente.

> Se o `NEXTAUTH_URL` ficar com a URL `onrender.com`, faça login por lá primeiro. Ao mudar para o domínio próprio, usuários precisam entrar de novo (o cookie muda de host).

## 3. Dados: escolha um caminho

### A) Começar limpo (mais rápido)
O `render.yaml` roda `prisma db push` no deploy e cria todas as tabelas.
- Criar a conta novamente (e-mail ou Google);
- Reconectar wa1/wa2 lendo o QR em **Robô**;
- Recriar regras e canais.

### B) Trazer os dados do Railway
Exige reativar o Railway por algumas horas (o trial expirou e o Postgres está offline).
```bash
# 1) pegue a DATABASE_URL pública no painel do Railway (Postgres → Connect)
pg_dump "$RAILWAY_DATABASE_URL" --no-owner --no-acl -f backup.sql

# 2) pegue a External Database URL no Render (cupom-radar-db → Connect)
psql "$RENDER_EXTERNAL_URL" -f backup.sql
```
Depois, no Render, rode um **Manual Deploy → Clear build cache & deploy** (o `db push` reconcilia o schema).

**Sessão do WhatsApp:** o `/data/auth` do Railway não é exportável facilmente pelo CLI. O caminho prático é reconectar os dois números pelo QR no Render (leva ~1 minuto cada).

## 4. Domínio
Em **cupom-radar-web → Settings → Custom Domains**, adicione `app.estilodocampo.com.br`.
No seu provedor de DNS, troque o registro atual (Railway) por:

```
Tipo: CNAME
Nome: app
Valor: <seu-serviço>.onrender.com
```

Mantenha o mesmo domínio para **não** precisar alterar:
- redirect URI do Google (`https://app.estilodocampo.com.br/api/auth/callback/google`);
- redirect URI do Mercado Livre;
- webhook do AbacatePay.

## 5. Validar
1. `https://app.estilodocampo.com.br/api/health` → `{"ok":true,"db":"up"}`.
2. Login e abrir **Robô** → QR dos dois números.
3. Enviar um teste em **Envio** (foto + link curto).
4. Conferir logs do worker: deve aparecer `worker http no ar`.

## Rollback
O Railway continua com o código e os volumes intactos. Se algo falhar, basta reativar o plano e apontar o DNS de volta — nada é apagado no Render durante os testes.
