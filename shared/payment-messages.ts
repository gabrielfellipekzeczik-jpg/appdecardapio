const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number:
    "Confira o número do cartão e tente de novo.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão e tente de novo.",
  cc_rejected_bad_filled_security_code:
    "Confira o código de segurança do cartão e tente de novo.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão e tente de novo.",
  cc_rejected_insufficient_amount:
    "O cartão não tem limite para esta compra. Use outro cartão ou pague com Pix.",
  cc_rejected_call_for_authorize:
    "O banco pediu autorização para esta compra. Fale com o banco ou pague com Pix.",
  cc_rejected_card_disabled:
    "Este cartão está bloqueado. Fale com o banco ou pague com Pix.",
  cc_rejected_duplicated_payment:
    "Já existe um pagamento igual a este. Confira seus pedidos antes de tentar de novo.",
  cc_rejected_invalid_installments:
    "Este cartão não aceita esse número de parcelas. Escolha outro.",
  cc_rejected_max_attempts:
    "Você atingiu o limite de tentativas. Use outro cartão ou pague com Pix.",
};

const DEFAULT_REJECTION =
  "O pagamento foi recusado. Use outro cartão ou pague com Pix.";

/** Traduz o status_detail do Mercado Pago para algo que o comprador consiga resolver. */
export function paymentRejectionMessage(statusDetail?: string | null): string {
  return REJECTION_MESSAGES[statusDetail ?? ""] ?? DEFAULT_REJECTION;
}

/** Erros técnicos do provedor não devem aparecer para o comprador. */
export function paymentFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message || /Mercado Pago|fetch|network/i.test(message))
    return "Não foi possível processar o pagamento. Confira os dados e tente de novo, ou use outra forma de pagamento.";
  return message;
}

const PAID_BEFORE_KITCHEN = ["mercadopago", "mercadopago_link"];

/** Pedido pago online (checkout ou link) só vai para a produção depois de aprovado; dinheiro segue direto. */
export function isReadyForKitchen(order: {
  paymentStatus: string;
  paymentMethod?: string | null;
}): boolean {
  return (
    !PAID_BEFORE_KITCHEN.includes(order.paymentMethod ?? "") ||
    order.paymentStatus === "approved"
  );
}
