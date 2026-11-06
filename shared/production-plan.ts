/** Unidades que têm conversão entre si. Caixa, pacote e unidade não têm: valem como cadastradas. */
const UNIT_FAMILIES: Record<string, Record<string, number>> = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, L: 1000 },
};

const familyOf = (unit: string) =>
  Object.values(UNIT_FAMILIES).find(family => unit in family);

/** Unidades aceitas na ficha técnica para um insumo controlado na unidade informada. */
export function compatibleUnits(stockUnit: string): string[] {
  const family = familyOf(stockUnit);
  return family ? Object.keys(family) : [stockUnit];
}

export function convertQuantity(quantity: number, from: string, to: string) {
  if (from === to) return quantity;
  const family = familyOf(from);
  if (!family || !(to in family))
    throw new Error(`Não é possível converter ${from} em ${to}.`);
  return (quantity * family[from]) / family[to];
}

/** Perda é parte do que se compra: com 10%, 9 kg prontos exigem 10 kg comprados. */
export function grossQuantity(netQuantity: number, lossPercent: number) {
  return netQuantity / (1 - lossPercent / 100);
}

export const MAX_LOSS_PERCENT = 90;

export type RecipeLine = {
  menuItemId: number;
  inventoryItemId: number;
  quantity: number;
  unit: string;
  /** Vazio usa a margem geral do planejamento. */
  lossPercent: number | null;
};

export type PlanDish = { menuItemId: number; name: string; portions: number };

export type PlanStockItem = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  costPerUnit: number;
};

export type ShoppingLine = {
  inventoryItemId: number;
  name: string;
  unit: string;
  needed: number;
  inStock: number;
  toBuy: number;
  estimatedCost: number;
  hasCost: boolean;
  usedIn: string[];
};

const roundUp = (value: number, step: number) =>
  Math.ceil(Number((value / step).toFixed(6))) * step;

/** Compra-se caixa, pacote e unidade inteiros; peso e volume, com precisão de grama e mililitro. */
function purchaseQuantity(value: number, unit: string) {
  if (value <= 0) return 0;
  const step = familyOf(unit) ? 0.001 : 1;
  return Number(roundUp(value, step).toFixed(3));
}

export function buildProductionPlan(input: {
  dishes: PlanDish[];
  recipes: RecipeLine[];
  stock: PlanStockItem[];
  defaultLossPercent: number;
  keepMinimumStock: boolean;
}) {
  const stockById = new Map(input.stock.map(item => [item.id, item]));
  const totals = new Map<number, { needed: number; usedIn: Set<string> }>();
  const dishesWithoutRecipe: string[] = [];

  for (const dish of input.dishes) {
    if (dish.portions <= 0) continue;
    const lines = input.recipes.filter(
      line =>
        line.menuItemId === dish.menuItemId &&
        stockById.has(line.inventoryItemId)
    );
    if (!lines.length) {
      dishesWithoutRecipe.push(dish.name);
      continue;
    }
    for (const line of lines) {
      const item = stockById.get(line.inventoryItemId)!;
      const net =
        convertQuantity(line.quantity, line.unit, item.unit) * dish.portions;
      const needed = grossQuantity(
        net,
        line.lossPercent ?? input.defaultLossPercent
      );
      const total = totals.get(item.id) ?? { needed: 0, usedIn: new Set() };
      total.needed += needed;
      total.usedIn.add(dish.name);
      totals.set(item.id, total);
    }
  }

  const lines: ShoppingLine[] = Array.from(totals, ([id, total]) => {
    const item = stockById.get(id)!;
    const reserve = input.keepMinimumStock ? item.minimumQuantity : 0;
    const toBuy = purchaseQuantity(
      total.needed + reserve - item.currentQuantity,
      item.unit
    );
    return {
      inventoryItemId: id,
      name: item.name,
      unit: item.unit,
      needed: purchaseQuantity(total.needed, item.unit),
      inStock: item.currentQuantity,
      toBuy,
      estimatedCost: Math.round(toBuy * item.costPerUnit * 100) / 100,
      hasCost: item.costPerUnit > 0,
      usedIn: Array.from(total.usedIn),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const shoppingList = lines.filter(line => line.toBuy > 0);
  return {
    lines,
    shoppingList,
    dishesWithoutRecipe,
    totalCost:
      Math.round(
        shoppingList.reduce((sum, line) => sum + line.estimatedCost, 0) * 100
      ) / 100,
    itemsWithoutCost: shoppingList.filter(line => !line.hasCost).length,
  };
}
