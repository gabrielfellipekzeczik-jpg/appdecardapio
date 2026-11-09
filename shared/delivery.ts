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

export type DeliveryFeeMode = "calculated" | "fixed";

export type DeliveryPricing = {
  /** "calculated": mínimo + km extra; "fixed": sempre o valor manual. */
  mode: DeliveryFeeMode;
  fixedFee: number;
  /** Entrega grátis até esta distância (0 desliga). Vale nos dois modos. */
  freeUpToKm: number;
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
  mode: "calculated",
  fixedFee: 7.5,
  freeUpToKm: 0,
  baseFee: 7.5,
  includedKm: 3,
  pricePerKm: 1.5,
  maxKm: 15,
};

export function estimateDeliveryFee(
  distanceKm: number,
  pricing: Pick<DeliveryPricing, "baseFee" | "includedKm" | "pricePerKm"> &
    Partial<Pick<DeliveryPricing, "mode" | "fixedFee" | "freeUpToKm">>
): number {
  if ((pricing.freeUpToKm ?? 0) > 0 && distanceKm <= (pricing.freeUpToKm ?? 0))
    return 0;
  if (pricing.mode === "fixed")
    return Math.round((pricing.fixedFee ?? 0) * 100) / 100;
  const extraKm = Math.max(0, distanceKm - pricing.includedKm);
  return Math.round((pricing.baseFee + extraKm * pricing.pricePerKm) * 100) / 100;
}

/** Lê a configuração salva na empresa (colunas numéricas podem vir como texto). */
export function deliveryPricingFrom(company: {
  deliveryFeeMode?: unknown;
  deliveryFixedFee?: unknown;
  deliveryFreeKm?: unknown;
  deliveryBaseFee?: unknown;
  deliveryIncludedKm?: unknown;
  deliveryPricePerKm?: unknown;
  deliveryMaxKm?: unknown;
}): DeliveryPricing {
  const value = (raw: unknown, fallback: number) => {
    const parsed = Number(raw);
    return raw === null || raw === undefined || raw === "" || !Number.isFinite(parsed)
      ? fallback
      : parsed;
  };
  const base = DEFAULT_DELIVERY_PRICING;
  return {
    mode: company.deliveryFeeMode === "fixed" ? "fixed" : "calculated",
    fixedFee: value(company.deliveryFixedFee, base.fixedFee),
    freeUpToKm: value(company.deliveryFreeKm, base.freeUpToKm),
    baseFee: value(company.deliveryBaseFee, base.baseFee),
    includedKm: value(company.deliveryIncludedKm, base.includedKm),
    pricePerKm: value(company.deliveryPricePerKm, base.pricePerKm),
    maxKm: value(company.deliveryMaxKm, base.maxKm),
  };
}

/** Frase curta para o cliente (loja e robô do WhatsApp). */
export function describeDeliveryPricing(pricing: DeliveryPricing): string {
  const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const km = (v: number) => `${String(v).replace(".", ",")} km`;
  const parts: string[] = [];
  if (pricing.freeUpToKm > 0) parts.push(`grátis até ${km(pricing.freeUpToKm)}`);
  if (pricing.mode === "fixed")
    parts.push(`${pricing.freeUpToKm > 0 ? "depois " : ""}taxa fixa de ${money(pricing.fixedFee)}`);
  else
    parts.push(
      `${pricing.freeUpToKm > 0 ? "depois " : ""}${money(pricing.baseFee)} até ${km(pricing.includedKm)} e ${money(pricing.pricePerKm)} por km a mais`
    );
  return `Entrega ${parts.join(", ")}, até ${km(pricing.maxKm)}.`;
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
