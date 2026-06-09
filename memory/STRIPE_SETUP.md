# Stripe Subscription — Guia de Configuração

Você precisa fazer **3 coisas** na Stripe Dashboard e colocar **3 chaves** no `/app/backend/.env`.

---

## 1️⃣ Pegue suas chaves de API

1. Acesse https://dashboard.stripe.com/apikeys
2. **Modo de teste** (canto superior direito → "Test mode" ligado) para validar tudo primeiro
3. Copie a **Secret key** (começa com `sk_test_...`)
4. Mais tarde, quando quiser cobrar de verdade, desligue o "Test mode" e copie a `sk_live_...`

➡️ Cole no `.env`:
```
STRIPE_API_KEY=sk_test_...
```

---

## 2️⃣ Crie o Produto e o Preço recorrente

1. Acesse https://dashboard.stripe.com/products
2. Clique em **"+ Add product"**
3. Preencha:
   - **Name:** StudyLoop Pro
   - **Description:** Acesso ilimitado ao StudyLoop — fontes, sessões, foto e PDF
4. Em **Pricing**, escolha:
   - **Recurring** (recorrente)
   - **Price:** `29.00`
   - **Currency:** `BRL — Brazilian Real`
   - **Billing period:** `Monthly`
5. Clique em **"Save product"**
6. Na tela do produto, role até **Pricing** e copie o **Price ID** (começa com `price_...`)

➡️ Cole no `.env`:
```
STRIPE_PRICE_ID=price_...
```

---

## 3️⃣ Configure o Webhook

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique em **"+ Add endpoint"**
3. **Endpoint URL:**
   ```
   https://doc-to-app-96.preview.emergentagent.com/api/webhook/stripe
   ```
   (Substitua pelo seu domínio de produção quando publicar.)
4. **Events to send** — selecione exatamente estes 4:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
5. Clique em **"Add endpoint"**
6. Na tela do endpoint recém-criado, clique em **"Reveal signing secret"** e copie (começa com `whsec_...`)

➡️ Cole no `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 4️⃣ Reinicie o backend

```bash
sudo supervisorctl restart backend
```

---

## ✅ Como testar (com cartão de teste do Stripe)

1. No app, vá em **Perfil → Vire StudyLoop Pro** (ou dispare um paywall).
2. Clique em **"Fazer upgrade para Pro"** → você será redirecionado pro Stripe Checkout.
3. Use um cartão de teste:
   - **Sucesso:** `4242 4242 4242 4242` · qualquer CVC · qualquer data futura
   - **Falha:** `4000 0000 0000 0341`
   - **Cancelamento (após assinar):** vá em https://dashboard.stripe.com/test/subscriptions e cancele
4. O backend:
   - **No retorno do checkout** (page redirect): faz polling em `/api/plan/checkout-status/{session_id}` e já marca como Pro se o pagamento confirmou rápido.
   - **Via webhook** (assíncrono, mas a fonte da verdade): também recebe `checkout.session.completed` e marca `plano="pro"`.
   - **Em cancelamento ou falha**: o webhook `customer.subscription.deleted` ou `invoice.payment_failed` reverte automaticamente para `plano="free"`.

---

## 📋 O que foi implementado no código

### Backend (`/app/backend/server.py`)
- `POST /api/plan/upgrade` — cria Stripe Checkout Session em modo `subscription`, retorna `checkout_url`.
- `GET /api/plan/checkout-status/{session_id}` — polling após retorno (idempotente).
- `POST /api/webhook/stripe` — recebe os 4 eventos, com verificação de assinatura via `STRIPE_WEBHOOK_SECRET`.
- Cria/reutiliza **Stripe Customer** por usuário (salvo em `users.stripe_customer_id`).
- Salva cada checkout em **`payment_transactions`** com status (`initiated` → `completed`).
- Idempotência via **`stripe_webhook_events`** (não processa o mesmo `event_id` duas vezes).

### Frontend
- `PaywallModal` → ao clicar "Fazer upgrade para Pro", chama `/api/plan/upgrade` enviando `origin_url=window.location.origin` e redireciona para `data.checkout_url`.
- `PerfilScreen` → detecta `?checkout=success&session_id=...` ou `?checkout=cancel` na volta e faz polling/feedback visual (banner verde/vermelho).
- Após sucesso, `AuthContext.refresh()` recarrega o user → badge muda de **FREE** para **PRO** automaticamente e todos os limites desaparecem.

### Eventos tratados pelo webhook
| Evento | Ação |
|---|---|
| `checkout.session.completed` (paid) | `plano="pro"`, grava `pro_since` e `stripe_subscription_id` |
| `customer.subscription.deleted` | `plano="free"`, limpa `stripe_subscription_id` |
| `customer.subscription.updated` | Se status `active/trialing` → pro; se `canceled/unpaid` → free |
| `invoice.payment_failed` | `plano="free"` |

---

## 🛡️ Segurança aplicada

- Preço **NUNCA** vem do frontend — sempre do `STRIPE_PRICE_ID` do servidor (zero risco de manipulação).
- `success_url` / `cancel_url` montadas a partir do `origin_url` enviado pelo frontend (não hardcoded).
- Webhook valida assinatura `Stripe-Signature` quando `STRIPE_WEBHOOK_SECRET` está configurado.
- `client_reference_id` na sessão guarda o `user_id` do StudyLoop para casar com o webhook.
- Endpoint `/api/plan/checkout-status/{session_id}` verifica que a sessão pertence ao usuário autenticado (403 caso contrário).

---

## 🚀 Quando for para produção

1. No Stripe Dashboard, desligue **Test mode**.
2. Refaça os passos 1, 2 e 3 acima no **modo Live** (suas chaves de produção começam com `sk_live_...` e `whsec_...` diferente).
3. Atualize o webhook endpoint para o domínio definitivo.
4. Atualize as 3 vars no `.env` de produção e reinicie o backend.
