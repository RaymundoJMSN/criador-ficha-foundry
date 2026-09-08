import { describe, it, expect } from "vitest";
import { subEscolhaDoPoder, pendenciasDeSubEscolhas, respostasDeSubEscolhas } from "../../src/rules/subescolhas-poder.js";

describe("sub-escolhas de poder", () => {
  it("regra estruturada pelo slug do item; texto com 'escolha um' NÃO vira campo genérico", () => {
    expect(subEscolhaDoPoder("Aspirante a herói")?.tipo).toBe("atributo");
    expect(subEscolhaDoPoder("Inimigo de (Criatura)")?.tipo).toBe("lista");
    expect(subEscolhaDoPoder("Totem Espiritual")?.opcoes?.find((o) => o.id === "lobo")?.magia).toBe("localizacao");
    const generica = subEscolhaDoPoder("Fúria Elemental", "Escolha um elemento entre fogo e frio. Você recebe…");
    expect(generica).toBeNull();
    expect(subEscolhaDoPoder("Ataque Especial", "Você pode gastar 1 PM para receber +4.")).toBeNull();
  });

  it("sem regra não há pendência nem resposta; estruturada vira", () => {
    const adq = [
      { slug: "aspirante_a_heroi", nome: "Aspirante a herói", vezes: 1, fonte: "origem", descricao: "" },
      { slug: "furia_elemental", nome: "Fúria Elemental", vezes: 1, fonte: "poder", descricao: "Escolha um elemento." },
    ];
    expect(pendenciasDeSubEscolhas(adq, {})).toEqual(["Aspirante a herói: atributo que recebe +1 — escolha."]);
    expect(respostasDeSubEscolhas(adq, { sp_aspirante_a_heroi_0: "for", sp_furia_elemental_0: "fogo" }).map((r) => r.valor)).toEqual(["for"]);
  });
});
