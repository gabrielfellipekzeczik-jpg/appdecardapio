import { useMemo, useState } from "react";
import { CircleAlert, History, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductionPlanner } from "@/components/ProductionPlanner";
import { trpc } from "@/lib/trpc";
import { compatibleUnits, convertQuantity } from "@shared/production-plan";

const STOCK_UNITS = ["kg", "g", "L", "ml", "un", "cx", "pct"] as const;
type StockUnit = (typeof STOCK_UNITS)[number];
type StockItem = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: number | string;
  minimumQuantity: number | string;
  costPerUnit: number | string;
};

const toNumber = (value: number | string | null | undefined) =>
  Number(value ?? 0) || 0;
const parseNumber = (value: string) => Number(value.replace(",", "."));
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );
const amount = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
const sameName = (first: string, second: string) =>
  first.trim().toLocaleLowerCase("pt-BR") ===
  second.trim().toLocaleLowerCase("pt-BR");

/** Estoque e produção na mesma tela: o que tenho, o que vou fazer e o que falta comprar. */
export function InventoryManager({ slug }: { slug: string }) {
  const itemsQuery = trpc.inventory.list.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const items = (itemsQuery.data ?? []) as StockItem[];
  const [editing, setEditing] = useState<StockItem | null>(null);

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            1. O que eu tenho
          </CardTitle>
          <p className="text-sm text-[#776e63]">
            Comprou ou contou algo? Escreva aqui. Se o ingrediente já existir, a
            quantidade é somada.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddStockForm items={items} />
          {itemsQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[#edf0eb]" />
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e5e0d7] p-5 text-center text-sm text-[#776e63]">
              Seu estoque está vazio. Comece por algo como 5 kg de arroz.
            </p>
          ) : (
            <ul className="divide-y divide-[#eeeae3]">
              {items.map(item => {
                const quantity = toNumber(item.currentQuantity);
                const minimum = toNumber(item.minimumQuantity);
                const cost = toNumber(item.costPerUnit);
                const low = minimum > 0 && quantity <= minimum;
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-xs text-[#776e63]">
                        {cost > 0
                          ? `${money(cost)} por ${item.unit}`
                          : "Sem preço informado"}
                      </p>
                      {low && (
                        <p className="flex items-center gap-1 text-xs font-semibold text-[#a05c32]">
                          <CircleAlert className="h-3 w-3" /> Está acabando
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-right font-display text-lg font-bold">
                      {amount(quantity)} {item.unit}
                    </p>
                    <button
                      type="button"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => setEditing(item)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#776e63] hover:bg-[#f1ece3]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <MovementHistory />
        </CardContent>
      </Card>

      <ProductionPlanner slug={slug} />

      {editing && (
        <EditItemDialog item={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function AddStockForm({ items }: { items: StockItem[] }) {
  const utils = trpc.useUtils();
  const createItem = trpc.inventory.createItem.useMutation();
  const recordMovement = trpc.inventory.recordMovement.useMutation();
  const updateItem = trpc.inventory.updateItem.useMutation();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>("kg");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = useMemo(
    () => items.find(item => sameName(item.name, name)),
    [items, name]
  );
  const unitOptions: readonly string[] = existing
    ? compatibleUnits(existing.unit)
    : STOCK_UNITS;
  const selectedUnit = unitOptions.includes(unit)
    ? unit
    : (existing?.unit ?? unit);
  const value = parseNumber(quantity);
  const canSubmit = name.trim().length >= 2 && value > 0 && !busy;

  const submit = async () => {
    const paidValue = paid.trim() ? parseNumber(paid) : 0;
    if (!Number.isFinite(paidValue) || paidValue < 0) {
      toast.error("Confira o valor pago.");
      return;
    }
    setBusy(true);
    try {
      const item =
        existing ??
        (await createItem.mutateAsync({
          name: name.trim(),
          unit: selectedUnit as StockUnit,
          minimumQuantity: 0,
          costPerUnit: 0,
        }));
      const stockQuantity = convertQuantity(value, selectedUnit, item.unit);
      await recordMovement.mutateAsync({
        itemId: item.id,
        type: "in",
        quantity: stockQuantity,
        reason: "Entrada no estoque",
      });
      if (paidValue > 0)
        await updateItem.mutateAsync({
          itemId: item.id,
          costPerUnit: Math.round((paidValue / stockQuantity) * 100) / 100,
        });
      toast.success(`${amount(value)} ${selectedUnit} de ${item.name} no estoque.`);
      setName("");
      setQuantity("");
      setPaid("");
      await Promise.all([
        utils.inventory.list.invalidate(),
        utils.inventory.movements.invalidate(),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (canSubmit) void submit();
      }}
      className="grid grid-cols-2 gap-2 rounded-xl bg-[#f8f6f1] p-3 sm:grid-cols-[minmax(0,1.6fr)_90px_90px_minmax(0,1fr)_auto] sm:items-end"
    >
      <label className="col-span-2 text-xs font-semibold sm:col-span-1">
        Ingrediente
        <Input
          value={name}
          onChange={event => setName(event.target.value)}
          list="stock-item-names"
          placeholder="Ex.: Arroz"
          className="mt-1 h-11 rounded-xl bg-white text-base"
        />
        <datalist id="stock-item-names">
          {items.map(item => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </label>
      <label className="text-xs font-semibold">
        Quantidade
        <Input
          value={quantity}
          onChange={event => setQuantity(event.target.value)}
          inputMode="decimal"
          placeholder="5"
          className="mt-1 h-11 rounded-xl bg-white text-base"
        />
      </label>
      <label className="text-xs font-semibold">
        Unidade
        <select
          value={selectedUnit}
          onChange={event => setUnit(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-[#e5e0d7] bg-white px-2 text-base"
        >
          {unitOptions.map(option => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="col-span-2 text-xs font-semibold sm:col-span-1">
        Quanto pagou no total (opcional)
        <Input
          value={paid}
          onChange={event => setPaid(event.target.value)}
          inputMode="decimal"
          placeholder="R$ 30,00"
          className="mt-1 h-11 rounded-xl bg-white text-base"
        />
      </label>
      <Button
        type="submit"
        disabled={!canSubmit}
        className="col-span-2 h-11 rounded-xl bg-[#2f5d50] text-white sm:col-span-1"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {busy ? "Salvando…" : "Adicionar"}
      </Button>
    </form>
  );
}

function EditItemDialog({
  item,
  onClose,
}: {
  item: StockItem;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const recordMovement = trpc.inventory.recordMovement.useMutation();
  const updateItem = trpc.inventory.updateItem.useMutation();
  const text = (value: number) => String(value).replace(".", ",");
  const [quantity, setQuantity] = useState(text(toNumber(item.currentQuantity)));
  const [cost, setCost] = useState(text(toNumber(item.costPerUnit)));
  const [minimum, setMinimum] = useState(text(toNumber(item.minimumQuantity)));
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    Promise.all([
      utils.inventory.list.invalidate(),
      utils.inventory.movements.invalidate(),
    ]);

  const save = async () => {
    const nextQuantity = parseNumber(quantity);
    const nextCost = parseNumber(cost);
    const nextMinimum = parseNumber(minimum);
    if (![nextQuantity, nextCost, nextMinimum].every(v => v >= 0)) {
      toast.error("Use apenas números iguais ou maiores que zero.");
      return;
    }
    setBusy(true);
    try {
      if (nextQuantity !== toNumber(item.currentQuantity))
        await recordMovement.mutateAsync({
          itemId: item.id,
          type: "adjustment",
          quantity: nextQuantity,
          reason: "Correção manual",
        });
      await updateItem.mutateAsync({
        itemId: item.id,
        costPerUnit: nextCost,
        minimumQuantity: nextMinimum,
      });
      await refresh();
      toast.success("Ingrediente atualizado.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await updateItem.mutateAsync({ itemId: item.id, active: false });
      await refresh();
      toast.success(`${item.name} saiu do estoque.`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível remover."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{item.name}</DialogTitle>
          <DialogDescription>
            Corrija o que está errado. Para somar uma compra, use o campo do
            passo 1.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-semibold">
            Quanto tem agora ({item.unit})
            <Input
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
              inputMode="decimal"
              className="mt-1 h-11 rounded-xl text-base"
            />
          </label>
          <label className="block text-sm font-semibold">
            Preço por {item.unit} (R$)
            <Input
              value={cost}
              onChange={event => setCost(event.target.value)}
              inputMode="decimal"
              className="mt-1 h-11 rounded-xl text-base"
            />
          </label>
          <label className="block text-sm font-semibold">
            Avisar quando tiver menos de ({item.unit})
            <Input
              value={minimum}
              onChange={event => setMinimum(event.target.value)}
              inputMode="decimal"
              className="mt-1 h-11 rounded-xl text-base"
            />
          </label>
          <Button
            onClick={save}
            disabled={busy}
            className="h-11 w-full rounded-xl bg-[#2f5d50] text-white"
          >
            Salvar
          </Button>
          <Button
            variant="ghost"
            onClick={remove}
            disabled={busy}
            className="h-11 w-full rounded-xl text-[#a05c32]"
          >
            Remover do estoque
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementHistory() {
  const [open, setOpen] = useState(false);
  const movements = trpc.inventory.movements.useQuery(
    { limit: 30 },
    { enabled: open }
  );
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex h-11 items-center gap-1.5 text-sm font-semibold text-[#526d58]"
      >
        <History className="h-4 w-4" />
        {open ? "Esconder histórico" : "Ver histórico"}
      </button>
      {open && (
        <ul className="divide-y divide-[#eeeae3] text-sm">
          {(movements.data ?? []).length === 0 && (
            <li className="py-2 text-[#776e63]">Nada registrado ainda.</li>
          )}
          {(movements.data ?? []).map(movement => {
            const entry = movement as Record<string, unknown>;
            const label =
              entry.type === "in"
                ? "Entrou"
                : entry.type === "out"
                  ? "Saiu"
                  : "Corrigido para";
            return (
              <li key={String(entry.id)} className="py-2">
                <span className="font-semibold">{String(entry.itemName)}</span>
                {" · "}
                {label} {amount(toNumber(entry.quantity as string))}{" "}
                {String(entry.unit)}
                <span className="block text-xs text-[#776e63]">
                  {new Date(String(entry.occurredAt)).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {String(entry.reason)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
