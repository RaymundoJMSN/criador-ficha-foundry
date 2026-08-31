import { describe, it, expect } from "vitest";
import { getClasse, cadeiaSubEscolhas, respostaSubEscolha } from "../../src/rules/classe.js";

const ARC = "arcanista";
const FEITICEIRO = "caminho_do_arcanista_feiticeiro";

describe("caminhos de classe", () => {
  it("arcanista tem os três caminhos, com o slug do item do compêndio", () => {
    expect(getClasse(ARC)?.caminhos?.map((c) => c.slug)).toEqual([
      "caminho_do_arcanista_bruxo",
      "caminho_do_arcanista_feiticeiro",
      "caminho_do_arcanista_mago",
    ]);
  });

  it("guerreiro não tem caminho", () => {
    expect(getClasse("guerreiro")?.caminhos).toEqual([]);
  });
});

describe("cadeiaSubEscolhas", () => {
  it("bruxo não abre sub-escolha", () => {
    const r = cadeiaSubEscolhas(ARC, "caminho_do_arcanista_bruxo", {});
    expect(r.pendente).toBeNull();
  });

  it("feiticeiro pede a linhagem", () => {
    const r = cadeiaSubEscolhas(ARC, FEITICEIRO, {});
    expect(r.pendente?.label).toBe("Escolha sua linhagem sobrenatural");
  });

  it("linhagem dracônica ainda pede o tipo de dano", () => {
    const r = cadeiaSubEscolhas(ARC, FEITICEIRO, {
      classe_linhagem_feiticeiro: "draconica",
    });
    expect(r.pendente?.label).toBe("Tipo De Dano");
    expect(r.respondidas["classe_linhagem_feiticeiro"]).toBe("draconica");
  });

  it("linhagem feérica fecha a cadeia", () => {
    const r = cadeiaSubEscolhas(ARC, FEITICEIRO, { classe_linhagem_feiticeiro: "feerica" });
    expect(r.pendente).toBeNull();
  });

  it("cadeia completa com dracônica + fogo", () => {
    const r = cadeiaSubEscolhas(ARC, FEITICEIRO, {
      classe_linhagem_feiticeiro: "draconica",
      classe_linhagem_feiticeiro_draconica: "fogo",
    });
    expect(r.pendente).toBeNull();
  });
});

describe("respostaSubEscolha", () => {
  it("acha a linhagem sem depender do nome exato da chave", () => {
    const escolhas = {
      classe_linhagem_feiticeiro: "rubra",
      classe_linhagem_feiticeiro_draconica: "fogo",
    };
    expect(respostaSubEscolha(ARC, FEITICEIRO, escolhas, "linhagem")).toBe("rubra");
  });

  it("devolve vazio quando não há linhagem", () => {
    expect(respostaSubEscolha(ARC, "caminho_do_arcanista_mago", {}, "linhagem")).toBe("");
  });
});
