export type CheckoutMode = "live" | "unavailable";

export function getCheckoutState(hasMercadoPagoCredentials: boolean) {
  const mode: CheckoutMode = hasMercadoPagoCredentials ? "live" : "unavailable";
  return {
    mode,
    paymentEnabled: mode === "live",
    title: mode === "live" ? "Pagamento seguro" : "Pagamento indisponível",
    notice:
      mode === "live"
        ? "Pix, crédito ou débito via Mercado Pago."
        : "O Mercado Pago ainda não foi configurado para esta loja.",
    buttonLabel: mode === "live" ? "Pagar agora" : "Pagamento indisponível",
  } as const;
}

/** Não presume entrega nem inventa preço; só aceita valor cotado no servidor. */
export function calculateDeliveryFee(
  subtotal: number,
  address: string | null | undefined,
  deliveryConfigured: boolean,
  addressNumber: string | null | undefined,
  quotedFee = 0
) {
  if (
    subtotal <= 0 ||
    !address?.trim() ||
    !addressNumber?.trim() ||
    !deliveryConfigured
  )
    return 0;
  if (!Number.isFinite(quotedFee) || quotedFee < 0) return 0;
  return Math.round(quotedFee * 100) / 100;
}
