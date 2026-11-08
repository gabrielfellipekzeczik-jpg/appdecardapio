import { MapPin, Pencil, Store, UserRound } from "lucide-react";
import type { Storefront } from "@/lib/useStorefront";

/** Mostra no carrinho os dados que vão para a entrega, com atalho para alterar. */
export function CustomerSummary({
  s,
  className,
  mutedClassName,
  accent,
}: {
  s: Storefront;
  className: string;
  mutedClassName: string;
  accent: string;
}) {
  const customer = s.customer;
  const pickup = s.fulfillment === "pickup";
  const hasData = Boolean(customer.name || customer.phone || customer.address);
  const openCheckout = () => {
    s.setCartOpen(true);
    window.setTimeout(
      () =>
        document
          .getElementById("checkout-contact")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      350
    );
  };

  return (
    <div className={`rounded-xl border p-3 text-sm ${className}`}>
      {hasData ? (
        <div className="space-y-1">
          {(customer.name || customer.phone) && (
            <p className="flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {[customer.name, customer.phone].filter(Boolean).join(" · ")}
              </span>
            </p>
          )}
          {customer.email && (
            <p className={`truncate pl-5 text-xs ${mutedClassName}`}>
              {customer.email}
            </p>
          )}
          <p className="flex items-start gap-2">
            {pickup ? (
              <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span className="line-clamp-2">
              {pickup
                ? "Retirada na loja"
                : customer.address
                  ? `${customer.address}${customer.addressNumber ? `, ${customer.addressNumber}` : ""}${customer.addressComplement ? `, ${customer.addressComplement}` : ""}`
                  : "Endereço não informado"}
            </span>
          </p>
        </div>
      ) : (
        <p className={mutedClassName}>
          Informe seus dados e o endereço de entrega.
        </p>
      )}
      <button
        type="button"
        onClick={openCheckout}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline"
        style={{ color: accent }}
      >
        <Pencil className="h-3 w-3" />
        {hasData ? "Ver ou alterar meus dados" : "Adicionar meus dados"}
      </button>
    </div>
  );
}
