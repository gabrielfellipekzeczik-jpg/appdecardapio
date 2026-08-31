import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "admin" | "user";

function createContext(role: Role, companyId: number | null = role === "admin" ? 1 : null): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      supabaseUserId: `${role}-tester`,
      companyId,
      email: `${role}@example.com`,
      name: role === "admin" ? "Operador" : "Cliente",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("orders.advanceStatus", () => {
  it("permite ao admin da empresa avançar um pedido e retorna o status persistido ou local", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.orders.advanceStatus({ id: 1048, status: "preparing" });
    expect(result).toMatchObject({ orderId: 1048, status: "preparing" });
    expect(typeof result.persisted).toBe("boolean");
  });

  it("permite ao admin consultar os módulos operacionais da própria empresa", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.adminMenu.list()).resolves.toBeInstanceOf(Array);
    await expect(caller.inventory.list()).resolves.toBeInstanceOf(Array);
    await expect(caller.finance.recentExpenses({ limit: 10 })).resolves.toBeInstanceOf(Array);
  });

  it("bloqueia usuários comuns nos módulos operacionais", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.orders.advanceStatus({ id: 1048, status: "preparing" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.adminMenu.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.inventory.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.finance.recentExpenses({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bloqueia admin ainda sem empresa vinculada (isolamento por companyId)", async () => {
    // role=admin mas companyId=null — não existe cenário em que o companyId
    // venha do cliente, então uma conta sem empresa nunca enxerga dado de negócio.
    const caller = appRouter.createCaller(createContext("admin", null));
    await expect(caller.adminMenu.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.orders.recent()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("nunca tenta despachar entrega quando a atualização do pedido não foi persistida", async () => {
    // Sem DATABASE_URL no ambiente de teste, advanceOrderStatus sempre retorna
    // persisted:false — o router deve pular o despacho em vez de fingir sucesso.
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.orders.advanceStatus({ id: 1049, status: "ready" });
    expect(result).toMatchObject({ orderId: 1049, status: "ready", persisted: false, delivery: null });
  });
});
