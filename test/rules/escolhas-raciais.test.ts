import { describe, it, expect } from "vitest";
import {
  escolhasDaRaca,
  pedidoAtivo,
  periciasDeEscolhasRaciais,
  itensDeEscolhasRaciais,
  pendenciasDeEscolhasRaciais,
} from "../../src/rules/raca.js";

describe("escolhas de habilidade racial", () => {
  it("Osteon tem Memória Póstuma com três caminhos", () => {
    const [memoria] = escolhasDaRaca("osteon");
    expect(memoria?.habilidade).toBe("Memória Póstuma");
    expect(memoria?.ramos.map((r) => r.pedido.tipo)).toEqual([
      "pericia",
      "poder",
      "habilidade_outra_raca",
    ]);
  });

  it("Golem escolhe o elemento numa lista, sem ramos", () => {
    const [fonte] = escolhasDaRaca("golem");
    expect(fonte?.ramos).toEqual([]);
    expect(fonte?.direto?.tipo).toBe("lista");
    expect(fonte?.direto?.opcoes?.map((o) => o.id)).toEqual(["agua", "ar", "fogo", "terra"]);
  });

  it("Humano não repete a perícia que o passo Perícias já dá", () => {
    expect(escolhasDaRaca("humano")).toEqual([]);
  });

  it("o ramo escolhido define o que é pedido", () => {
    const [memoria] = escolhasDaRaca("osteon");
    expect(pedidoAtivo(memoria!, {})).toBeNull();
    expect(pedidoAtivo(memoria!, { raca_memoria_postuma_ramo: "memoria_poder_geral" })?.tipo).toBe(
      "poder"
    );
  });

  it("perícia escolhida na raça entra como treinada", () => {
    const r = periciasDeEscolhasRaciais("osteon", {
      raca_memoria_postuma_ramo: "memoria_pericia",
      raca_memoria_postuma_0_0: "furtividade",
    });
    expect(r.treinadas).toEqual(["furtividade"]);
    expect(r.bonus).toEqual([]);
  });

  it("Deformidade do Lefou dá bônus, não treino", () => {
    const r = periciasDeEscolhasRaciais("lefou", {
      raca_deformidade_ramo: "deformidade_duas_pericias",
      raca_deformidade_0_0: "luta",
      raca_deformidade_0_1: "cura",
    });
    expect(r.treinadas).toEqual([]);
    expect(r.bonus).toEqual([
      { pericia: "luta", valor: 2 },
      { pericia: "cura", valor: 2 },
    ]);
  });

  it("poder escolhido vira item para o writer", () => {
    expect(
      itensDeEscolhasRaciais("osteon", {
        raca_memoria_postuma_ramo: "memoria_poder_geral",
        raca_memoria_postuma_0_0: "abc123",
      })
    ).toEqual(["abc123"]);
  });

  it("escolha incompleta vira pendência", () => {
    expect(pendenciasDeEscolhasRaciais("osteon", {})).toEqual([
      "Memória Póstuma: escolha uma opção.",
    ]);
    expect(
      pendenciasDeEscolhasRaciais("osteon", { raca_memoria_postuma_ramo: "memoria_pericia" })
    ).toEqual(["Memória Póstuma: complete a escolha."]);
    expect(
      pendenciasDeEscolhasRaciais("osteon", {
        raca_memoria_postuma_ramo: "memoria_pericia",
        raca_memoria_postuma_0_0: "luta",
      })
    ).toEqual([]);
  });

  it("raça sem escolha não cobra nada", () => {
    expect(pendenciasDeEscolhasRaciais("anao", {})).toEqual([]);
  });
});
