import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Role = "admin" | "user";

function createContext(role: Role): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      supabaseUserId: `${role}-tester`,
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
  it("permite ao admin avançar um pedido e retorna o status persistido ou local", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.orders.advanceStatus({ id: 1048, status: "preparing" });
    expect(result).toMatchObject({ orderId: 1048, status: "preparing" });
    expect(typeof result.persisted).toBe("boolean");
  });

  it("permite ao admin consultar os módulos operacionais", async () => {
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

  it("dispara o despacho automático quando o pedido fica pronto", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.orders.advanceStatus({ id: 1049, status: "ready" });
    expect(result).toMatchObject({ orderId: 1049, status: "ready" });
    // Sem credenciais do Uber Direct no ambiente de teste, o despacho fica indisponível — nunca finge sucesso.
    expect(result.delivery).toMatchObject({ available: false });
  });

  it("restringe integrações ao proprietário", async () => {
    const operationalAdmin = appRouter.createCaller(createContext("admin"));
    await expect(operationalAdmin.integrations.status()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const ownerContext = createContext("admin");
    ownerContext.user!.email = "owner-test@example.com";
    process.env.OWNER_EMAIL = "owner-test@example.com";
    const owner = appRouter.createCaller(ownerContext);
    await expect(owner.integrations.status()).resolves.toMatchObject({
      mercadopago: expect.objectContaining({ connected: expect.any(Boolean) }),
      uberDirect: expect.objectContaining({ connected: expect.any(Boolean) }),
      ninetyNineDelivery: expect.objectContaining({ connected: false }),
    });
  });
});
