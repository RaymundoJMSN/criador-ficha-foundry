import { describe, it, expect } from "vitest";
import {
  baseSlug,
  habilidadesAte,
  slotsDePoder,
  circuloMaximo,
} from "../../src/rules/progressao.js";

describe("baseSlug", () => {
  it("tira sufixo de escalonamento numérico", () => {
    expect(baseSlug("ataque_especial_8")).toBe("ataque_especial");
    expect(baseSlug("reducao_de_dano_10")).toBe("reducao_de_dano");
  });

  it("tira sufixo _con_mais_N", () => {
    expect(baseSlug("casca_grossa_con_mais_2")).toBe("casca_grossa");
  });

  it("deixa slug sem sufixo intacto", () => {
    expect(baseSlug("ataque_extra")).toBe("ataque_extra");
  });
});

describe("habilidadesAte", () => {
  it("guerreiro nv1 recebe só Ataque Especial", () => {
    expect(habilidadesAte("Guerreiro", 1)).toEqual(["ataque_especial"]);
  });

  it("guerreiro nv7 não recebe Campeão (nv20)", () => {
    const h = habilidadesAte("Guerreiro", 7);
    expect(h).toContain("durao");
    expect(h).toContain("ataque_extra");
    expect(h).not.toContain("campeao");
  });

  it("escalonamento não duplica a habilidade base", () => {
    const h = habilidadesAte("Guerreiro", 7);
    expect(h.filter((s) => baseSlug(s) === "ataque_especial")).toHaveLength(1);
  });

  it("guerreiro nv20 recebe Campeão", () => {
    expect(habilidadesAte("Guerreiro", 20)).toContain("campeao");
  });

  it("classe desconhecida devolve lista vazia", () => {
    expect(habilidadesAte("Inexistente", 5)).toEqual([]);
  });
});

describe("slotsDePoder", () => {
  it("guerreiro nv1 não escolhe poder", () => {
    expect(slotsDePoder("Guerreiro", 1)).toBe(0);
  });

  it("guerreiro nv5 acumula 4 poderes (níveis 2..5)", () => {
    expect(slotsDePoder("Guerreiro", 5)).toBe(4);
  });

  it("guerreiro nv20 acumula 19 poderes", () => {
    expect(slotsDePoder("Guerreiro", 20)).toBe(19);
  });

  it("classe desconhecida não abre slot", () => {
    expect(slotsDePoder("Inexistente", 10)).toBe(0);
  });
});

describe("circuloMaximo", () => {
  it("arcanista nv1 = 1º círculo", () => {
    expect(circuloMaximo("Arcanista", 1)).toBe(1);
  });

  it("arcanista nv9 = 3º círculo", () => {
    expect(circuloMaximo("Arcanista", 9)).toBe(3);
  });

  it("bardo abre o 2º círculo só no nv6", () => {
    expect(circuloMaximo("Bardo", 5)).toBe(1);
    expect(circuloMaximo("Bardo", 6)).toBe(2);
  });

  it("guerreiro nunca conjura", () => {
    expect(circuloMaximo("Guerreiro", 20)).toBe(0);
  });
});
