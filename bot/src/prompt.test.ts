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

describe("parseDecision", () => {
  it("parses valid JSON, including fenced blocks", () => {
    expect(parseDecision('{"should_reply":true,"intent":"price","reply":" Custa R$ 24,90 "}')).toEqual({ shouldReply: true, intent: "price", reply: "Custa R$ 24,90" });
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
