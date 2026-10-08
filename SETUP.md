# Marmitaria Flow — execução real

Este projeto foi configurado para operar com dados reais persistidos. Ele **não inicia sem as credenciais obrigatórias** e não usa cardápio, empresa ou pedidos fictícios no ambiente de desenvolvimento/produção.

## 1. Requisitos

- Node.js 22 ou superior
- pnpm 10
- Projeto Supabase
- PostgreSQL do Supabase
- Mercado Pago Developers para liberar pagamentos
- Provedor de entrega, se a operação usar despacho automático

```bash
node --version
pnpm --version
```

## 2. Instalação

Na raiz do projeto:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

O `pnpm-workspace.yaml` mantém o patch do Wouter e o override do nanoid compatíveis com pnpm 10.

## 3. Variáveis obrigatórias

Preencha o `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
OWNER_EMAIL=seu-email@dominio.com
INTEGRATIONS_ENCRYPTION_KEY=...
DATABASE_URL=postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres
NODE_ENV=development
PORT=3000
```

Gere a chave de criptografia uma única vez:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

A `SUPABASE_SERVICE_ROLE_KEY` só pode existir no backend. Nunca a coloque em código frontend, commit ou arquivo público.

## 4. Criar e preparar o Supabase

1. Crie um projeto no Supabase.
2. Em **Project Settings → API**, copie Project URL, anon key e service role key.
3. Em **Project Settings → JWT Keys**, obtenha o segredo JWT compatível com a validação HS256 usada pelo backend.
4. Em **Authentication → Providers → Email**, ative Email/Password e deixe **Confirm email** LIGADO. Sem isso o Supabase não envia código e o cadastro entra direto, sem confirmação.
5. Em **Authentication → Emails → Templates → Confirm signup**, troque o corpo para mostrar o código de 6 dígitos (o padrão só traz um link):

   ```html
   <h2>Confirme seu e-mail</h2>
   <p>Seu código de confirmação é:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Ele expira em 1 hora. Se não foi você, ignore este e-mail.</p>
   ```

   O tamanho do código (padrão 6) fica em **Authentication → Providers → Email → Email OTP Length**; se mudar, ajuste `OTP_LENGTH` em `client/src/pages/CompanySignUp.tsx`.
6. Em **Authentication → URL Configuration**, adicione `http://localhost:3000` e o domínio final.
7. Em **Project Settings → API → Exposed schemas**, adicione `marmitaria`.

> O e-mail padrão do Supabase tem limite baixo de envios por hora (poucos e-mails). Para produção, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

## 5. Aplicar o banco

A migração atual cria o schema isolado `marmitaria` e todas as tabelas, enums e índices dentro dele:

```bash
pnpm run db:push
```

Confira no SQL Editor se existem, entre outras:

```text
marmitaria.companies
marmitaria.users
marmitaria.menu_categories
marmitaria.menu_items
marmitaria.customers
marmitaria.orders
marmitaria.order_items
marmitaria.integration_settings
```

Depois, no SQL Editor do Supabase, rode o conteúdo de `supabase-grants.sql`. Sem isso o backend recebe `permission denied for schema marmitaria`.

Se a migração antiga já tiver criado tabelas em `public`, faça backup e migre os dados antes de remover ou renomear as tabelas antigas. Não misture as duas estruturas sem revisar os dados.

## 6. Configurar Storage

Crie no Supabase Storage o bucket:

```text
logos
```

Configure policies de upload para usuários autenticados e leitura das imagens usadas publicamente no cardápio. Sem esse bucket, o cadastro de logo e imagens falhará.

## 7. Criar a primeira conta e empresa

Depois de preencher o `.env`:

```bash
pnpm dev
```

Abra:

```text
http://localhost:3000/cadastrar
```

1. Preencha nome, endereço, e-mail, senha e repita a senha.
2. Digite o código de 6 dígitos que chegou no e-mail.
3. A empresa é criada e você cai direto no painel (`/seu-endereco/admin`).
4. Nos próximos acessos, entre em `/admin-login`.
5. Cadastre categorias e itens do cardápio pelo painel/banco.
6. Use o email definido em `OWNER_EMAIL` para acessar o Super Admin.

Sem dados reais em `companies` e `menu_items`, a loja pública não terá conteúdo para mostrar. O sistema não insere conteúdo fictício automaticamente.

## 8. Mercado Pago obrigatório para checkout

Crie uma aplicação no Mercado Pago Developers e configure:

```env
MP_CLIENT_ID=...
MP_CLIENT_SECRET=...
MP_REDIRECT_URI=https://SEU-DOMINIO/api/mercadopago/oauth-callback
PLATFORM_FEE_PERCENT=5
```

Registre exatamente a URL de callback no Mercado Pago. Depois:

1. Acesse o painel administrativo.
2. Abra **Integrações**.
3. Conecte a conta Mercado Pago da empresa.
4. Configure o webhook de pagamentos no domínio publicado.
5. Teste PIX, cartão aprovado, pendente, rejeitado e reembolso usando contas de teste.

Enquanto o Mercado Pago não estiver conectado, o checkout fica bloqueado. Nenhum pedido é criado.

## 9. Entrega e mensagens

As credenciais de entrega são cadastradas por empresa e armazenadas criptografadas. Configure um provedor real, como Uber Direct, Lalamove ou motoboy próprio, antes de avançar pedidos para despacho automático.

A 99Entrega depende de contrato e API de parceiro. A presença de uma opção visual não significa que a integração esteja disponível.

Para WhatsApp/SMS, configure um provedor real, token, remetente, templates aprovados, consentimento do cliente, retentativas e logs.

## 10. Validar antes de publicar

```bash
pnpm run check
pnpm test
pnpm run build
```

Resultado esperado:

```text
30 testes passando
TypeScript sem erros
Build concluído com sucesso
```

Os fixtures existentes são usados somente pela suíte de testes (`NODE_ENV=test`); não são ativados por ausência de credenciais em desenvolvimento ou produção.

## 11. Publicar na Vercel

1. Importe o repositório.
2. Mantenha o `vercel.json`.
3. Cadastre na Vercel todas as variáveis do `.env`.
4. Faça o deploy.
5. Atualize `MP_REDIRECT_URI` para o domínio final.
6. Atualize as URLs permitidas no Supabase.
7. Configure os webhooks do Mercado Pago.
8. Teste login, criação de empresa, cardápio, checkout e atualização de pedidos.

As variáveis `VITE_*` precisam estar configuradas antes do build da Vercel, porque são incorporadas ao bundle frontend.

## 12. Diagnóstico

### O servidor não inicia

O comportamento é intencional. Confira as variáveis listadas na mensagem de erro, especialmente:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### A página abre, mas a empresa não existe

Crie a empresa pelo `/cadastrar` e verifique se ela está em `marmitaria.companies`.

### O cardápio está vazio

Cadastre categorias e itens reais em `marmitaria.menu_categories` e `marmitaria.menu_items`, usando o `companyId` correto.

### O botão "Continuar" do cadastro não habilita

Ele só exige nome, endereço (3+ caracteres), e-mail válido, senha com 6+ caracteres e a confirmação igual à senha. Se o endereço aparecer como "✗ já está em uso", troque o endereço. Ao clicar, se aparecer "Não foi possível falar com o servidor", o `/api/trpc` está fora do ar ou sem variáveis de ambiente (veja a lista acima e o log do servidor/Vercel).

### O código não chega por e-mail

Confira **Confirm email** ligado e o template **Confirm signup** com `{{ .Token }}` (passo 5 da seção 4), a caixa de spam e o limite de envios do e-mail padrão do Supabase.

### Aparece "permission denied for schema marmitaria"

Rode `supabase-grants.sql` no SQL Editor e confirme que `marmitaria` está em **Exposed schemas**.

### O login falha

Confira Email/Password, email confirmado, URLs autorizadas e `SUPABASE_JWT_SECRET`.

### O checkout está bloqueado

Conecte o Mercado Pago pelo painel da empresa e confirme as credenciais OAuth e a callback.

### O upload falha

Verifique o bucket `logos` e suas policies no Supabase Storage.
