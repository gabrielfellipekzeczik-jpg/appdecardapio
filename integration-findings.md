# Integrações verificadas — 20 de agosto de 2026

## Mercado Pago

A documentação oficial consultada apresenta o Checkout Transparente via Orders API, com pagamento dentro do próprio site, sem redirecionar o cliente para outro ambiente. A página também disponibiliza etapas específicas para integrar cartões e Pix, além de uma seção própria para configurar notificações de orders. A implementação deve usar credenciais do vendedor, ambiente de teste e webhook para atualizar o pedido após a confirmação do pagamento.

Fonte: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/overview

## 99

O endereço oficial encontrado para desenvolvedores é o portal 99Food Open Platform: https://developer-food.99app.com/. A página não expôs conteúdo legível no carregamento inicial, portanto não foi possível confirmar publicamente, nesta sessão, a existência de um endpoint aberto para criar corridas de entrega sob demanda, gerar link de rastreio ou configurar callbacks para o caso de uma marmitaria independente. O repositório público histórico de APIs corporativas da 99 apareceu na busca, mas não deve ser tratado como prova de disponibilidade atual nem como equivalente à 99Entrega.

Conclusão de produto: o app deve incluir o adaptador de 99Entrega e o fluxo de disparo quando o pedido for marcado como pronto, mas a ativação em produção deve depender de credenciais, contrato e documentação de parceiro fornecidos pela 99. Sem esse acesso, o app deve manter a entrega em estado de configuração pendente, sem fingir que a corrida foi criada.

## Comunicação

O requisito de enviar rastreio por WhatsApp ou SMS precisa de um provedor de mensagens e credenciais próprias, além de consentimento do cliente e tratamento de falhas. O primeiro release pode estruturar o serviço de notificação e exibir o link no pedido; o envio automático será ativado assim que o provedor e as credenciais forem definidos.
