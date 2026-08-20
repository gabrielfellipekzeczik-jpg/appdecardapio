import { describe, expect, it } from "vitest";
import { appendLocalHistory, readLocalHistory } from "../shared/order-history";

const entry = (clientRef: string, createdAt: number) => ({ clientRef, createdAt, cart: [{ id: 1, qty: 1, observation: "sem cebola" }], customer: { name: "Ana", phone: "11999999999", address: "Rua A, 10" } });

describe("local customer order history", () => {
  it("filters history by the browser client reference", () => {
    expect(readLocalHistory(JSON.stringify([entry("local-a", 1), entry("local-b", 2)]), "local-a")).toHaveLength(1);
  });

  it("keeps the latest ten entries for quick repeat", () => {
    const history = Array.from({ length: 10 }, (_, index) => entry("local-a", index));
    const next = appendLocalHistory(history, entry("local-a", 11));
    expect(next).toHaveLength(10);
    expect(next[0]?.createdAt).toBe(11);
  });
});
