import { describe, it, expect } from "vitest";
import { getBeneficiosPlano, validarBeneficios } from "../../src/rules/origem.js";

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
