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
