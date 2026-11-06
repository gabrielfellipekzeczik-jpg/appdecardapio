import { Check, ChefHat, MapPin, PackageCheck, ShieldCheck, Truck, Utensils, XCircle } from "lucide-react";

export type TrackingData = {
  orderId: number;
  companyName: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  pickup?: boolean;
  trackingUrl?: string | null;
  location?: { latitude: number; longitude: number; updatedAt: string | null } | null;
  deliveryCode?: string | null;
};

const STEPS = [
  { key: "received", label: "Pedido recebido", hint: "A loja recebeu seu pedido.", icon: PackageCheck },
  { key: "preparing", label: "Em preparo", hint: "Sua refeição está sendo preparada.", icon: ChefHat },
  { key: "ready", label: "Aguardando entrega", hint: "Seu pedido está pronto e aguardando o entregador sair.", icon: Utensils },
  { key: "out_for_delivery", label: "Saiu para entrega", hint: "O motoboy está a caminho.", icon: Truck },
  { key: "delivered", label: "Entregue", hint: "Bom apetite!", icon: Check },
] as const;

const PICKUP_STEPS = [
  STEPS[0],
  STEPS[1],
  { key: "ready", label: "Pronto para retirar", hint: "Seu pedido está esperando por você na loja.", icon: Utensils },
  { key: "delivered", label: "Retirado", hint: "Bom apetite!", icon: Check },
] as const;

function osmEmbed(latitude: number, longitude: number) {
  const d = 0.009;
  const bbox = `${longitude - d}%2C${latitude - d}%2C${longitude + d}%2C${latitude + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function OrderTrackingView({ tracking }: { tracking: TrackingData }) {
  const cancelled = tracking.status === "cancelled";
  const steps = tracking.pickup ? PICKUP_STEPS : STEPS;
  const current = Math.max(0, steps.findIndex(step => step.key === tracking.status));
  const step = steps[current];
  const showMap = tracking.status === "out_for_delivery" || (tracking.status === "ready" && tracking.location);
  const map = tracking.location && showMap ? osmEmbed(tracking.location.latitude, tracking.location.longitude) : null;
  const payOnDelivery = tracking.paymentMethod === "cash_on_delivery";
  const unpaid = !payOnDelivery && tracking.paymentStatus !== "approved";

  return (
    <div className="space-y-3">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#859084]">
          {tracking.companyName} · Pedido #{tracking.orderId}
        </p>
        {cancelled ? (
          <div className="mt-3 flex items-center gap-3 text-red-600">
            <XCircle className="h-8 w-8" />
            <p className="text-lg font-bold">Pedido cancelado</p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e2f1e7] text-[#347052]">
                <step.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-xl font-bold leading-tight">{step.label}</p>
                <p className="text-sm text-[#737a73]">{step.hint}</p>
              </div>
            </div>
            {unpaid && (
              <p className="mt-3 rounded-xl bg-[#fff6e8] px-3 py-2 text-xs text-[#9b6a2d]">
                Aguardando a confirmação do pagamento.
              </p>
            )}
            {payOnDelivery && tracking.paymentStatus !== "approved" && (
              <p className="mt-3 rounded-xl bg-[#fff6e8] px-3 py-2 text-xs text-[#9b6a2d]">
                Pagamento na {tracking.pickup ? "retirada" : "entrega"}, em dinheiro ou maquininha.
              </p>
            )}
            <ol className="mt-5 space-y-0">
              {steps.map((s, index) => {
                const done = index < current || tracking.status === "delivered";
                const active = index === current && tracking.status !== "delivered";
                return (
                  <li key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full border-2 text-white ${
                          done
                            ? "border-[#347052] bg-[#347052]"
                            : active
                              ? "border-[#347052] bg-white"
                              : "border-[#dfe5dc] bg-white"
                        }`}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : active ? (
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#347052]" />
                        ) : null}
                      </span>
                      {index < steps.length - 1 && (
                        <span className={`h-6 w-0.5 ${done ? "bg-[#347052]" : "bg-[#e6ebe4]"}`} />
                      )}
                    </div>
                    <p
                      className={`pb-4 text-sm ${
                        active ? "font-bold text-[#252a26]" : done ? "text-[#4d5a4f]" : "text-[#a3aaa2]"
                      }`}
                    >
                      {s.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {!cancelled && showMap && (
        <section className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Localização do motoboy</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2f1e7] px-3 py-1 text-xs font-semibold text-[#347052]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4d9360]" /> Ao vivo
            </span>
          </div>
          {map ? (
            <iframe title="Mapa da entrega" src={map} className="mt-3 h-72 w-full rounded-2xl border-0" loading="lazy" />
          ) : (
            <div className="mt-3 grid h-40 place-items-center rounded-2xl bg-[#f6f7f4] px-6 text-center">
              <div>
                <MapPin className="mx-auto h-7 w-7 text-[#849286]" />
                <p className="mt-2 text-sm font-medium">Aguardando o motoboy ligar o GPS</p>
              </div>
            </div>
          )}
          {tracking.trackingUrl && (
            <a href={tracking.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#2f5d50] underline">
              Abrir rastreamento do entregador
            </a>
          )}
        </section>
      )}

      {!cancelled && tracking.deliveryCode && tracking.status !== "delivered" && (
        <section className="rounded-3xl border border-[#dfe8dc] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[#3f7653]" />
            <div>
              <p className="font-semibold">Código para confirmar a entrega</p>
              <p className="mt-1 text-sm text-[#737a73]">Informe ao motoboy somente ao receber o pedido.</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.4em] text-[#2f5d50]">{tracking.deliveryCode}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
