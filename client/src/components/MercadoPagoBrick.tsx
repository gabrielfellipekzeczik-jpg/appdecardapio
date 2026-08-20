import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string) => {
      bricks: () => {
        create: (type: "payment", containerId: string, settings: Record<string, unknown>) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const CONTAINER_ID = "mp-payment-brick-container";

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o SDK do Mercado Pago")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o SDK do Mercado Pago"));
    document.head.appendChild(script);
  });
}

export type MercadoPagoBrickProps = {
  publicKey: string;
  amount: number;
  payerEmail: string;
  onSubmit: (formData: { payment_method_id: string; token?: string; installments?: number; issuer_id?: string; payer: { email: string } }) => Promise<void>;
  onError?: (message: string) => void;
};

/** Mounts Mercado Pago's Payment Brick (Pix/crédito/débito) inline in the checkout sheet. */
export function MercadoPagoBrick({ publicKey, amount, payerEmail, onSubmit, onError }: MercadoPagoBrickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    let brickController: { unmount: () => void } | null = null;

    loadSdk()
      .then(() => {
        if (unmounted || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey);
        return mp.bricks().create("payment", CONTAINER_ID, {
          initialization: { amount, payer: { email: payerEmail } },
          customization: {
            paymentMethods: { creditCard: "all", debitCard: "all", bankTransfer: "all" },
          },
          callbacks: {
            onReady: () => setLoading(false),
            onError: (error: unknown) => onError?.(error instanceof Error ? error.message : "Erro no pagamento"),
            onSubmit: ({ formData }: { formData: any }) => onSubmit(formData),
          },
        });
      })
      .then((controller) => { if (controller) brickController = controller; })
      .catch((error: Error) => onError?.(error.message));

    return () => {
      unmounted = true;
      brickController?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, amount, payerEmail]);

  return (
    <div>
      {loading && <p className="mb-3 text-center text-sm text-[#776e63]">Carregando pagamento seguro...</p>}
      <div id={CONTAINER_ID} ref={containerRef} />
    </div>
  );
}
