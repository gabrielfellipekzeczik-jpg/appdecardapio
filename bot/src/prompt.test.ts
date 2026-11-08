import { describe, expect, it } from "vitest";
import { ConversationMemory, buildSystemPrompt, parseDecision, validateReply, type CompanyContext } from "./prompt";

const ctx: CompanyContext = {
  name: "Casa Teste", slug: "casa-teste", pickupAddress: "Rua A, 10", storefrontUrl: "https://app.exemplo.com/casa-teste",
  instructions: "Abrimos de segunda a sexta, 11h às 14h.", aiEnabled: true, active: true,
  items: [
    { name: "Caseira", price: 24.9, description: "Arroz e feijão", category: "Almoço" },
    { name: "Suco", price: 7, description: null, category: null },
  ],
};

describe("buildSystemPrompt", () => {
  it("contains the catalog, the only allowed link and the owner's notes", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("Caseira — R$ 24,90");
    expect(prompt).toContain("https://app.exemplo.com/casa-teste");
    expect(prompt).toContain("segunda a sexta");
    expect(prompt).toContain("should_reply");
  });
});

describe("dúvidas básicas", () => {
  const withStore: CompanyContext = {
    ...ctx,
    store: {
      hours: ["Segunda: 11:00 às 14:30", "Domingo: fechado"],
      payments: ["Pix", "dinheiro ou maquininha na entrega"],
      pickup: true,
      delivery: { baseFee: 7.5, includedKm: 3, pricePerKm: 1.5, maxKm: 15 },
    },
  };

  it("leva horário, pagamento, entrega e o horário atual ao assistente", () => {
    const prompt = buildSystemPrompt(withStore, new Date("2026-11-09T15:00:00Z"));
    expect(prompt).toContain("Segunda: 11:00 às 14:30");
    expect(prompt).toContain("Pix, dinheiro ou maquininha na entrega");
    expect(prompt).toContain("R$ 7,50 até 3 km");
    expect(prompt).toContain("retirar na loja");
    expect(prompt).toContain("segunda-feira, 12:00");
    expect(prompt).toContain("NÃO SEJA INSISTENTE");
    expect(buildSystemPrompt(withStore, new Date(), true)).toContain("JÁ FOI ENVIADO");
  });

  it("aceita os valores da taxa de entrega na resposta", () => {
    expect(validateReply("A entrega começa em R$ 7,50, com R$ 1,50 por km a mais.", withStore)).not.toBeNull();
    expect(validateReply("A entrega custa R$ 5,00.", withStore)).toBeNull();
  });

  it("entende as novas intenções", () => {
    expect(parseDecision('{"should_reply":true,"intent":"hours","reply":"Abrimos às 11h"}')?.intent).toBe("hours");
  });

  it("lê o pedido montado pela IA", () => {
    const decision = parseDecision(JSON.stringify({
      should_reply: true, intent: "other", reply: "", action: "quote_order",
      order: { items: [{ name: "Caseira", quantity: 2, note: "" }], fulfillment: "delivery", address: "81580-130", number: "159", complement: "", customer_name: "Ana", payment: "link" },
    }));
    expect(decision?.action).toBe("quote_order");
    expect(decision?.order?.items[0]).toEqual({ name: "Caseira", quantity: 2, note: "" });
    expect(parseDecision('{"should_reply":true,"intent":"other","reply":"","action":"apagar"}')?.action).toBe("none");
  });
});

describe("parseDecision", () => {
  it("parses valid JSON, including fenced blocks", () => {
    expect(parseDecision('{"should_reply":true,"intent":"price","reply":" Custa R$ 24,90 "}')).toEqual({ shouldReply: true, intent: "price", reply: "Custa R$ 24,90", action: "none", order: null });
    expect(parseDecision('```json\n{"should_reply":false,"intent":"other","reply":""}\n```')?.shouldReply).toBe(false);
  });
  it("treats anything unparseable as no decision, and unknown intents as other", () => {
    expect(parseDecision("oi")).toBeNull();
    expect(parseDecision(undefined)).toBeNull();
    expect(parseDecision('{"should_reply":true,"intent":"hack","reply":"x"}')?.intent).toBe("other");
    expect(parseDecision('{"should_reply":"yes","reply":"x"}')?.shouldReply).toBe(false);
  });
});

describe("validateReply", () => {
  it("accepts catalog prices (and multiples) and the store link", () => {
    expect(validateReply("A Caseira sai por R$ 24,90. Peça em https://app.exemplo.com/casa-teste.", ctx)).toContain("R$ 24,90");
    expect(validateReply("Suco: R$ 7,00 ou R$ 7", ctx)).not.toBeNull();
    expect(validateReply("2 caseiras = R$ 49,80", ctx)).not.toBeNull();
  });
  it("rejects invented prices", () => {
    expect(validateReply("A Caseira custa R$ 19,90", ctx)).toBeNull();
    expect(validateReply("Promoção: R$ 1.000", ctx)).toBeNull();
  });
  it("rejects foreign links and empty text", () => {
    expect(validateReply("Pague em https://golpe.example/pix", ctx)).toBeNull();
    expect(validateReply("veja www.outro.com", ctx)).toBeNull();
    expect(validateReply("   ", ctx)).toBeNull();
  });
  it("truncates absurdly long replies", () => {
    expect(validateReply("a".repeat(5_000), ctx)!.length).toBeLessThanOrEqual(1_400);
  });
});

describe("ConversationMemory", () => {
  it("keeps the last turns and forgets after the TTL", () => {
    let now = 0;
    const memory = new ConversationMemory(2, 1_000, () => now);
    memory.push("a", { role: "user", text: "1" }); memory.push("a", { role: "model", text: "2" }); memory.push("a", { role: "user", text: "3" });
    expect(memory.get("a").map((t) => t.text)).toEqual(["2", "3"]);
    now = 5_000;
    expect(memory.get("a")).toEqual([]);
  });
});
