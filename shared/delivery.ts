export type DeliveryProvider = "uber_direct" | "lalamove" | "own_courier" | "99entrega";
export type MessagingChannel = "whatsapp" | "sms";

export function buildTrackingMessage(channel: MessagingChannel, companyName: string, trackingUrl: string) {
  const prefix = channel === "whatsapp" ? "WhatsApp" : "SMS";
  return `${prefix}: acompanhe sua entrega de ${companyName} em ${trackingUrl}`;
}

export function unavailableDeliveryResponse(provider: DeliveryProvider, reason?: string) {
  return {
    provider,
    available: false as const,
    trackingUrl: null,
    reason: reason ?? "Conecte um provedor de entrega em Integrações para ativar o despacho automático.",
  };
}
