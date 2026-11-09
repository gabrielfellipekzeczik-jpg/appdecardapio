/** Maior taxa que o painel aceita, para evitar erro de digitação (ex.: 50 em vez de 5). */
export const MAX_PLATFORM_FEE_PERCENT = 30;

/** Taxa da plataforma para um restaurante: a dele, se definida; senão a padrão. */
export function effectiveFeePercent(
  companyPercent: number | string | null | undefined,
  defaultPercent: number
): number {
  if (companyPercent === null || companyPercent === undefined || companyPercent === "")
    return defaultPercent;
  const value = Number(companyPercent);
  return Number.isFinite(value) ? value : defaultPercent;
}

/** Valor retido pela plataforma, arredondado em centavos. */
export function platformFeeAmount(transactionAmount: number, percent: number): number {
  return Math.round(transactionAmount * (percent / 100) * 100) / 100;
}

/** Só existe venda online com taxa: precisa ser maior que zero e dentro do limite. */
export function isValidFeePercent(percent: number): boolean {
  return Number.isFinite(percent) && percent > 0 && percent <= MAX_PLATFORM_FEE_PERCENT;
}

/** Taxa que precisa ir no pagamento: nunca abaixo de 1 centavo, para não sumir no arredondamento. */
export function requiredFeeAmount(transactionAmount: number, percent: number): number {
  return Math.max(0.01, platformFeeAmount(transactionAmount, percent));
}

type FeeDetail = { type?: string; amount?: number | string | null };

/** Quanto o Mercado Pago de fato reteve para a plataforma neste pagamento. */
export function retainedPlatformFee(payment: {
  fee_details?: FeeDetail[] | null;
  marketplace_fee?: number | string | null;
  application_fee?: number | string | null;
}): number {
  const fromDetails = (payment.fee_details ?? [])
    .filter(detail => detail.type === "application_fee" || detail.type === "marketplace_fee")
    .reduce((sum, detail) => sum + (Number(detail.amount) || 0), 0);
  const direct = Number(payment.application_fee ?? payment.marketplace_fee ?? 0) || 0;
  return Math.round(Math.max(fromDetails, direct) * 100) / 100;
}

/** A taxa conta como retida quando bate com a esperada (tolerância de 1 centavo). */
export function feeWasRetained(retained: number, expected: number): boolean {
  return expected <= 0 || retained + 0.005 >= expected - 0.01;
}
