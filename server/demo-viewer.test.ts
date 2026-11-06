import { describe, expect, it } from "vitest";
import { isDemoDataViewer } from "@shared/const";

describe("dados de exemplo do painel", () => {
  it("só a conta de demonstração vê os dados de exemplo (sem diferenciar maiúsculas)", () => {
    expect(isDemoDataViewer("gabrielfellipekzeczik@gmail.com")).toBe(true);
    expect(isDemoDataViewer("  GabrielFellipeKzeczik@Gmail.com ")).toBe(true);
  });

  it("novos usuários e visitantes não veem dados de exemplo", () => {
    expect(isDemoDataViewer("loja@exemplo.com")).toBe(false);
    expect(isDemoDataViewer("")).toBe(false);
    expect(isDemoDataViewer(null)).toBe(false);
    expect(isDemoDataViewer(undefined)).toBe(false);
  });
});
