import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
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
  const mutation = trpc.company.updateOrdering.useMutation({
    onSuccess: () => {
      utils.company.mine.invalidate();
      toast.success("Regras de pedido salvas.");
    },
    onError: () =>
      toast.error(
        "Não foi possível salvar. Confira se a migração 0008 foi aplicada no Supabase."
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
  }, [companyQuery.data]);

  const updateDay = (day: number, patch: Partial<DayHours>) =>
    setHours(current =>
      current.map((entry, index) =>
        index === day ? { ...entry, ...patch } : entry
      )
    );
  const pickupInvalid = pickup && pickupAddress.trim().length < 5;

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
            })
          }
          disabled={mutation.isPending || pickupInvalid}
          className="rounded-xl bg-[#2f5d50] text-white"
        >
          <Save className="mr-2 h-4 w-4" /> Salvar regras
        </Button>
      </CardContent>
    </Card>
  );
}
