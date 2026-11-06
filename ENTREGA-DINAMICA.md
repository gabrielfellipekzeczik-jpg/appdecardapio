# Taxas de entrega dinâmicas

A taxa fixa de R$ 5,90 foi removida.

- **Uber Direct:** o servidor solicita uma cotação ao preencher o endereço. O valor em BRL é exibido no checkout e a cotação aceita fica vinculada ao pedido para o despacho. A cotação expira conforme a validade fornecida pela Uber; o app renova automaticamente antes do vencimento. O servidor valida endereço, loja, modalidade e expiração e não aceita preço informado pelo navegador.
- **Motoboy próprio:** em **Painel → Integrações → Motoboy próprio**, informe o valor em R$/km e as coordenadas de retirada (latitude e longitude). A taxa é calculada sobre a distância rodoviária, arredondada para cima em décimos de quilômetro, multiplicada pelo valor configurado por km. O endereço do cliente é geocodificado para calcular a rota.
- **Pedidos manuais:** também recebem a cotação Uber ou a tarifa por km configurada antes da criação do pedido.

## Migração antes do deploy

Aplique uma vez ao banco Supabase da aplicação, antes de publicar o código:

```sql
ALTER TABLE "marmitaria"."orders" ADD COLUMN "deliveryQuoteId" varchar(160);
```

O mesmo SQL está em `drizzle/0005_delivery_quote_id.sql` e foi incluído no journal/snapshot Drizzle.

## Configuração operacional

As credenciais Uber existentes continuam guardadas criptografadas. Nenhuma variável de `.env.local` foi alterada ou incluída no pacote. Não foi criada uma nova variável de ambiente para a tarifa.

A geocodificação usa OpenStreetMap Nominatim, com cache e limite de chamadas; o roteamento usa a instância pública do OSRM. Esses serviços públicos não oferecem SLA de produção. Para volume alto, recomenda-se substituir por serviços de geocodificação/rotas contratados ou hospedados pela operação.
