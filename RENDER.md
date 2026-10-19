# Migração para o Render

Arquitetura escolhida para **custo mínimo**: web + worker WhatsApp no **mesmo serviço**, com um disco de 1 GB em `/data`. O worker escuta só em `127.0.0.1:3001`.

| Recurso | Plano | Aprox. |
|---|---|---|
| Serviço único (Next + Baileys + disco) | Starter | US$ 7/mês |
| Postgres 256 MB | Basic | US$ 6/mês |
| **Total** | | **~US$ 13/mês** |

> Não use o Postgres free: ele expira e você perde os dados. O worker também não pode dormir — o WhatsApp desconectaria.

> **Memória:** 512 MB atende Next + 2 números na operação normal. Se os logs mostrarem reinício por falta de memória durante envios com foto, troque o plano do serviço para `1c-2g` (US$ 25) — o disco e o banco continuam os mesmos.

## 1. Reativar o Railway só para o dump
1. Railway → projeto → **Billing** → ative o plano Hobby (US$ 5, temporário).
2. Espere o **Postgres** voltar a ficar Online.
3. **Pause o serviço `cupom-radar-wa`** (Settings → Pause) para ele não voltar a disparar mensagens.
4. Postgres → **Connect** → copie a **Public Network** URL.

## 2. Aplicar o Blueprint no Render
1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Conecte o GitHub e escolha `estilodocampo/cupom-radar-clone`.
3. Confirme o serviço `cupom-radar` e o banco `cupom-radar-db` (~US$ 13/mês) → **Apply**.
4. Preencha as variáveis `sync: false` no serviço **cupom-radar**:

| Variável | Valor |
|---|---|
| `NEXTAUTH_URL` | `https://app.estilodocampo.com.br` (ou a URL `onrender.com` no primeiro teste) |
| `WEB_URL` | a mesma URL acima |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | os mesmos do Railway |
| `ABACATEPAY_API_KEY` / `ABACATEPAY_WEBHOOK_SECRET` | os mesmos do Railway |
| `ML_CLIENT_ID` | `1653415201948706` |
| `ML_CLIENT_SECRET` | o mesmo do Railway |
| `ADMIN_EMAILS` | o mesmo do Railway |

`DATABASE_URL`, `NEXTAUTH_SECRET` e `WORKER_TOKEN` são gerados automaticamente.

> Se o primeiro deploy falhar por falta de `NEXTAUTH_URL`, preencha e use **Manual Deploy → Deploy latest commit**.

## 3. Migrar os dados (Railway → Render)
Com o serviço já criado (as tabelas existem após o primeiro deploy):

1. Render → **cupom-radar-db** → **Connect** → copie a **External Database URL**.
2. Na raiz do projeto, copie o modelo e preencha:
   ```powershell
   Copy-Item .env.migrate.example .env.migrate
   notepad .env.migrate
   ```
   ```env
   SOURCE_DATABASE_URL=postgresql://...   # Railway (Public Network)
   TARGET_DATABASE_URL=postgresql://...   # Render (External)
   ```
3. Rode:
   ```powershell
   node scripts/migrate.js
   ```
   O script copia todas as tabelas em lotes, sem duplicar se rodar de novo, e reativa as FKs.

> O arquivo `.env.migrate` está no `.gitignore` e não vai para o repositório.

## 4. Reconectar o WhatsApp
O `/data/auth` do Railway não é exportável pelo CLI. Pareie de novo:
1. Abra **Robô** no Render e leia o QR do `wa1`.
2. Repita para o `wa2`.
3. Faça um envio de teste em **Envio**.

A sessão fica no disco `/data` e sobrevive a deploys/restarts.

## 5. Domínio
Em **cupom-radar → Settings → Custom Domains**, adicione `app.estilodocampo.com.br`.
No provedor de DNS, troque o destino atual (Railway) por:

```
Tipo: CNAME
Nome: app
Valor: <seu-serviço>.onrender.com
```

Mantendo o mesmo domínio, **não** é preciso alterar:
- redirect URI do Google (`.../api/auth/callback/google`);
- redirect URI do Mercado Livre;
- webhook do AbacatePay.

## 6. Validar
1. `https://app.estilodocampo.com.br/api/health` → `{"ok":true,"db":"up"}`.
2. Login e conferir **Saldo/Relatórios** (dados migrados).
3. **Robô** com os dois números conectados.
4. Teste real de envio com foto + link curto.
5. Logs do Render: `[all] iniciando worker e web` e `worker http no ar`.

## 7. Encerrar o Railway
Depois de validar por 1–2 dias, cancele o plano do Railway. Nada no Render depende dele.

## Rollback
Enquanto o Railway estiver ativo, o rollback é só apontar o DNS de volta. O disco e o banco do Render podem ser apagados depois.
