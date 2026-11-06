import { useEffect, useState } from "react";
import { Check, Clock3, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PendingPayment } from "@/lib/useStorefront";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

function useSecondsLeft(expiresAt: number | null) {
  const secondsLeft = () =>
    expiresAt === null
      ? null
      : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(secondsLeft);
  useEffect(() => {
    setSeconds(secondsLeft());
    if (expiresAt === null) return;
    const timer = window.setInterval(() => setSeconds(secondsLeft()), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return seconds;
}

type Props = {
  payment: PendingPayment;
  accent: string;
  changing: boolean;
  trackingHref: string | null;
  onChangeMethod: () => void;
  onExpandQr: () => void;
};

/** Tela única de "pagamento em aberto": substitui o formulário para o cliente não editar um pedido já cobrado. */
export function PendingPaymentPanel({
  payment,
  accent,
  changing,
  trackingHref,
  onChangeMethod,
  onExpandQr,
}: Props) {
  const seconds = useSecondsLeft(payment.expiresAt);
  const [copied, setCopied] = useState(false);
  const expired = seconds === 0;

  const copy = async () => {
    if (!payment.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar. Leia o QR code em outro aparelho.");
    }
  };

  if (payment.kind === "review")
    return (
      <main className="mx-auto w-full max-w-md px-4 py-8">
        <section className="rounded-3xl border border-[#e4e8e1] bg-white p-6 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff6e8] text-[#9b6a2d]">
            <Clock3 className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">
            Pagamento em análise
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#737a73]">
            O Mercado Pago está analisando seu pagamento de{" "}
            {money(payment.total)}. Esta tela atualiza sozinha, e a loja só
            começa o preparo depois da aprovação.
          </p>
          {trackingHref && (
            <a
              href={trackingHref}
              className="mt-4 inline-block text-sm font-semibold text-[#3e5e49] underline"
            >
              Acompanhar pedido
            </a>
          )}
        </section>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <section className="rounded-3xl border border-[#e4e8e1] bg-white p-5 text-center shadow-sm sm:p-6">
        {expired ? (
          <>
            <h1 className="font-display text-2xl font-bold">Este Pix expirou</h1>
            <p className="mt-2 text-sm leading-6 text-[#737a73]">
              Nada foi cobrado. Gere um novo pagamento para concluir seu pedido.
            </p>
            <Button
              type="button"
              onClick={onChangeMethod}
              disabled={changing}
              className="mt-5 h-12 w-full rounded-xl text-base font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {changing ? "Aguarde…" : "Gerar novo pagamento"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[#737a73]">
              Pague com Pix para confirmar
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-[#2f5d50]">
              {money(payment.total)}
            </p>
            {seconds !== null && (
              <p className="mt-1 text-xs text-[#788078]">
                Expira em {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </p>
            )}
            {payment.copyPaste && (
              <Button
                type="button"
                onClick={copy}
                className="mt-4 h-12 w-full rounded-xl text-base font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Código copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copiar código Pix
                  </>
                )}
              </Button>
            )}
            <p className="mt-2 text-xs leading-5 text-[#737a73]">
              Abra o app do banco, escolha Pix copia e cola e cole o código.
            </p>
            {payment.qrCode && (
              <button
                type="button"
                onClick={onExpandQr}
                aria-label="Ampliar QR code Pix"
                className="mt-4 block w-full"
              >
                <img
                  src={`data:image/png;base64,${payment.qrCode}`}
                  alt="QR code Pix"
                  className="mx-auto h-40 w-40 rounded-xl border border-[#e8ebe5]"
                />
                <span className="mt-1 block text-xs text-[#788078]">
                  Pagando em outro aparelho? Leia o QR code.
                </span>
              </button>
            )}
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#788078]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#d9a441]" />
              Aguardando pagamento. Esta tela atualiza sozinha.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={onChangeMethod}
              disabled={changing}
              className="mt-2 w-full rounded-xl text-sm text-[#526d58]"
            >
              {changing ? "Aguarde…" : "Trocar forma de pagamento"}
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
