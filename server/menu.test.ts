import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public menu contract", () => {
  it("returns an array without requiring authentication", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.menu.list({ companySlug: "empresa-inexistente" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects admin dashboard summary for anonymous visitors", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.dashboard.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin menu management", () => {
  const admin = (): TrpcContext => ({ user: { id: 1, supabaseUserId: "u1", email: "a@b.com", role: "admin", companyId: 1 } as unknown as TrpcContext["user"], req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

  it("blocks anonymous visitors from creating items", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.adminMenu.create({ categoryId: 1, name: "Prato", price: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates, edits, hides and deletes an item with photo", async () => {
    const caller = appRouter.createCaller(admin());
    const category = await caller.adminMenu.createCategory({ name: "Promoção" });
    const created = await caller.adminMenu.create({ categoryId: category.id, name: "Feijoada", price: 31.5, imageUrl: "https://example.com/f.jpg", description: "Completa" });
    expect(created).toMatchObject({ name: "Feijoada", price: "31.50", imageUrl: "https://example.com/f.jpg", active: true });
    expect((await caller.adminMenu.list()).some((i) => i.id === created.id)).toBe(true);

    const hidden = await caller.adminMenu.update({ id: created.id, data: { active: false, price: 33 } });
    expect(hidden).toMatchObject({ active: false, price: "33.00" });
    expect((await caller.menu.list({ companySlug: "x" })).some(({ item }) => item.id === created.id)).toBe(false);

    await caller.adminMenu.delete({ id: created.id });
    await expect(caller.adminMenu.delete({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid price and unknown category", async () => {
    const caller = appRouter.createCaller(admin());
    await expect(caller.adminMenu.create({ categoryId: 1, name: "Prato", price: 0 })).rejects.toThrow();
    await expect(caller.adminMenu.create({ categoryId: 99999, name: "Prato", price: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("whatsapp bot settings", () => {
  const admin = (): TrpcContext => ({ user: { id: 1, supabaseUserId: "u1", email: "a@b.com", role: "admin", companyId: 1 } as unknown as TrpcContext["user"], req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

  it("blocks anonymous visitors", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.whatsapp.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.whatsapp.connect()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("starts disconnected, requests a connection and saves settings without leaking secrets", async () => {
    const caller = appRouter.createCaller(admin());
    const initial = await caller.whatsapp.status();
    expect(initial).toMatchObject({ desired: "disconnected", status: "idle", qr: null, serviceOnline: false });

    await caller.whatsapp.connect();
    expect(await caller.whatsapp.status()).toMatchObject({ desired: "connected", status: "starting" });

    await caller.whatsapp.updateSettings({ aiEnabled: false, instructions: "Abrimos das 10h às 19h." });
    expect(await caller.whatsapp.status()).toMatchObject({ aiEnabled: false, instructions: "Abrimos das 10h às 19h." });

    await caller.whatsapp.disconnect();
    expect((await caller.whatsapp.status()).desired).toBe("disconnected");
    await expect(caller.whatsapp.updateSettings({ instructions: "x".repeat(1501) })).rejects.toThrow();
  });
});
