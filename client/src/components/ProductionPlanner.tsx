import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  ClipboardCopy,
  Download,
  MessageCircle,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import {
  MAX_LOSS_PERCENT,
  buildProductionPlan,
  compatibleUnits,
  type PlanStockItem,
  type RecipeLine,
  type ShoppingLine,
} from "@shared/production-plan";

const STOCK_UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct"] as const;
type StockUnit = (typeof STOCK_UNITS)[number];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );
const amount = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
const parseNumber = (value: string) => Number(value.replace(",", "."));
const planKey = (slug: string) => `marmitaria-production-plan-${slug}`;

type SavedPlan = {
  portions: Record<number, string>;
  loss: string;
  keepMinimum: boolean;
};

function readPlan(slug: string): SavedPlan {
  try {
    return {
      portions: {},
      loss: "10",
      keepMinimum: false,
      ...JSON.parse(localStorage.getItem(planKey(slug)) ?? "{}"),
    };
  } catch {
    return { portions: {}, loss: "10", keepMinimum: false };
  }
}

function listAsText(lines: ShoppingLine[]) {
  return [
    "Lista de compras",
    ...lines.map(line => `- ${line.name}: ${amount(line.toBuy)} ${line.unit}`),
  ].join("\n");
}

function downloadCsv(lines: ShoppingLine[]) {
  const rows = [
    ["Insumo", "Unidade", "Necessário", "Em estoque", "Comprar", "Custo estimado"],
    ...lines.map(line => [
      line.name,
      line.unit,
      amount(line.needed),
      amount(line.inStock),
      amount(line.toBuy),
      line.hasCost ? line.estimatedCost.toFixed(2).replace(".", ",") : "",
    ]),
  ];
  const csv = rows
    .map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "lista-de-compras.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Cardápio planejado vira insumos necessários, com perda, e o que falta comprar. */
export function ProductionPlanner({ slug }: { slug: string }) {
  const menuQuery = trpc.adminMenu.list.useQuery();
  const stockQuery = trpc.inventory.list.useQuery();
  const recipesQuery = trpc.recipes.list.useQuery(undefined, { retry: false });
  const [saved] = useState(() => readPlan(slug));
  const [portions, setPortions] = useState(saved.portions);
  const [loss, setLoss] = useState(saved.loss);
  const [keepMinimum, setKeepMinimum] = useState(saved.keepMinimum);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        planKey(slug),
        JSON.stringify({ portions, loss, keepMinimum })
      );
    } catch {
      // Sem armazenamento: o plano só não fica salvo para a próxima visita.
    }
  }, [slug, portions, loss, keepMinimum]);

  const dishes = (menuQuery.data ?? []).filter(item => item.active);
  const stock: PlanStockItem[] = useMemo(
    () =>
      ((stockQuery.data ?? []) as Record<string, unknown>[]).map(item => ({
        id: Number(item.id),
        name: String(item.name),
        unit: String(item.unit),
        currentQuantity: Number(item.currentQuantity) || 0,
        minimumQuantity: Number(item.minimumQuantity) || 0,
        costPerUnit: Number(item.costPerUnit) || 0,
      })),
    [stockQuery.data]
  );
  const recipes: RecipeLine[] = useMemo(
    () =>
      (recipesQuery.data ?? []).map(line => ({
        menuItemId: Number(line.menuItemId),
        inventoryItemId: Number(line.inventoryItemId),
        quantity: Number(line.quantity),
        unit: String(line.unit),
        lossPercent:
          line.lossPercent === null ? null : Number(line.lossPercent),
      })),
    [recipesQuery.data]
  );
  const lossPercent = Math.min(
    MAX_LOSS_PERCENT,
    Math.max(0, parseNumber(loss) || 0)
  );
  const plan = useMemo(
    () =>
      buildProductionPlan({
        dishes: dishes.map(dish => ({
          menuItemId: dish.id,
          name: dish.name,
          portions: Math.max(0, parseNumber(portions[dish.id] ?? "") || 0),
        })),
        recipes,
        stock,
        defaultLossPercent: lossPercent,
        keepMinimumStock: keepMinimum,
      }),
    [dishes, recipes, stock, portions, lossPercent, keepMinimum]
  );

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(listAsText(plan.shoppingList));
      toast.success("Lista de compras copiada.");
    } catch {
      toast.error("Não foi possível copiar a lista.");
    }
  };

  if (recipesQuery.isError)
    return (
      <Card className="rounded-2xl border-[#f0ddc5] bg-[#fffaf3]">
        <CardContent className="p-5 text-sm text-[#7e4c2d]">
          Não foi possível abrir as fichas técnicas. Confira se a migração
          0009_recipe_ingredients foi aplicada no Supabase.
        </CardContent>
      </Card>
    );

  const hasPlan = plan.lines.length > 0;
  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
        <CardHeader>
          <CardTitle className="font-display text-lg">
            O que você vai produzir
          </CardTitle>
          <p className="text-sm text-[#776e63]">
            Informe as porções de cada prato. Pratos sem ficha técnica não
            entram na conta.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {dishes.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#e5e0d7] p-5 text-center text-sm text-[#776e63]">
              Cadastre pratos na aba Cardápio para planejar a produção.
            </p>
          )}
          <div className="divide-y divide-[#eeeae3]">
            {dishes.map(dish => {
              const count = recipes.filter(
                line => line.menuItemId === dish.id
              ).length;
              return (
                <div
                  key={dish.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-semibold">{dish.name}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ id: dish.id, name: dish.name })
                      }
                      className={`text-xs font-semibold underline ${count ? "text-[#526d58]" : "text-[#a05c32]"}`}
                    >
                      {count
                        ? `Ficha técnica · ${count} ${count === 1 ? "insumo" : "insumos"}`
                        : "Montar ficha técnica"}
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#776e63]">
                    Porções
                    <Input
                      inputMode="numeric"
                      value={portions[dish.id] ?? ""}
                      onChange={event =>
                        setPortions(current => ({
                          ...current,
                          [dish.id]: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="0"
                      aria-label={`Porções de ${dish.name}`}
                      className="h-11 w-24 rounded-xl text-right text-base"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-4 border-t border-[#eeeae3] pt-4">
            <label className="text-sm font-semibold">
              Margem de perda (%)
              <Input
                inputMode="decimal"
                value={loss}
                onChange={event => setLoss(event.target.value)}
                className="mt-1 h-11 w-24 rounded-xl text-base"
              />
            </label>
            <label className="flex h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepMinimum}
                onChange={event => setKeepMinimum(event.target.checked)}
                className="h-4 w-4 accent-[#2f5d50]"
              />
              Manter o estoque mínimo depois de produzir
            </label>
          </div>
          <p className="text-xs text-[#776e63]">
            A perda é calculada sobre o que você compra: com {amount(lossPercent)}
            %, 1 kg pronto pede {amount(1 / (1 - lossPercent / 100))} kg. Um
            insumo com perda própria na ficha técnica ignora esta margem.
          </p>
        </CardContent>
      </Card>

      {plan.dishesWithoutRecipe.length > 0 && (
        <Card className="rounded-2xl border-[#f0ddc5] bg-[#fffaf3]">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-[#7e4c2d]">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Fora da conta por não ter ficha técnica:{" "}
              {plan.dishesWithoutRecipe.join(", ")}.
            </p>
          </CardContent>
        </Card>
      )}

      {hasPlan && (
        <Card className="rounded-2xl border-[#e7ebe5] shadow-sm">
          <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle className="font-display text-lg">
                Lista de compras
              </CardTitle>
              <p className="text-sm text-[#776e63]">
                {plan.shoppingList.length
                  ? `${plan.shoppingList.length} ${plan.shoppingList.length === 1 ? "item" : "itens"} · custo estimado ${money(plan.totalCost)}`
                  : "Seu estoque já cobre esta produção."}
                {plan.itemsWithoutCost > 0 &&
                  ` · ${plan.itemsWithoutCost} sem custo cadastrado`}
              </p>
            </div>
            {plan.shoppingList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyList}
                  className="rounded-lg"
                >
                  <ClipboardCopy className="mr-1.5 h-4 w-4" /> Copiar
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(listAsText(plan.shoppingList))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm" className="rounded-lg">
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(plan.lines)}
                  className="rounded-lg"
                >
                  <Download className="mr-1.5 h-4 w-4" /> CSV
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#eeeae3]">
              {plan.lines.map(line => (
                <div
                  key={line.inventoryItemId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-3"
                >
                  <p className="truncate font-semibold">{line.name}</p>
                  <p
                    className={`text-right font-semibold ${line.toBuy > 0 ? "text-[#a05c32]" : "text-[#347052]"}`}
                  >
                    {line.toBuy > 0
                      ? `Comprar ${amount(line.toBuy)} ${line.unit}`
                      : "Tem em estoque"}
                  </p>
                  <p className="truncate text-xs text-[#776e63]">
                    Precisa de {amount(line.needed)} {line.unit} · tem{" "}
                    {amount(line.inStock)} {line.unit}
                  </p>
                  <p className="text-right text-xs text-[#776e63]">
                    {line.toBuy > 0 &&
                      (line.hasCost ? money(line.estimatedCost) : "sem custo")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasPlan && recipes.length > 0 && (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#e5e0d7] p-6 text-sm text-[#776e63]">
          <ShoppingCart className="h-4 w-4" /> Informe as porções para montar a
          lista de compras.
        </p>
      )}

      {editing && (
        <RecipeDialog
          dish={editing}
          stock={stock}
          lines={recipes.filter(line => line.menuItemId === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void recipesQuery.refetch();
            setEditing(null);
          }}
          onStockChanged={() => stockQuery.refetch()}
        />
      )}
    </div>
  );
}

type DraftLine = {
  inventoryItemId: number;
  quantity: string;
  unit: string;
  lossPercent: string;
};

function RecipeDialog({
  dish,
  stock,
  lines,
  onClose,
  onSaved,
  onStockChanged,
}: {
  dish: { id: number; name: string };
  stock: PlanStockItem[];
  lines: RecipeLine[];
  onClose: () => void;
  onSaved: () => void;
  onStockChanged: () => void;
}) {
  const [draft, setDraft] = useState<DraftLine[]>(() =>
    lines.map(line => ({
      inventoryItemId: line.inventoryItemId,
      quantity: String(line.quantity).replace(".", ","),
      unit: line.unit,
      lossPercent:
        line.lossPercent === null
          ? ""
          : String(line.lossPercent).replace(".", ","),
    }))
  );
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<StockUnit>("kg");
  const saveMutation = trpc.recipes.save.useMutation();
  const createItem = trpc.inventory.createItem.useMutation();

  const available = stock.filter(
    item => !draft.some(line => line.inventoryItemId === item.id)
  );
  const addLine = (item: { id: number; unit: string }) =>
    setDraft(current => [
      ...current,
      {
        inventoryItemId: item.id,
        quantity: "",
        // Porção costuma ser pequena: já sugere gramas ou mililitros.
        unit: compatibleUnits(item.unit)[0],
        lossPercent: "",
      },
    ]);
  const updateLine = (id: number, patch: Partial<DraftLine>) =>
    setDraft(current =>
      current.map(line =>
        line.inventoryItemId === id ? { ...line, ...patch } : line
      )
    );

  const createIngredient = async () => {
    try {
      const item = await createItem.mutateAsync({
        name: newName.trim(),
        unit: newUnit,
        minimumQuantity: 0,
        costPerUnit: 0,
      });
      addLine({ id: item.id, unit: newUnit });
      setNewName("");
      onStockChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível criar o insumo."
      );
    }
  };

  const save = async () => {
    const parsed = draft.map(line => ({
      inventoryItemId: line.inventoryItemId,
      quantity: parseNumber(line.quantity),
      unit: line.unit,
      lossPercent: line.lossPercent.trim()
        ? parseNumber(line.lossPercent)
        : null,
    }));
    const invalid = parsed.some(
      line =>
        !(line.quantity > 0) ||
        (line.lossPercent !== null &&
          !(line.lossPercent >= 0 && line.lossPercent <= MAX_LOSS_PERCENT))
    );
    if (invalid) {
      toast.error(
        `Informe a quantidade de cada insumo. A perda vai de 0 a ${MAX_LOSS_PERCENT}%.`
      );
      return;
    }
    try {
      await saveMutation.mutateAsync({ menuItemId: dish.id, lines: parsed });
      toast.success("Ficha técnica salva.");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{dish.name}</DialogTitle>
          <DialogDescription>
            Quanto de cada insumo vai em uma porção pronta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {draft.map(line => {
            const item = stock.find(entry => entry.id === line.inventoryItemId);
            return (
              <div
                key={line.inventoryItemId}
                className="rounded-xl border border-[#eeeae3] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {item?.name ?? "Insumo"}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remover ${item?.name ?? "insumo"}`}
                    onClick={() =>
                      setDraft(current =>
                        current.filter(
                          entry =>
                            entry.inventoryItemId !== line.inventoryItemId
                        )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#a79b8d] hover:bg-[#f1ece3]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-semibold">
                    Por porção
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
                      updateLine(line.inventoryItemId, {
                        unit: event.target.value,
                      })
                    }
                    className="h-11 rounded-xl border border-[#e5e0d7] bg-white px-2 text-base"
                  >
                    {compatibleUnits(item?.unit ?? line.unit).map(unit => (
                      <option key={unit}>{unit}</option>
                    ))}
                  </select>
                  <label className="text-xs font-semibold">
                    Perda própria (%)
                    <Input
                      inputMode="decimal"
                      value={line.lossPercent}
                      onChange={event =>
                        updateLine(line.inventoryItemId, {
                          lossPercent: event.target.value,
                        })
                      }
                      placeholder="Geral"
                      className="mt-1 h-11 w-24 rounded-xl text-base"
                    />
                  </label>
                </div>
              </div>
            );
          })}

          {available.length > 0 && (
            <select
              aria-label="Adicionar insumo do estoque"
              value=""
              onChange={event => {
                const item = available.find(
                  entry => entry.id === Number(event.target.value)
                );
                if (item) addLine(item);
              }}
              className="h-11 w-full rounded-xl border border-[#e5e0d7] bg-white px-3 text-base"
            >
              <option value="">Adicionar insumo do estoque…</option>
              {available.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          )}

          <div className="rounded-xl bg-[#f8f6f1] p-3">
            <p className="text-xs font-semibold">Insumo novo</p>
            <div className="mt-1 flex gap-2">
              <Input
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="Ex.: Arroz"
                aria-label="Nome do insumo novo"
                className="h-11 min-w-0 flex-1 rounded-xl text-base"
              />
              <select
                aria-label="Unidade do estoque"
                value={newUnit}
                onChange={event => setNewUnit(event.target.value as StockUnit)}
                className="h-11 rounded-xl border border-[#e5e0d7] bg-white px-2 text-base"
              >
                {STOCK_UNITS.map(unit => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                aria-label="Criar insumo"
                onClick={createIngredient}
                disabled={newName.trim().length < 2 || createItem.isPending}
                className="h-11 w-11 rounded-xl p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-[#776e63]">
              Ele entra no estoque com saldo zero. Informe saldo e custo na aba
              Estoque.
            </p>
          </div>

          <Button
            onClick={save}
            disabled={saveMutation.isPending}
            className="h-11 w-full rounded-xl bg-[#2f5d50] text-white"
          >
            Salvar ficha técnica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
