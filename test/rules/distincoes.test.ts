import { describe, it, expect } from "vitest";
import { registrarDistincoes, getDistincao, podeTerDistincao, distincaoEscolhida, idsDePoderesDeDistincao } from "../../src/rules/distincoes.js";
import { CONFIG_PADRAO } from "../../src/config/config.js";

describe("distinções (HA cap. 2)", () => {
  it("agrupa por subtipo, separa a marca, e só vale com a regra ligada e nível 5+", () => {
    const n = registrarDistincoes([
      { id: "a", name: "Matemágica para iniciantes (Marca)", system: { tipo: "distincao", subtipo: "Numeromante" } },
      { id: "b", name: "Magicometria", system: { tipo: "distincao", subtipo: "Numeromante" } },
      { id: "c", name: "Álgebra Arcana", system: { tipo: "distincao", subtipo: "Numeromante" } },
      { id: "d", name: "Trazemos a Luz", system: { tipo: "distincao", subtipo: "Cavaleiro do Corvo" } },
      { id: "e", name: "Ataque Especial", system: { tipo: "ability", subtipo: "Guerreiro" } },
    ]);
    expect(n).toBe(2);
    const num = getDistincao("Numeromante")!;
    expect(num.marca).toEqual({ id: "a", name: "Matemágica para iniciantes" });
    expect(num.poderes.map((p) => p.name)).toEqual(["Álgebra Arcana", "Magicometria"]);
    expect(getDistincao("Cavaleiro do Corvo")!.marca).toBeUndefined();
    expect(idsDePoderesDeDistincao()).toEqual(new Set(["b", "c", "d"]));

    const ligada = { ...CONFIG_PADRAO, distincoes: true };
    expect(podeTerDistincao({ nivel: 4, config: ligada, escolhasPorItem: {} })).toBe(false);
    expect(podeTerDistincao({ nivel: 5, config: ligada, escolhasPorItem: {} })).toBe(true);
    expect(podeTerDistincao({ nivel: 9, config: CONFIG_PADRAO, escolhasPorItem: {} })).toBe(false);
    expect(distincaoEscolhida({ nivel: 5, config: ligada, escolhasPorItem: { distincao: "Numeromante" } })?.nome).toBe("Numeromante");
    expect(distincaoEscolhida({ nivel: 3, config: ligada, escolhasPorItem: { distincao: "Numeromante" } })).toBeNull();
  });
});
