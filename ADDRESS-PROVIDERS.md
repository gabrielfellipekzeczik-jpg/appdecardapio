# Provedores de autocomplete: custo, cartão e limites

Atualizado em 14 de outubro de 2026.

## Google Maps Platform

A **Maps Demo Key** pode ser emitida sem dados de faturamento/cartão e inclui um subconjunto de recursos, inclusive Places API (New). Porém, os próprios termos limitam o projeto a testes e avaliação: não é permitido usá-lo em produção, as cotas podem parar o serviço e não há SLA. [Google: Maps Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key) · [Termos do Maps Demo Project](https://cloud.google.com/terms/maps-platform/demo-project-terms)

Para o serviço padrão do Places API em produção, a documentação exige faturamento ativo no projeto. A tabela atual indica uma cota gratuita de até 10.000 eventos/mês para Autocomplete Requests; excedentes podem ser cobrados. Cota gratuita não elimina a exigência de faturamento e meio de cobrança da conta. [Google: Places API billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) · [Google: pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

## OSM e Photon

O autocomplete do app usa o endpoint público do **Photon**, que foi desenvolvido para busca enquanto a pessoa digita e utiliza dados OpenStreetMap. O servidor público pede uso razoável, pode limitar/bloquear tráfego excessivo e não garante disponibilidade; para volume alto, a recomendação do projeto é hospedar uma instância própria. [Komoot Photon](https://github.com/komoot/photon)

O serviço público do Nominatim não é apropriado para autocomplete: a política proíbe autocomplete no cliente e impõe no máximo uma requisição por segundo por aplicação. O app usava uma fila global com essa espera; a busca foi trocada para Photon e o atraso visual do debounce foi reduzido para 300 ms. [Política oficial Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
