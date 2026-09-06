import { describe, it, expect } from "vitest";
import {
  getCirculosDesbloqueados,
  isConjurador,
  filterMagias,
  tradicaoDaClasse,
  escolasAEscolher,
  magiasExtrasDosPoderes,
  cotaDeMagias,
  excedentesPorCirculo,
  registrarNomesDePoder,
  slugsDosPoderes,
} from "../../src/rules/magias.js";
import type { IndexedMagia } from "../../src/compendium/types.js";

function mockMagia(overrides: Partial<IndexedMagia["system"]> = {}, id = "bola-de-fogo"): IndexedMagia {
  return {
    id,
    name: "Bola de Fogo",
    img: "",
    packId: "tormenta20.magias",
    type: "magia",
    system: { circulo: 3, escola: "evo", tipo: "arc", ...overrides },
  } as IndexedMagia;
}

describe("isConjurador / tradição — derivado do T20-DB, não de lista à mão", () => {
  it("arcanista e bardo são arcanos; clérigo e druida divinos", () => {
    expect(tradicaoDaClasse("arcanista")).toBe("arcana");
    expect(tradicaoDaClasse("bardo")).toBe("arcana");
    expect(tradicaoDaClasse("clerigo")).toBe("divina");
    expect(tradicaoDaClasse("druida")).toBe("divina");
    expect(isConjurador("druida")).toBe(true);
  });
  it("guerreiro, ladino e paladino NÃO conjuram pela classe", () => {
    expect(isConjurador("guerreiro")).toBe(false);
    expect(isConjurador("ladino")).toBe(false);
    expect(isConjurador("paladino")).toBe(false);
    expect(isConjurador("xama")).toBe(false);
  });
  it("bardo e druida escolhem 3 escolas; arcanista nenhuma", () => {
    expect(escolasAEscolher("bardo")).toBe(3);
    expect(escolasAEscolher("druida")).toBe(3);
    expect(escolasAEscolher("arcanista")).toBe(0);
  });
});

describe("getCirculosDesbloqueados", () => {
  it("nível 1 arcanista → círculo 1", () => {
    expect(getCirculosDesbloqueados("arcanista", 1)).toEqual([1]);
  });
  it("nível 5 arcanista → círculos 1 e 2; nível 9 → 3", () => {
    expect(getCirculosDesbloqueados("arcanista", 5)).toEqual([1, 2]);
    expect(getCirculosDesbloqueados("arcanista", 9)).toHaveLength(3);
  });
  it("bardo abre o 2º só no 6º", () => {
    expect(getCirculosDesbloqueados("bardo", 5)).toEqual([1]);
    expect(getCirculosDesbloqueados("bardo", 6)).toEqual([1, 2]);
  });
  it("quem não tem tabela fica no 1º (paladino com Orar)", () => {
    expect(getCirculosDesbloqueados("paladino", 10)).toEqual([1]);
  });
});

describe("filterMagias", () => {
  it("filtra por círculo desbloqueado", () => {
    const magias = [mockMagia({ circulo: 1 }), mockMagia({ circulo: 3 })];
    const result = filterMagias(magias, { classeSlug: "arcanista", nivel: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]!.system.circulo).toBe(1);
  });

  it("arcanista recebe arc + universal, não div", () => {
    const magias = [
      mockMagia({ circulo: 1, tipo: "arc" }, "a"),
      mockMagia({ circulo: 1, tipo: "div" }, "b"),
      mockMagia({ circulo: 1, tipo: "uni" }, "c"),
    ];
    expect(filterMagias(magias, { classeSlug: "arcanista", nivel: 1 }).map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("clérigo recebe div + universal", () => {
    const magias = [
      mockMagia({ circulo: 1, tipo: "arc" }, "a"),
      mockMagia({ circulo: 1, tipo: "div" }, "b"),
      mockMagia({ circulo: 1, tipo: "uni" }, "c"),
    ];
    expect(filterMagias(magias, { classeSlug: "clerigo", nivel: 1 }).map((m) => m.id)).toEqual(["b", "c"]);
  });

  it("druida sem as 3 escolas marcadas não vê nada; com elas, só das escolas", () => {
    const magias = [
      mockMagia({ circulo: 1, tipo: "div", escola: "nec" }, "a"),
      mockMagia({ circulo: 1, tipo: "div", escola: "evo" }, "b"),
      mockMagia({ circulo: 1, tipo: "uni", escola: "abj" }, "c"),
    ];
    expect(filterMagias(magias, { classeSlug: "druida", nivel: 1, escolas: ["nec"] })).toHaveLength(0);
    expect(
      filterMagias(magias, { classeSlug: "druida", nivel: 1, escolas: ["nec", "abj", "con"] }).map((m) => m.id)
    ).toEqual(["a", "c"]);
  });

  it("paladino sem Orar não vê magia; com Orar vê divinas de 1º círculo", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "div" }, "a"), mockMagia({ circulo: 2, tipo: "div" }, "b")];
    expect(filterMagias(magias, { classeSlug: "paladino", nivel: 5 })).toHaveLength(0);
    expect(filterMagias(magias, { classeSlug: "paladino", nivel: 5, poderSlugs: ["orar"] }).map((m) => m.id)).toEqual(["a"]);
  });

  it("magia sem tipo passa (compêndio incompleto)", () => {
    expect(filterMagias([mockMagia({ circulo: 1, tipo: undefined })], { classeSlug: "arcanista", nivel: 1 })).toHaveLength(1);
  });
});

describe("cota: classe + poderes que ensinam magia", () => {
  it("Orar 2× dá 2; Conhecimento Mágico dá 2; poder qualquer dá 0", () => {
    expect(magiasExtrasDosPoderes(["orar", "orar"])).toBe(2);
    expect(magiasExtrasDosPoderes(["conhecimento_magico", "ataque_especial"])).toBe(2);
  });
  it("paladino nv3 com Orar conhece 1; clérigo nv2 com Conhecimento Mágico conhece 6", () => {
    expect(cotaDeMagias("Paladino", 3, "", ["orar"])).toBe(1);
    expect(cotaDeMagias("Clérigo", 2, "", ["conhecimento_magico"])).toBe(6);
  });
  it("slugsDosPoderes usa o nome registrado", () => {
    registrarNomesDePoder((id) => ({ x1: "Orar", x2: "Conhecimento Mágico" })[id]);
    expect(slugsDosPoderes(["x1", "x2", "x3"])).toEqual(["orar", "conhecimento_magico"]);
  });
});

describe("excedentesPorCirculo", () => {
  it("arcanista nv5 (teto {2:1}): a 2ª magia de 2º círculo é excedente", () => {
    const esc = [
      { id: "a", circulo: 1 },
      { id: "b", circulo: 2 },
      { id: "c", circulo: 2 },
      { id: "d", circulo: 1 },
    ];
    expect(excedentesPorCirculo(esc, { 2: 1 })).toEqual(["c"]);
  });
  it("magia de 3º conta para o teto do 2º também", () => {
    expect(excedentesPorCirculo([{ id: "a", circulo: 3 }, { id: "b", circulo: 2 }], { 2: 1, 3: 1 })).toEqual(["b"]);
  });
  it("sem teto (nível baixo) nada excede", () => {
    expect(excedentesPorCirculo([{ id: "a", circulo: 1 }], {})).toEqual([]);
  });
});
