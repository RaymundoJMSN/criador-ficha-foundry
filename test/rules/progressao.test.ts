import { describe, it, expect } from "vitest";
import {
  baseSlug,
  habilidadesAte,
  slotsDePoder,
  circuloMaximo,
  magiasConhecidas,
  magiasMaxPorCirculo,
  getClasseProgressao,
} from "../../src/rules/progressao.js";

describe("baseSlug", () => {
  it("sinal antes do número também é escalonamento (furia_+2, inspiracao_+1, marca_da_presa_+1d4)", () => {
    expect(baseSlug("furia_+2")).toBe("furia");
    expect(baseSlug("inspiracao_+5")).toBe("inspiracao");
    expect(baseSlug("marca_da_presa_+1d4")).toBe("marca_da_presa");
  });

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

describe("classes fora do T20-DB — tabela lida dos PDFs", () => {
  it("Frade (Deuses de Arton): magias divinas 3+1/nível, círculos 5/9/13/17, poder de frade a partir do 2º", () => {
    expect(getClasseProgressao("Frade")?.magias?.tradicao).toBe("divina");
    expect(magiasConhecidas("Frade", 4)).toBe(6);
    expect(circuloMaximo("Frade", 9)).toBe(3);
    expect(slotsDePoder("Frade", 3)).toBe(2);
    expect(habilidadesAte("Frade", 5)).toEqual(expect.arrayContaining(["devoto_fiel", "erudicao", "magias", "dadiva_da_fe"]));
  });
  it("Treinador (Heróis de Arton): melhor amigo escala sem duplicar", () => {
    const h = habilidadesAte("Treinador", 10);
    expect(h.filter((s) => s === "melhor_amigo")).toHaveLength(1);
    expect(slotsDePoder("Treinador", 10)).toBe(9);
  });
  it("Samurai: sem tabela em lugar nenhum", () => {
    expect(getClasseProgressao("Samurai")).toBeNull();
  });
});

describe("magiasConhecidas", () => {
  it("arcanista bruxo: 3 iniciais + 1 por nível", () => {
    expect(magiasConhecidas("Arcanista", 1, "caminho_do_arcanista_bruxo")).toBe(3);
    expect(magiasConhecidas("Arcanista", 5, "caminho_do_arcanista_bruxo")).toBe(7);
  });

  it("mago começa com 4 e ganha +1 a cada círculo novo (5º, 9º…)", () => {
    expect(magiasConhecidas("Arcanista", 1, "caminho_do_arcanista_mago")).toBe(4);
    expect(magiasConhecidas("Arcanista", 4, "caminho_do_arcanista_mago")).toBe(7);
    expect(magiasConhecidas("Arcanista", 5, "caminho_do_arcanista_mago")).toBe(9);
    expect(magiasConhecidas("Arcanista", 9, "caminho_do_arcanista_mago")).toBe(14);
  });

  it("teto por círculo: arcanista nv5 só pode ter 1 magia de 2º círculo", () => {
    expect(magiasMaxPorCirculo("Arcanista", 5, "caminho_do_arcanista_bruxo")).toEqual({ 2: 1 });
    expect(magiasMaxPorCirculo("Arcanista", 5, "caminho_do_arcanista_mago")).toEqual({ 2: 2 });
    expect(magiasMaxPorCirculo("Arcanista", 9, "caminho_do_arcanista_bruxo")).toEqual({ 2: 5, 3: 1 });
    expect(magiasMaxPorCirculo("Bardo", 6)).toEqual({ 2: 1 });
    expect(magiasMaxPorCirculo("Arcanista", 4)).toEqual({});
  });

  it("feiticeiro aprende só em nível ímpar (3º, 5º…)", () => {
    expect(magiasConhecidas("Arcanista", 1, "caminho_do_arcanista_feiticeiro")).toBe(3);
    expect(magiasConhecidas("Arcanista", 2, "caminho_do_arcanista_feiticeiro")).toBe(3);
    expect(magiasConhecidas("Arcanista", 3, "caminho_do_arcanista_feiticeiro")).toBe(4);
    expect(magiasConhecidas("Arcanista", 5, "caminho_do_arcanista_feiticeiro")).toBe(5);
  });

  it("clérigo: 3 iniciais + 1 por nível (LB cap. 4)", () => {
    expect(magiasConhecidas("Clérigo", 1)).toBe(3);
    expect(magiasConhecidas("Clérigo", 4)).toBe(6);
  });

  it("bardo: 2 iniciais + 1 a cada nível par", () => {
    expect(magiasConhecidas("Bardo", 1)).toBe(2);
    expect(magiasConhecidas("Bardo", 2)).toBe(3);
    expect(magiasConhecidas("Bardo", 3)).toBe(3);
    expect(magiasConhecidas("Bardo", 6)).toBe(5);
  });

  it("guerreiro não conhece magia", () => {
    expect(magiasConhecidas("Guerreiro", 20)).toBe(0);
  });
});

describe("família de habilidade com número no meio", () => {
  it("magias_2_circulo é upgrade de magias, não habilidade nova", () => {
    expect(baseSlug("magias_2_circulo")).toBe("magias");
    expect(baseSlug("magias_1_circulo")).toBe("magias");
    expect(baseSlug("fabricar_item_superior_2_melhorias")).toBe("fabricar_item_superior");
    expect(baseSlug("ataque_furtivo_10d6")).toBe("ataque_furtivo");
    expect(baseSlug("cura_pelas_maos_1d8+1")).toBe("cura_pelas_maos");
  });

  it("arcanista nv5 recebe a habilidade Magias uma vez só", () => {
    const magias = habilidadesAte("Arcanista", 5).filter((s) => baseSlug(s) === "magias");
    expect(magias).toHaveLength(1);
  });

  it("clérigo nv5 idem (magias + magias_2_circulo são a mesma)", () => {
    const magias = habilidadesAte("Clérigo", 5).filter((s) => baseSlug(s) === "magias");
    expect(magias).toHaveLength(1);
  });
});
