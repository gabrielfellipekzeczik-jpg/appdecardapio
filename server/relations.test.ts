import { describe, expect, it } from "vitest";
import { joinMenuWithCategories, joinOrdersWithCustomers, type Customer, type MenuCategory, type MenuItem, type Order } from "./db";

const category = (id: number, name: string) => ({ id, name }) as MenuCategory;
const item = (id: number, categoryId: number) => ({ id, categoryId, name: `item ${id}` }) as MenuItem;

describe("junção feita no código (o banco não tem chaves estrangeiras)", () => {
  it("liga cada item do cardápio à sua categoria e tolera categoria inexistente", () => {
    const result = joinMenuWithCategories([item(1, 10), item(2, 99)], [category(10, "Bebidas")]);
    expect(result[0].category?.name).toBe("Bebidas");
    expect(result[1].category).toBeNull();
    expect(result.map((row) => row.item.id)).toEqual([1, 2]);
  });

  it("liga cada pedido ao seu cliente", () => {
    const orders = [{ id: 1, customerId: 5 }, { id: 2, customerId: 6 }] as Order[];
    const result = joinOrdersWithCustomers(orders, [{ id: 5, name: "Ana" }] as Customer[]);
    expect(result[0].customer?.name).toBe("Ana");
    expect(result[1].customer).toBeNull();
  });
});
