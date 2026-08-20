export type DeliveryProvider = "uber_direct" | "99entrega";
export type MessagingChannel = "whatsapp" | "sms";

export function buildTrackingMessage(channel: MessagingChannel, trackingUrl: string) {
  const prefix = channel === "whatsapp" ? "WhatsApp" : "SMS";
  return `${prefix}: acompanhe sua entrega da Casa na Marmita em ${trackingUrl}`;
}

export function unavailableDeliveryResponse(provider: DeliveryProvider, reason?: string) {
  return {
    provider,
    available: false as const,
    trackingUrl: null,
    reason: reason ?? "Cadastre as credenciais no Super Admin para ativar o despacho automático.",
  };
}
