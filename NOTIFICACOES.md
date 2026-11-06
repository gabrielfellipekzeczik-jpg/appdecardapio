# Avisos do pedido (e-mail e WhatsApp) e "Meus pedidos"

## O que o cliente recebe
Quando o pagamento é confirmado e a cada avanço do pedido (em preparo → aguardando entrega → saiu para entrega → entregue), o cliente recebe uma mensagem com o link de rastreio e o link "Meus pedidos".
Voltar o status no painel **não** envia mensagem; só avanços enviam.

Sem login: em `https://SEU-APP/SUA-LOJA/pedidos` o cliente digita o e-mail, recebe um código de 6 dígitos e vê todos os pedidos e o status em tempo real.
Esse link aparece no topo da loja ("Meus pedidos") e na tela de pedido confirmado.

## 1. Banco (uma vez)
No Supabase > SQL Editor, rode `drizzle/0007_order_notifications.sql` (cria `customerEmail`, a fila `order_notifications` e as permissões).

## 2. E-mail (Resend) — o mais rápido
1. Crie conta em https://resend.com e verifique um domínio seu (DNS).
2. Gere uma API Key.
3. Na Vercel > Settings > Environment Variables, cadastre:
   - `RESEND_API_KEY` = a chave
   - `EMAIL_FROM` = `Casa da Marmita <pedidos@seudominio.com.br>` (domínio verificado)
   - `PUBLIC_APP_URL` = `https://seu-app.vercel.app` (sem barra no final)
4. Faça redeploy (`vercel --prod`).

Sem `RESEND_API_KEY`/`EMAIL_FROM`, nenhum e-mail de aviso sai (o código de login do cliente é enviado pelo Supabase Auth, que é separado).
Dica: no Supabase > Authentication > Emails, configure SMTP próprio (pode ser o mesmo Resend) para o código de 6 dígitos não cair em spam.

## 3. WhatsApp (mensagens no celular do cliente)
Usa o serviço da pasta `bot/` (WhatsApp Web não oficial). Ele **não roda na Vercel**: precisa de um servidor ligado 24h com disco persistente.
1. Suba `bot/` no Railway, Fly.io, Render ou VPS (há `Dockerfile`), com volume montado em `/data`.
2. Variáveis do serviço: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_APP_URL`, `BOT_DATA_DIR=/data` e `GEMINI_API_KEY` (só para o atendimento automático).
3. No app: Integrações > WhatsApp > Conectar, e leia o QR em WhatsApp > Aparelhos conectados.
4. Use um número só do negócio. O telefone do cliente no checkout precisa ser um WhatsApp válido; o app adiciona o 55 sozinho.

Enquanto o bot estiver desconectado, o WhatsApp é simplesmente ignorado; o e-mail continua funcionando.

## Alternativa oficial (sem risco de bloqueio)
A API oficial (WhatsApp Cloud API da Meta ou Twilio) exige conta Business verificada e templates aprovados. Não está implementada aqui.
