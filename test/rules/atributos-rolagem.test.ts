import { describe, it, expect } from "vitest";
import {
  converterRolagem,
  converterNimb,
  especRolagem,
  valoresFixos,
  precisaRerolar,
  poolDaRolagem,
  indiceDoMenor,
  atributosDistribuidos,
  atributosValkaria,
  validarAtributos,
  VALKARIA,
} from "../../src/rules/atributos.js";

describe("converterRolagem — tabela do LB p.17", () => {
  it.each([
    [5, -2], [7, -2], [8, -1], [9, -1], [10, 0], [11, 0],
    [12, 1], [13, 1], [14, 2], [15, 2], [16, 3], [17, 3], [18, 4], [23, 4],
  ])("total %i vira atributo %i", (total, esperado) => {
    expect(converterRolagem(total)).toBe(esperado);
  });
});

describe("converterNimb — pontas estendidas (HA p.281)", () => {
  it.each([[1, -3], [3, -3], [4, -2], [17, 3], [18, 4], [19, 4], [20, 5]])(
    "d20 %i vira %i",
    (d20, esperado) => {
      expect(converterNimb(d20)).toBe(esperado);
    }
  );
});

describe("especRolagem", () => {
  it("padrão: 4d6 descartando o menor, seis vezes, com piso de soma 6", () => {
    const e = especRolagem("rolagem_padrao")!;
    expect(e.formula).toBe("4d6kh3");
    expect(e.quantidade).toBe(6);
    expect(e.somaMinima).toBe(true);
    expect(e.descartarMenor).toBe(false);
  });
  it("clássica soma 3d6 sem descarte", () => {
    expect(especRolagem("classica")?.formula).toBe("3d6");
  });
  it("épica descarta o menor e soma +6", () => {
    expect(especRolagem("epica")?.formula).toBe("3d6kh2 + 6");
  });
  it("nimb rola 7d20, descarta o menor e não tem piso de soma", () => {
    const e = especRolagem("nimb")!;
    expect(e.formula).toBe("1d20");
    expect(e.quantidade).toBe(7);
    expect(e.descartarMenor).toBe(true);
    expect(e.somaMinima).toBe(false);
    expect(e.converter).toBe(converterNimb);
  });
  it("valkaria, khalmyr e compra de pontos não são rolagem simples", () => {
    expect(especRolagem("compra_pontos")).toBeNull();
    expect(especRolagem("khalmyr")).toBeNull();
    expect(especRolagem("valkaria")).toBeNull();
    expect(VALKARIA).toEqual({ formula: "1d6", quantidade: 7, base: 8 });
  });
});

describe("poolDaRolagem", () => {
  it("converte cada total pela tabela", () => {
    expect(poolDaRolagem(especRolagem("rolagem_padrao")!, [13, 8, 15, 18, 10, 9])).toEqual([1, -1, 2, 4, 0, -1]);
  });
  it("nimb descarta só o menor dos 7", () => {
    expect(poolDaRolagem(especRolagem("nimb")!, [20, 2, 18, 10, 2, 13, 7])).toEqual([5, 4, 0, -3, 1, -2]);
  });
});

describe("valoresFixos / reroll", () => {
  it("khalmyr distribui 3,3,2,1,0,-1", () => {
    expect(valoresFixos("khalmyr")).toEqual([3, 3, 2, 1, 0, -1]);
    expect(valoresFixos("rolagem_padrao")).toBeNull();
  });
  it("soma abaixo de 6 manda rolar de novo o menor", () => {
    expect(precisaRerolar([0, 0, 1, 1, 1, 1])).toBe(true);
    expect(precisaRerolar([2, 1, 1, 1, 1, 0])).toBe(false);
    expect(indiceDoMenor([1, -1, 2, -2, 0])).toBe(3);
  });
});

describe("atributosDistribuidos — 'distribua como quiser'", () => {
  it("atributo aponta para um índice do pool; sem escolha fica 0", () => {
    const pool = [1, -1, 2, 4, 0, -1];
    expect(atributosDistribuidos(pool, { for: 3, des: 2, con: 0, int: 4, sab: 1, car: 5 })).toEqual({
      for: 4, des: 2, con: 1, int: 0, sab: -1, car: -1,
    });
    expect(atributosDistribuidos(pool, { for: 3 })).toEqual({ for: 4, des: 0, con: 0, int: 0, sab: 0, car: 0 });
  });
});

describe("atributosValkaria — exemplo do HA p.281", () => {
  it("dados 2,2,3,3,4,5,5 viram For 4, Des 2, Con 2, Int -1, Sab 0, Car -1", () => {
    const dados = [2, 2, 3, 3, 4, 5, 5];
    const dist = ["des", "sab", "con", "con", "des", "for", "for"] as const;
    expect(atributosValkaria(dados, [...dist])).toEqual({ for: 4, des: 2, con: 2, int: -1, sab: 0, car: -1 });
  });
  it("mais de 18 continua 4 (teto da tabela)", () => {
    expect(atributosValkaria([6, 6, 6], ["for", "for", "for"]).for).toBe(4);
  });
});

describe("validarAtributos", () => {
  const zero = { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  it("compra de pontos: excesso bloqueia", () => {
    expect(validarAtributos("compra_pontos", { ...zero, for: 4, des: 4 }, {})).toEqual(["Pontos excedidos em 4."]);
    expect(validarAtributos("compra_pontos", { ...zero, for: 4, des: 2, con: 1 }, {})).toEqual([]);
  });
  it("rolagem: exige rolar, distribuir tudo e não repetir valor", () => {
    expect(validarAtributos("rolagem_padrao", zero, {})).toHaveLength(1);
    const pool = [1, -1, 2, 4, 0, -1];
    expect(validarAtributos("rolagem_padrao", zero, { atributos_pool: pool, atributos_dist: { for: 0 } })).toEqual([
      "Distribua os seis valores entre os atributos.",
    ]);
    expect(
      validarAtributos("rolagem_padrao", zero, { atributos_pool: pool, atributos_dist: { for: 0, des: 0, con: 1, int: 2, sab: 3, car: 4 } })
    ).toEqual(["Cada valor rolado só pode ser usado uma vez."]);
    expect(
      validarAtributos("rolagem_padrao", zero, { atributos_pool: pool, atributos_dist: { for: 0, des: 5, con: 1, int: 2, sab: 3, car: 4 } })
    ).toEqual([]);
  });
  it("khalmyr usa o pool fixo sem rolar", () => {
    expect(validarAtributos("khalmyr", zero, { atributos_dist: { for: 0, des: 1, con: 2, int: 3, sab: 4, car: 5 } })).toEqual([]);
  });
  it("valkaria: todos os 7 dados têm de ser aplicados", () => {
    expect(validarAtributos("valkaria", zero, {})).toHaveLength(1);
    expect(validarAtributos("valkaria", zero, { valkaria_dados: [1, 2, 3, 4, 5, 6, 1], valkaria_dist: ["for", "for"] })).toEqual([
      "Aplique todos os dados em atributos (faltam 5).",
    ]);
    expect(
      validarAtributos("valkaria", zero, { valkaria_dados: [1, 2, 3, 4, 5, 6, 1], valkaria_dist: ["for", "for", "des", "con", "int", "sab", "car"] })
    ).toEqual([]);
  });
});
