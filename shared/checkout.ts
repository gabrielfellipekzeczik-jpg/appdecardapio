export type CheckoutMode = "live" | "demo";

export function getCheckoutState(hasMercadoPagoCredentials: boolean) {
  const mode: CheckoutMode = hasMercadoPagoCredentials ? "live" : "demo";
  return {
    mode,
    paymentEnabled: mode === "live",
    title: mode === "live" ? "Pagamento seguro" : "Pagamento em demonstração",
    notice: mode === "live"
      ? "Pix, crédito ou débito via Mercado Pago."
      : "Pix, crédito e débito via Mercado Pago serão habilitados após configurar as chaves.",
    buttonLabel: mode === "live" ? "Pagar agora" : "Pagamento indisponível nesta versão",
  } as const;
}
