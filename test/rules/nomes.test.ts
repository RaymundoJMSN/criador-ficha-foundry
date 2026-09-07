import { describe, it, expect } from "vitest";
import { sortearNome } from "../../src/rules/nomes.js";

describe("nome aleatório (HA Tabela 1-24)", () => {
  const tabelas = { humano: ["Hekker", "Dinlana"], anao: ["Bobrum"] };
  it("sorteia da coluna da raça; raça sem coluna cai em todas; sem tabela devolve null", () => {
    expect(sortearNome("Anão", tabelas, () => 0)).toBe("Bobrum");
    expect(sortearNome("Humano", tabelas, () => 0.99)).toBe("Dinlana");
    expect(sortearNome("Golem (Ameaças de Arton)", tabelas, () => 0)).toBe("Hekker");
    expect(sortearNome("", {}, () => 0)).toBeNull();
  });
});
