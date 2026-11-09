import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_DELIVERY_PRICING,
  describeDeliveryPricing,
  type DeliveryFeeMode,
} from "@shared/delivery";
import {
  DEFAULT_OPENING_HOURS,
  WEEKDAY_LABELS,
  type DayHours,
  type OpeningHours,
} from "@shared/store-rules";

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#eeeae3] p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[#2f5d50]"
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-[#776e63]">{hint}</span>
      </span>
    </label>
  );
}

/** Horário de funcionamento e formas de receber o pedido, exibidos na loja e conferidos no servidor. */
export function OrderingSettingsCard() {
  const companyQuery = trpc.company.mine.useQuery();
  const utils = trpc.useUtils();
  const [useHours, setUseHours] = useState(false);
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [cash, setCash] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [baseFee, setBaseFee] = useState("");
  const [includedKm, setIncludedKm] = useState("");
  const [pricePerKm, setPricePerKm] = useState("");
  const [maxKm, setMaxKm] = useState("");
  const [feeMode, setFeeMode] = useState<DeliveryFeeMode>("calculated");
  const [fixedFee, setFixedFee] = useState("");
  const [freeKm, setFreeKm] = useState("");
  const mutation = trpc.company.updateOrdering.useMutation({
    onSuccess: () => {
      utils.company.mine.invalidate();
      toast.success("Regras de pedido salvas.");
    },
    onError: () =>
      toast.error(
        "Não foi possível salvar. Tente de novo em instantes."
      ),
  });

  useEffect(() => {
    const company = companyQuery.data;
    if (!company) return;
    setUseHours(Boolean(company.openingHours));
    setHours(company.openingHours ?? DEFAULT_OPENING_HOURS);
    setCash(Boolean(company.acceptsCashOnDelivery));
    setPickup(Boolean(company.pickupEnabled));
    setPickupAddress(company.pickupAddress ?? "");
    const text = (value: unknown, fallback: number) =>
      String(value ?? fallback).replace(".", ",");
    const defaults = DEFAULT_DELIVERY_PRICING;
    setBaseFee(text(company.deliveryBaseFee, defaults.baseFee));
    setIncludedKm(text(company.deliveryIncludedKm, defaults.includedKm));
    setPricePerKm(text(company.deliveryPricePerKm, defaults.pricePerKm));
    setMaxKm(text(company.deliveryMaxKm, defaults.maxKm));
    setFeeMode(company.deliveryFeeMode === "fixed" ? "fixed" : "calculated");
    setFixedFee(text(company.deliveryFixedFee, defaults.fixedFee));
    setFreeKm(text(company.deliveryFreeKm, defaults.freeUpToKm));
  }, [companyQuery.data]);

  const updateDay = (day: number, patch: Partial<DayHours>) =>
    setHours(current =>
      current.map((entry, index) =>
        index === day ? { ...entry, ...patch } : entry
      )
    );
  const pickupInvalid = pickup && pickupAddress.trim().length < 5;
  const parse = (value: string) => Number(value.replace(",", "."));
  const pricingValues = [baseFee, includedKm, pricePerKm, maxKm, fixedFee, freeKm].map(parse);
  const pricingInvalid =
    pricingValues.some(value => !(value >= 0)) || !(parse(maxKm) > 0);
  const preview = pricingInvalid
    ? null
    : describeDeliveryPricing({
        mode: feeMode,
        fixedFee: parse(fixedFee),
        freeUpToKm: parse(freeKm),
        baseFee: parse(baseFee),
        includedKm: parse(includedKm),
        pricePerKm: parse(pricePerKm),
        maxKm: parse(maxKm),
      });
  const numberField = (
    label: string,
    value: string,
    setValue: (value: string) => void,
    hint?: string
  ) => (
    <label key={label} className="text-xs font-semibold">
      {label}
      <Input
        inputMode="decimal"
        value={value}
        onChange={event => setValue(event.target.value)}
        className="mt-1"
      />
      {hint && <span className="mt-0.5 block font-normal text-[#a79b8d]">{hint}</span>}
    </label>
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-xl">Regras de pedido</CardTitle>
        <p className="mt-1 text-sm text-[#776e63]">
          Quando sua loja vende e como o cliente recebe e paga.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Toggle
          checked={cash}
          onChange={setCash}
          title="Aceitar pagamento na entrega ou retirada"
          hint="Dinheiro ou maquininha. O pedido vai para a cozinha sem pagamento antecipado."
        />
        <Toggle
          checked={pickup}
          onChange={setPickup}
          title="Permitir retirada na loja"
          hint="O cliente escolhe retirar e não paga taxa de entrega."
        />
        {pickup && (
          <div>
            <label className="field-label">Endereço de retirada</label>
            <Input
              value={pickupAddress}
              onChange={event => setPickupAddress(event.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>
        )}
        <div className="rounded-xl border border-[#eeeae3] p-3">
          <p className="text-sm font-semibold">Taxa de entrega</p>
          <p className="text-xs text-[#776e63]">
            A distância é medida pela rua, da loja (endereço de retirada) até o
            cliente.
          </p>
          <div
            role="radiogroup"
            aria-label="Como cobrar a entrega"
            className="mt-3 grid grid-cols-2 gap-2"
          >
            {(
              [
                ["calculated", "Calculada pela distância", "Mínimo + valor por km extra"],
                ["fixed", "Valor fixo", "O mesmo valor para qualquer distância"],
              ] as const
            ).map(([mode, title, hint]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={feeMode === mode}
                onClick={() => setFeeMode(mode)}
                className={`rounded-xl border p-3 text-left transition ${
                  feeMode === mode
                    ? "border-[#2f5d50] bg-[#eef4f0]"
                    : "border-[#eeeae3] hover:border-[#cfc8bc]"
                }`}
              >
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-[#776e63]">{hint}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {feeMode === "calculated" ? (
              <>
                {numberField("Taxa mínima (R$)", baseFee, setBaseFee)}
                {numberField("Incluso até (km)", includedKm, setIncludedKm)}
                {numberField("Por km extra (R$)", pricePerKm, setPricePerKm)}
              </>
            ) : (
              numberField("Valor da entrega (R$)", fixedFee, setFixedFee)
            )}
            {numberField("Grátis até (km)", freeKm, setFreeKm, "0 = sem entrega grátis")}
            {numberField("Entrega até (km)", maxKm, setMaxKm)}
          </div>
          {feeMode === "calculated" && (
            <p className="mt-2 text-xs text-[#a79b8d]">
              Valores iniciais: referência do que o iFood paga ao entregador de
              moto. Ajuste para a sua região.
            </p>
          )}
          {preview && (
            <p className="mt-2 rounded-lg bg-[#f8faf7] p-2 text-xs text-[#414941]">
              O cliente vê: {preview}
            </p>
          )}
        </div>
        <Toggle
          checked={useHours}
          onChange={setUseHours}
          title="Usar horário de funcionamento"
          hint="Fora do horário a loja mostra quando abre e não aceita pedidos."
        />
        {useHours && (
          <div className="space-y-2">
            {DISPLAY_ORDER.map(day => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hours[day].enabled}
                    onChange={event =>
                      updateDay(day, { enabled: event.target.checked })
                    }
                    className="h-4 w-4 accent-[#2f5d50]"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
                <Input
                  type="time"
                  aria-label={`Abertura de ${WEEKDAY_LABELS[day]}`}
                  value={hours[day].open}
                  disabled={!hours[day].enabled}
                  onChange={event =>
                    updateDay(day, { open: event.target.value })
                  }
                  className="w-28"
                />
                <span className="text-xs text-[#776e63]">até</span>
                <Input
                  type="time"
                  aria-label={`Fechamento de ${WEEKDAY_LABELS[day]}`}
                  value={hours[day].close}
                  disabled={!hours[day].enabled}
                  onChange={event =>
                    updateDay(day, { close: event.target.value })
                  }
                  className="w-28"
                />
              </div>
            ))}
          </div>
        )}
        <Button
          onClick={() =>
            mutation.mutate({
              openingHours: useHours ? hours : null,
              acceptsCashOnDelivery: cash,
              pickupEnabled: pickup,
              ...(pickupAddress.trim().length >= 5
                ? { pickupAddress: pickupAddress.trim() }
                : {}),
              deliveryBaseFee: parse(baseFee),
              deliveryIncludedKm: parse(includedKm),
              deliveryPricePerKm: parse(pricePerKm),
              deliveryMaxKm: parse(maxKm),
              deliveryFeeMode: feeMode,
              deliveryFixedFee: parse(fixedFee),
              deliveryFreeKm: parse(freeKm),
            })
          }
          disabled={mutation.isPending || pickupInvalid || pricingInvalid}
          className="rounded-xl bg-[#2f5d50] text-white"
        >
          <Save className="mr-2 h-4 w-4" /> Salvar regras
        </Button>
      </CardContent>
    </Card>
  );
}
