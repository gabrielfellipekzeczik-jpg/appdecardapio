import { useState } from "react";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  MAX_LOSS_PERCENT,
  compatibleUnits,
  convertQuantity,
} from "@shared/production-plan";

const STOCK_UNITS = ["kg", "g", "L", "ml", "un", "cx", "pct"] as const;
type StockUnit = (typeof STOCK_UNITS)[number];

export type RecipeDraftLine = {
  inventoryItemId: number;
  quantity: string;
  unit: string;
  lossPercent: string;
};

type StockEntry = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: number;
};

const parseNumber = (value: string) => Number(value.replace(",", "."));
const amount = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);

export function toRecipeDraft(line: {
  inventoryItemId: number | string;
  quantity: number | string;
  unit: string;
  lossPercent: number | string | null;
}): RecipeDraftLine {
  return {
    inventoryItemId: Number(line.inventoryItemId),
    quantity: String(Number(line.quantity)).replace(".", ","),
    unit: line.unit,
    lossPercent:
      line.lossPercent === null
        ? ""
        : String(Number(line.lossPercent)).replace(".", ","),
  };
}

/** Converte o rascunho para salvar. Retorna null e avisa quando falta alguma quantidade. */
export function parseRecipeDraft(draft: RecipeDraftLine[]) {
  const lines = draft.map(line => ({
    inventoryItemId: line.inventoryItemId,
    quantity: parseNumber(line.quantity),
    unit: line.unit,
    lossPercent: line.lossPercent.trim() ? parseNumber(line.lossPercent) : null,
  }));
  const invalid = lines.some(
    line =>
      !(line.quantity > 0) ||
      (line.lossPercent !== null &&
        !(line.lossPercent >= 0 && line.lossPercent <= MAX_LOSS_PERCENT))
  );
  if (invalid) {
    toast.error(
      `Informe a quantidade de cada ingrediente. A perda vai de 0 a ${MAX_LOSS_PERCENT}%.`
    );
    return null;
  }
  return lines;
}

/** Ingredientes de 1 porção. Quem não existe no estoque é cadastrado aqui mesmo. */
export function RecipeEditor({
  lines,
  onChange,
}: {
  lines: RecipeDraftLine[];
  onChange: (lines: RecipeDraftLine[]) => void;
}) {
  const utils = trpc.useUtils();
  const stockQuery = trpc.inventory.list.useQuery();
  const createItem = trpc.inventory.createItem.useMutation();
  const recordMovement = trpc.inventory.recordMovement.useMutation();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<StockUnit>("kg");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);
  const [restocking, setRestocking] = useState<number | null>(null);

  const stock: StockEntry[] = (
    (stockQuery.data ?? []) as Record<string, unknown>[]
  ).map(item => ({
    id: Number(item.id),
    name: String(item.name),
    unit: String(item.unit),
    currentQuantity: Number(item.currentQuantity) || 0,
  }));
  const match = stock.find(
    item =>
      item.name.trim().toLocaleLowerCase("pt-BR") ===
      name.trim().toLocaleLowerCase("pt-BR")
  );

  const addLine = (item: { id: number; unit: string }) => {
    if (!lines.some(line => line.inventoryItemId === item.id))
      onChange([
        ...lines,
        {
          inventoryItemId: item.id,
          quantity: "",
          // Porção costuma ser pequena: já sugere gramas ou mililitros.
          unit: compatibleUnits(item.unit)[0],
          lossPercent: "",
        },
      ]);
    setName("");
  };
  const updateLine = (id: number, patch: Partial<RecipeDraftLine>) =>
    onChange(
      lines.map(line =>
        line.inventoryItemId === id ? { ...line, ...patch } : line
      )
    );

  const registerIngredient = async () => {
    const cost = price.trim() ? parseNumber(price) : 0;
    const quantity = initial.trim() ? parseNumber(initial) : 0;
    if (!(cost >= 0) || !(quantity >= 0)) {
      toast.error("Confira o preço e a quantidade.");
      return;
    }
    setBusy(true);
    try {
      const item = await createItem.mutateAsync({
        name: name.trim(),
        unit,
        minimumQuantity: 0,
        costPerUnit: cost,
        lastSupplier: supplier.trim() || undefined,
      });
      if (quantity > 0)
        await recordMovement.mutateAsync({
          itemId: item.id,
          type: "in",
          quantity,
          reason: "Saldo inicial",
        });
      await utils.inventory.list.invalidate();
      addLine({ id: item.id, unit });
      setPrice("");
      setSupplier("");
      setInitial("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível cadastrar."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {lines.map(line => {
        const item = stock.find(entry => entry.id === line.inventoryItemId);
        const empty = item && item.currentQuantity <= 0;
        return (
          <div
            key={line.inventoryItemId}
            className="rounded-xl border border-[#eeeae3] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {item?.name ?? "Ingrediente"}
                </p>
                {item && (
                  <p
                    className={`text-xs ${empty ? "font-semibold text-[#a05c32]" : "text-[#776e63]"}`}
                  >
                    {empty
                      ? "Sem estoque"
                      : `Em estoque: ${amount(item.currentQuantity)} ${item.unit}`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                {item && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={restocking === item.id}
                    onClick={() =>
                      setRestocking(current =>
                        current === item.id ? null : item.id
                      )
                    }
                    className="h-9 rounded-lg px-2 text-xs text-[#526d58]"
                  >
                    <PackagePlus className="mr-1 h-4 w-4" />
                    Estoque
                  </Button>
                )}
                <button
                  type="button"
                  aria-label={`Remover ${item?.name ?? "ingrediente"}`}
                  onClick={() =>
                    onChange(
                      lines.filter(
                        entry => entry.inventoryItemId !== line.inventoryItemId
                      )
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#a79b8d] hover:bg-[#f1ece3]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold">
                Em 1 porção
                <Input
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={event =>
                    updateLine(line.inventoryItemId, {
                      quantity: event.target.value,
                    })
                  }
                  placeholder="150"
                  className="mt-1 h-11 w-24 rounded-xl text-base"
                />
              </label>
              <select
                aria-label="Unidade"
                value={line.unit}
                onChange={event =>
                  updateLine(line.inventoryItemId, { unit: event.target.value })
                }
                className="h-11 rounded-xl border border-[#e5e0d7] bg-white px-2 text-base"
              >
                {compatibleUnits(item?.unit ?? line.unit).map(option => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <label className="text-xs font-semibold">
                Perda (%), se for diferente
                <Input
                  inputMode="decimal"
                  value={line.lossPercent}
                  onChange={event =>
                    updateLine(line.inventoryItemId, {
                      lossPercent: event.target.value,
                    })
                  }
                  placeholder="Padrão"
                  className="mt-1 h-11 w-28 rounded-xl text-base"
                />
              </label>
            </div>
            {item && restocking === item.id && (
              <RestockForm item={item} onDone={() => setRestocking(null)} />
            )}
          </div>
        );
      })}

      <div className="rounded-xl bg-[#f8f6f1] p-3">
        <label className="text-xs font-semibold">
          Adicionar ingrediente
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            list="recipe-ingredient-names"
            placeholder="Ex.: Arroz"
            className="mt-1 h-11 rounded-xl bg-white text-base"
          />
          <datalist id="recipe-ingredient-names">
            {stock.map(item => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
        </label>
        {match ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => addLine(match)}
            className="mt-2 h-11 w-full rounded-xl bg-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar {match.name}
          </Button>
        ) : (
          name.trim().length >= 2 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-semibold text-[#a05c32]">
                "{name.trim()}" não está no estoque. Cadastre agora:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">
                  Como você compra
                  <select
                    value={unit}
                    onChange={event => setUnit(event.target.value as StockUnit)}
                    className="mt-1 h-11 w-full rounded-xl border border-[#e5e0d7] bg-white px-2 text-base"
                  >
                    {STOCK_UNITS.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  Preço por {unit} (R$)
                  <Input
                    value={price}
                    onChange={event => setPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="6,00"
                    className="mt-1 h-11 rounded-xl bg-white text-base"
                  />
                </label>
                <label className="text-xs font-semibold">
                  Onde comprou por último
                  <Input
                    value={supplier}
                    onChange={event => setSupplier(event.target.value)}
                    maxLength={160}
                    placeholder="Ex.: Atacadão"
                    className="mt-1 h-11 rounded-xl bg-white text-base"
                  />
                </label>
                <label className="text-xs font-semibold">
                  Quanto tem agora ({unit})
                  <Input
                    value={initial}
                    onChange={event => setInitial(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="mt-1 h-11 rounded-xl bg-white text-base"
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={registerIngredient}
                disabled={busy}
                className="h-11 w-full rounded-xl bg-white"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {busy ? "Salvando…" : "Cadastrar e adicionar"}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RestockForm({
  item,
  onDone,
}: {
  item: StockEntry;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const recordMovement = trpc.inventory.recordMovement.useMutation();
  const updateItem = trpc.inventory.updateItem.useMutation();
  const units = compatibleUnits(item.unit);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(item.unit);
  const [paid, setPaid] = useState("");
  const [supplier, setSupplier] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = parseNumber(quantity);
    const paidValue = paid.trim() ? parseNumber(paid) : 0;
    if (!(value > 0) || !(paidValue >= 0)) {
      toast.error("Informe a quantidade.");
      return;
    }
    setBusy(true);
    try {
      const stockQuantity = convertQuantity(value, unit, item.unit);
      await recordMovement.mutateAsync({
        itemId: item.id,
        type: "in",
        quantity: stockQuantity,
        reason: "Entrada no estoque",
      });
      if (paidValue > 0 || supplier.trim())
        await updateItem.mutateAsync({
          itemId: item.id,
          ...(paidValue > 0
            ? { costPerUnit: Math.round((paidValue / stockQuantity) * 100) / 100 }
            : {}),
          ...(supplier.trim() ? { lastSupplier: supplier.trim() } : {}),
        });
      await utils.inventory.list.invalidate();
      toast.success(`${item.name} somado ao estoque.`);
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#f8f6f1] p-2.5">
      <label className="text-xs font-semibold">
        Quanto entrou
        <div className="mt-1 flex gap-1">
          <Input
            value={quantity}
            onChange={event => setQuantity(event.target.value)}
            inputMode="decimal"
            placeholder="5"
            className="h-11 min-w-0 rounded-xl bg-white text-base"
          />
          <select
            aria-label="Unidade da entrada"
            value={unit}
            onChange={event => setUnit(event.target.value)}
            className="h-11 rounded-xl border border-[#e5e0d7] bg-white px-1 text-base"
          >
            {units.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </label>
      <label className="text-xs font-semibold">
        Quanto pagou no total
        <Input
          value={paid}
          onChange={event => setPaid(event.target.value)}
          inputMode="decimal"
          placeholder="R$ 30,00"
          className="mt-1 h-11 rounded-xl bg-white text-base"
        />
      </label>
      <label className="col-span-2 text-xs font-semibold">
        Onde comprou
        <Input
          value={supplier}
          onChange={event => setSupplier(event.target.value)}
          maxLength={160}
          placeholder="Ex.: Atacadão"
          className="mt-1 h-11 rounded-xl bg-white text-base"
        />
      </label>
      <Button
        type="button"
        onClick={save}
        disabled={busy}
        className="col-span-2 h-11 rounded-xl bg-[#2f5d50] text-white"
      >
        {busy ? "Salvando…" : "Somar ao estoque"}
      </Button>
    </div>
  );
}
