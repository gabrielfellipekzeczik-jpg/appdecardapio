import { describe, expect, it } from "vitest";
import { slugFromName } from "./companies";

describe("endereço do cardápio a partir do nome", () => {
  it("tira acentos, espaços e símbolos", () => {
    expect(slugFromName("Casa da Marmita")).toBe("casa-da-marmita");
    expect(slugFromName("Pão & Café São João!")).toBe("pao-cafe-sao-joao");
    expect(slugFromName("  Marmitaria   do Zé  ")).toBe("marmitaria-do-ze");
  });
  it("garante pelo menos 3 caracteres", () => {
    expect(slugFromName("Bó")).toBe("bo-cardapio");
    expect(slugFromName("!!!")).toBe("loja-cardapio");
  });
});
