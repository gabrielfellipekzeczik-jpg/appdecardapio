export type CheckoutMode = "live" | "unavailable";

export function getCheckoutState(hasMercadoPagoCredentials: boolean) {
  const mode: CheckoutMode = hasMercadoPagoCredentials ? "live" : "unavailable";
  return {
    mode,
    paymentEnabled: mode === "live",
    title: mode === "live" ? "Pagamento seguro" : "Pagamento indisponível",
    notice: mode === "live"
      ? "Pix, crédito ou débito via Mercado Pago."
      : "O Mercado Pago ainda não foi configurado para esta loja.",
    buttonLabel: mode === "live" ? "Pagar agora" : "Pagamento indisponível",
  } as const;
}
