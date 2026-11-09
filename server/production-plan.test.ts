import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { routableAddress } from "./integrations/deliveryPricing";
import {
  DEFAULT_DELIVERY_PRICING,
  estimateDeliveryFee,
} from "@shared/delivery";
import {
  buildProductionPlan,
  compatibleUnits,
  convertQuantity,
  grossQuantity,
  type PlanStockItem,
  type RecipeLine,
} from "@shared/production-plan";

const stock: PlanStockItem[] = [
  { id: 1, name: "Arroz", unit: "kg", currentQuantity: 2, minimumQuantity: 1, costPerUnit: 6 },
  { id: 2, name: "Frango", unit: "kg", currentQuantity: 0, minimumQuantity: 0, costPerUnit: 20 },
  { id: 3, name: "Embalagem", unit: "un", currentQuantity: 10, minimumQuantity: 0, costPerUnit: 0 },
  { id: 4, name: "Óleo", unit: "L", currentQuantity: 50, minimumQuantity: 0, costPerUnit: 8 },
];
const recipes: RecipeLine[] = [
  { menuItemId: 10, inventoryItemId: 1, quantity: 150, unit: "g", lossPercent: null },
  { menuItemId: 10, inventoryItemId: 2, quantity: 120, unit: "g", lossPercent: 25 },
  { menuItemId: 10, inventoryItemId: 3, quantity: 1, unit: "un", lossPercent: 0 },
  { menuItemId: 10, inventoryItemId: 4, quantity: 10, unit: "ml", lossPercent: null },
  { menuItemId: 11, inventoryItemId: 1, quantity: 100, unit: "g", lossPercent: null },
];
const plan = (overrides = {}) =>
  buildProductionPlan({
    dishes: [
      { menuItemId: 10, name: "Frango com arroz", portions: 50 },
      { menuItemId: 11, name: "Arroz simples", portions: 20 },
      { menuItemId: 12, name: "Sem ficha", portions: 5 },
      { menuItemId: 13, name: "Fora do plano", portions: 0 },
    ],
    recipes,
    stock,
    defaultLossPercent: 10,
    keepMinimumStock: false,
    ...overrides,
  });
const line = (id: number, overrides = {}) =>
  plan(overrides).lines.find(entry => entry.inventoryItemId === id)!;

describe("taxa de entrega estimada", () => {
  const pricing = DEFAULT_DELIVERY_PRICING;

  it("cobra a taxa mínima até a distância inclusa", () => {
    expect(estimateDeliveryFee(1, pricing)).toBe(7.5);
    expect(estimateDeliveryFee(3, pricing)).toBe(7.5);
  });

  it("soma o valor por km depois da distância inclusa", () => {
    expect(estimateDeliveryFee(7.2, pricing)).toBe(13.8);
  });

  it("respeita os valores definidos pela loja", () => {
    expect(
      estimateDeliveryFee(5, { baseFee: 5, includedKm: 2, pricePerKm: 2, maxKm: 10 })
    ).toBe(11);
  });

  it("tira complemento e referência da busca do endereço", () => {
    expect(
      routableAddress(
        "Rua Augusta - Consolação, São Paulo - SP, 01304-001, Apto 12, Referência: Portão azul, nº 100"
      )
    ).toBe("Rua Augusta - Consolação, São Paulo - SP, 01304-001, nº 100");
  });
});

describe("conversões", () => {
  it("converte peso e volume e bloqueia unidades sem relação", () => {
    expect(convertQuantity(150, "g", "kg")).toBe(0.15);
    expect(convertQuantity(2, "L", "ml")).toBe(2000);
    expect(() => convertQuantity(1, "un", "kg")).toThrow();
    expect(compatibleUnits("kg")).toEqual(["g", "kg"]);
    expect(compatibleUnits("L")).toEqual(["ml", "L"]);
    expect(compatibleUnits("cx")).toEqual(["cx"]);
  });

  it("calcula a perda sobre o que é comprado", () => {
    expect(grossQuantity(9, 10)).toBeCloseTo(10);
    expect(grossQuantity(9, 0)).toBe(9);
  });
});

describe("lista de compras", () => {
  it("soma o mesmo insumo em vários pratos com a margem geral", () => {
    // (50 x 150 g + 20 x 100 g) = 9,5 kg; com 10% de perda, 10,556 kg.
    expect(line(1).needed).toBeCloseTo(10.556, 3);
    expect(line(1).toBuy).toBeCloseTo(8.556, 3);
    expect(line(1).usedIn).toEqual(["Frango com arroz", "Arroz simples"]);
  });

  it("usa a perda própria do insumo no lugar da margem geral", () => {
    // 50 x 120 g = 6 kg; com 25% de perda, 8 kg.
    expect(line(2).needed).toBe(8);
    expect(line(2).estimatedCost).toBe(160);
  });

  it("arredonda para cima o que é comprado por unidade", () => {
    expect(line(3).needed).toBe(50);
    expect(line(3).toBuy).toBe(40);
  });

  it("não compra o que o estoque já cobre", () => {
    expect(line(4).toBuy).toBe(0);
    expect(plan().shoppingList.map(entry => entry.name)).not.toContain("Óleo");
  });

  it("repõe o estoque mínimo quando pedido", () => {
    expect(line(1, { keepMinimumStock: true }).toBuy).toBeCloseTo(9.556, 3);
  });

  it("avisa prato sem ficha e ignora prato sem porções", () => {
    expect(plan().dishesWithoutRecipe).toEqual(["Sem ficha"]);
  });

  it("soma o custo e conta itens sem preço", () => {
    const result = plan();
    expect(result.totalCost).toBeCloseTo(8.556 * 6 + 160, 1);
    expect(result.itemsWithoutCost).toBe(1);
  });
});

describe("fichas técnicas", () => {
  function adminCaller() {
    return appRouter.createCaller({
      user: { id: 1, email: "dono@teste.com", role: "admin", companyId: -1 },
      req: { protocol: "https", headers: {} },
      res: {},
    } as unknown as TrpcContext);
  }

  it("salva e rejeita unidade incompatível", async () => {
    const caller = adminCaller();
    const item = await caller.inventory.createItem({
      name: "Feijão",
      unit: "kg",
      minimumQuantity: 0,
      costPerUnit: 9,
    });
    await expect(
      caller.recipes.save({
        menuItemId: 1,
        lines: [
          { inventoryItemId: item.id, quantity: 100, unit: "ml", lossPercent: null },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller.recipes.save({
      menuItemId: 1,
      lines: [
        { inventoryItemId: item.id, quantity: 100, unit: "g", lossPercent: 5 },
      ],
    });
    expect(await caller.recipes.list()).toContainEqual({
      menuItemId: 1,
      inventoryItemId: item.id,
      quantity: 100,
      unit: "g",
      lossPercent: 5,
    });
  });

  it("atualiza preço e tira o ingrediente do estoque", async () => {
    const caller = adminCaller();
    const item = await caller.inventory.createItem({
      name: "Sal",
      unit: "kg",
      minimumQuantity: 0,
      costPerUnit: 0,
    });
    await caller.inventory.updateItem({ itemId: item.id, costPerUnit: 3 });
    const listed = (await caller.inventory.list()) as { id: number; costPerUnit: string }[];
    expect(listed.find(entry => entry.id === item.id)?.costPerUnit).toBe("3.00");
    await caller.inventory.updateItem({ itemId: item.id, active: false });
    const after = (await caller.inventory.list()) as { id: number }[];
    expect(after.map(entry => entry.id)).not.toContain(item.id);
    await expect(
      caller.inventory.updateItem({ itemId: 99999, costPerUnit: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("recusa insumo de fora do estoque", async () => {
    const caller = adminCaller();
    await expect(
      caller.recipes.save({
        menuItemId: 1,
        lines: [
          { inventoryItemId: 99999, quantity: 1, unit: "g", lossPercent: null },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("opções da taxa de entrega", () => {
  const base = { baseFee: 7.5, includedKm: 3, pricePerKm: 1.5, maxKm: 15 };
  it("é grátis até a distância escolhida", () => {
    expect(estimateDeliveryFee(2, { ...base, freeUpToKm: 3 })).toBe(0);
    expect(estimateDeliveryFee(5, { ...base, freeUpToKm: 3 })).toBe(10.5);
  });
  it("cobra o valor fixo em qualquer distância", () => {
    expect(estimateDeliveryFee(9, { ...base, mode: "fixed", fixedFee: 6 })).toBe(6);
    expect(estimateDeliveryFee(1, { ...base, mode: "fixed", fixedFee: 6, freeUpToKm: 2 })).toBe(0);
  });
});
