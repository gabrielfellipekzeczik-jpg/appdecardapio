# Correções aplicadas — 14/10/2026

## Segurança e pedidos
- O servidor recalcula preços e totais usando os itens ativos do cardápio da empresa; valores enviados pelo navegador não determinam a cobrança.
- Histórico, detalhes e pagamento de pedidos exigem token aleatório por navegador, transmitido em cabeçalho HTTP e armazenado no banco apenas como hash.
- O endereço completo é salvo no pedido; pedidos externos não podem substituir dados de cadastro apenas conhecendo o telefone.
- O webhook confere conta recebedora, empresa, referência e valor; pedidos pagos por preferência Checkout Pro podem ser conciliados pelo preference_id salvo.
- Falhas ao persistir cliente/pedido/itens são tratadas; pedido incompleto é removido.

## Checkout e comprador
- Checkout ampliado, responsivo e rolável, com resumo e pagamento juntos na mesma página, sem segunda tela estreita; rolagem própria no painel e CTA fixo no celular.
- O formulário do Mercado Pago aparece após confirmação do e-mail e preenchimento de nome, WhatsApp, rua e número; se o lojista não conectou credenciais, o bloqueio fica explícito.
- Comprador confirma e-mail com código OTP do Supabase, criando/entrando em conta passwordless. O servidor também verifica a confirmação com Supabase Auth antes de criar pedido/cobrar.
- Nome, telefone e até 10 endereços por loja ficam no perfil do comprador; há seleção, criação e edição de endereços salvos.
- Busca de endereços por OpenStreetMap Nominatim é feita no servidor, com fila/cache; se o serviço estiver indisponível, o endereço ainda pode ser preenchido manualmente. Há número separado, complemento e referência opcionais.
- Taxa fixa de R$ 5,90 somente com endereço, número e modalidade de entrega ativa; sem qualquer um deles, taxa zero. A taxa não é baseada em distância.

## Pedidos, financeiro e estoque
- Botão “Novo pedido” agora abre formulário funcional com itens ativos, endereço e número, escolha entre dinheiro na entrega ou link de cobrança Mercado Pago e preços recalculados no servidor.
- Link Mercado Pago pode ser copiado ou enviado pelo WhatsApp; há link privado de acompanhamento do cliente. O envio do WhatsApp ainda depende da confirmação do operador.
- Pagamento em dinheiro só entra na receita depois de marcado como recebido na fila de pedidos; pagamento Mercado Pago só entra após confirmação do provedor/webhook.
- BI financeiro usa pedidos/despesas persistidos e oferece filtros de período, receita aprovada, despesas, saldo operacional, pendências, receita por meio de pagamento, produtos mais vendidos, gastos por categoria e exportação CSV.
- “Saldo operacional” não é lucro contábil: custos de produto sem lançamento, impostos e taxas do adquirente podem não estar incluídos.
- Estoque oferece cadastro de itens, saldo inicial, mínimo e custo, além de entradas, saídas e ajustes físicos com histórico e proteção contra saldo negativo.
- Pedidos não descontam ingredientes automaticamente nesta versão; isso exigiria ficha técnica/receitas associadas aos produtos.

## Motoboy próprio e rastreamento
- Motoboy próprio pode iniciar rastreamento GPS pelo link privado emitido no painel quando o pedido fica pronto.
- A localização é enviada apenas enquanto o entregador mantém a página GPS aberta; o comprador acompanha no mapa, com atualização periódica.
- Confirmação de entrega exige os 4 últimos dígitos do telefone do cliente. O código é exibido na tela do comprador e nunca na tela do motoboy.
- O código não é enviado automaticamente por SMS/WhatsApp nesta versão; ele fica disponível dentro do app.

## Migrações e deploy Vercel
Antes de usar as funcionalidades, aplique no schema `marmitaria`, em ordem, as migrações pendentes, incluindo:
1. `drizzle/0002_order_access_token.sql`, caso ainda não aplicada.
2. `drizzle/0003_courier_tracking.sql`.
3. `drizzle/0004_finance_stock.sql` — data de aprovação, índices do BI e função transacional para movimentação de estoque.

A função Vercel é gerada de `server/vercel-handler.ts` em `api/trpc.js`. Remova handlers legados `api/trpc.ts` e `api/index.ts` antes do build. No PowerShell:

```powershell
Remove-Item .\api\trpc.ts, .\api\index.ts -Force -ErrorAction SilentlyContinue
pnpm install --force --frozen-lockfile
pnpm check
pnpm test
pnpm run build:vercel
Get-ChildItem .\api -File | Select-Object Name
vercel --prod
```

Se Rollup ainda faltar, remova `node_modules` (arquivos gerados, não código) e rode `pnpm install --frozen-lockfile` de novo. A pasta `api` deve conter `trpc.js`, sem `trpc.ts` ou `index.ts`.

Mantenha confirmação de e-mail habilitada no Supabase Auth e template OTP de 6 dígitos. Para cartão/Pix ou links de cobrança, conecte Mercado Pago em Painel > Integrações. Para rastreamento GPS, configure Motoboy próprio e use o link HTTPS copiado pelo painel.

`.env.local` não foi alterado e foi excluído do ZIP de entrega.

# Compra sem código e regras da loja — 06/11/2026

Antes de publicar, aplique `drizzle/0008_store_ordering_settings.sql` no schema `marmitaria`. Sem ela, a loja continua vendendo, mas o painel não salva horário, dinheiro e retirada.

- O comprador paga sem confirmar e-mail; o código fica só em "Meus pedidos". Os dados ficam salvos no aparelho.
- Limites: 8 pedidos a cada 10 minutos por IP e 5 pedidos sem pagamento por telefone em 1 hora.
- Em Painel > Aparência a loja define horário de funcionamento, pagamento na entrega e retirada. Dinheiro e retirada começam desligados. Fora do horário o servidor recusa pedidos.
- Pedidos online só aparecem na cozinha depois de pagos. Pedidos pagos na entrega entram direto, sem validação do comprador; acompanhe abusos antes de ativar.
- O Pix expira em 30 minutos, e o cliente pode trocar a forma de pagamento. O servidor confere o Mercado Pago antes de cancelar.
- Busca de endereço por CEP usa ViaCEP.
