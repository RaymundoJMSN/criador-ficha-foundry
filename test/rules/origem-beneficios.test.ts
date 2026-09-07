import { describe, it, expect } from "vitest";
import {
  getBeneficiosPlano,
  validarBeneficios,
  formatItensIniciais,
  slugsDoPoderDaOrigem,
} from "../../src/rules/origem.js";

describe("benefícios de origem — escolha dois (LB cap. 2)", () => {
  it("pool junta perícias e poderes, com o exclusivo marcado", () => {
    const plano = getBeneficiosPlano("aristocrata");
    expect(plano.quantidade).toBe(2);
    expect(plano.opcoes.map((o) => o.token)).toEqual([
      "pericia:diplomacia",
      "pericia:enganacao",
      "pericia:nobreza",
      "poder:comandar",
      "poder:sangue_azul",
    ]);
    expect(plano.opcoes.find((o) => o.id === "sangue_azul")?.exclusivo).toBe(true);
    expect(plano.autoAplicar).toBe(false);
  });

  it("aceita duas perícias, dois poderes ou um de cada", () => {
    expect(validarBeneficios("aristocrata", ["pericia:nobreza", "pericia:enganacao"]).pericias)
      .toEqual(["nobreza", "enganacao"]);
    expect(validarBeneficios("aristocrata", ["poder:comandar", "poder:sangue_azul"]).poderes)
      .toEqual(["comandar", "sangue_azul"]);
    const misto = validarBeneficios("aristocrata", ["pericia:nobreza", "poder:sangue_azul"]);
    expect(misto.pericias).toEqual(["nobreza"]);
    expect(misto.poderes).toEqual(["sangue_azul"]);
    expect(misto.errors).toEqual([]);
  });

  it("cobra exatamente dois", () => {
    expect(validarBeneficios("aristocrata", ["pericia:nobreza"]).errors).toHaveLength(1);
    expect(
      validarBeneficios("aristocrata", ["pericia:nobreza", "poder:comandar", "pericia:enganacao"])
        .errors
    ).toHaveLength(1);
  });

  it("recusa benefício que não é da origem", () => {
    expect(validarBeneficios("aristocrata", ["pericia:furtividade", "poder:comandar"]).errors)
      .toHaveLength(1);
  });

  it("pool pequeno aplica sozinho (amnésico só tem Lembranças Graduais)", () => {
    const plano = getBeneficiosPlano("amnesico");
    expect(plano.autoAplicar).toBe(true);
    expect(validarBeneficios("amnesico", []).poderes).toEqual(["lembrancas_graduais"]);
  });

  it("origem inexistente não explode", () => {
    expect(getBeneficiosPlano("__nada__").opcoes).toEqual([]);
    expect(validarBeneficios("__nada__", []).errors).toEqual([]);
  });
});

describe("poder de categoria livre", () => {
  it("Gladiador oferece 'um poder de combate à sua escolha' no pool", () => {
    const plano = getBeneficiosPlano("gladiador");
    const livre = plano.opcoes.find((o) => o.tipo === "livre");
    expect(livre?.token).toBe("livre:combate");
    expect(livre?.nome).toBe("Um poder de combate à sua escolha");
  });

  it("escolher o livre marca a categoria pendente", () => {
    const r = validarBeneficios("gladiador", ["pericia:atuacao", "livre:combate"]);
    expect(r.livres).toEqual(["combate"]);
    expect(r.pericias).toEqual(["atuacao"]);
    expect(r.errors).toEqual([]);
  });

  it("Assistente de Laboratório oferece poder da Tormenta", () => {
    const plano = getBeneficiosPlano("assistente_de_laboratorio");
    expect(plano.opcoes.some((o) => o.token === "livre:tormenta")).toBe(true);
  });

  it("origem sem categoria livre não cria a opção", () => {
    expect(getBeneficiosPlano("aristocrata").opcoes.some((o) => o.tipo === "livre")).toBe(false);
  });

  it("item de origem que vem como texto solto não some mais", () => {
    expect(formatItensIniciais("aristocrata")).toContain("traje da corte");
  });
});

describe("origem especial (HA / Atlas): benefício fixo, poder único pelo nome da origem", () => {
  it("Aspirante a Herói concede o poder único sem escolha; Bacharel dá as três perícias e a habilidade", () => {
    const plano = getBeneficiosPlano("aspirante_a_heroi", (slug) => (slug === "aspirante_a_heroi" ? "Aspirante a herói" : null));
    expect(plano.autoAplicar).toBe(true);
    expect(plano.opcoes.map((o) => [o.tipo, o.id, o.nome])).toEqual([["poder", "aspirante_atributo", "Aspirante a herói"]]);
    const bacharel = getBeneficiosPlano("bacharel");
    expect(bacharel.autoAplicar).toBe(true);
    expect(bacharel.opcoes).toHaveLength(4);
    expect(validarBeneficios("bacharel", []).pericias).toHaveLength(3);
    // Acólito (Livro Básico) segue "escolha dois" com o exclusivo entre as opções.
    expect(getBeneficiosPlano("acolito").autoAplicar).toBe(false);
    expect(slugsDoPoderDaOrigem("aspirante_a_heroi", "aspirante_atributo")).toEqual(["aspirante_atributo", "aspirante_a_heroi"]);
    expect(slugsDoPoderDaOrigem("acolito", "medicina")).toEqual(["medicina"]);
  });
});
