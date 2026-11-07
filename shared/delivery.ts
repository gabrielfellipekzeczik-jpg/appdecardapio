export type DeliveryProvider =
  | "uber_direct"
  | "lalamove"
  | "own_courier"
  | "99entrega";
export type MessagingChannel = "whatsapp" | "sms";

/** Cobra pela distância rodoviária informada pelo provedor de rotas; arredonda ao centavo. */
export function calculateOwnCourierFee(
  distanceKm: number,
  pricePerKm: number
): number {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    !Number.isFinite(pricePerKm) ||
    pricePerKm < 0
  ) {
    throw new Error("Distância e tarifa por km precisam ser valores válidos.");
  }
  return Math.round(distanceKm * pricePerKm * 100) / 100;
}

export type DeliveryPricing = {
  baseFee: number;
  includedKm: number;
  pricePerKm: number;
  maxKm: number;
};

/**
 * Referência pública: repasse do iFood ao entregador de moto (R$ 7,50 de mínimo e
 * R$ 1,50 por km, valores de 2025). Nenhum app publica tabela por cidade, então a
 * loja pode ajustar estes números em Aparência > Regras de pedido.
 */
export const DEFAULT_DELIVERY_PRICING: DeliveryPricing = {
  baseFee: 7.5,
  includedKm: 3,
  pricePerKm: 1.5,
  maxKm: 15,
};

export function estimateDeliveryFee(
  distanceKm: number,
  pricing: DeliveryPricing
): number {
  const extraKm = Math.max(0, distanceKm - pricing.includedKm);
  return Math.round((pricing.baseFee + extraKm * pricing.pricePerKm) * 100) / 100;
}

/** Converte o retorno da Uber (centavos) em reais sem interpretar moedas estrangeiras como BRL. */
export function minorUnitsToBRL(value: number, currency: string): number {
  if (
    currency.toUpperCase() !== "BRL" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error("Cotação inválida: esperado um valor em centavos de BRL.");
  }
  return value / 100;
}

export function buildTrackingMessage(
  channel: MessagingChannel,
  companyName: string,
  trackingUrl: string
) {
  const prefix = channel === "whatsapp" ? "WhatsApp" : "SMS";
  return `${prefix}: acompanhe sua entrega de ${companyName} em ${trackingUrl}`;
}

export function unavailableDeliveryResponse(
  provider: DeliveryProvider,
  reason?: string
) {
  return {
    provider,
    available: false as const,
    trackingUrl: null,
    reason:
      reason ??
      "Conecte um provedor de entrega em Integrações para ativar o despacho automático.",
  };
}
