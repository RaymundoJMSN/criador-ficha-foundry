import { describe, it, expect } from "vitest";
import { pendencias } from "../../src/rules/engine.js";
import { WizardState } from "../../src/wizard/state.js";
import type { EngineState } from "../../src/rules/engine.js";

const estado = (patch: Partial<WizardState> = {}): EngineState =>
  new WizardState(patch as never) as unknown as EngineState;

describe("pendencias — o que bloqueia o botão Criar", () => {
  it("ficha vazia lista os quatro campos obrigatórios", () => {
    const falta = pendencias(estado());
    expect(falta).toContain("Dê um nome ao personagem.");
    expect(falta).toContain("Escolha uma raça.");
    expect(falta).toContain("Escolha uma origem.");
    expect(falta).toContain("Escolha uma classe.");
  });

  it("cobra o caminho quando a classe tem caminhos", () => {
    const falta = pendencias(
      estado({ nome: "X", racaId: "r", origemId: "aristocrata", classeId: "c", classeNome: "Arcanista" })
    );
    expect(falta).toContain("Escolha o caminho de Arcanista.");
  });

  it("cobra os poderes que faltam para o nível", () => {
    const falta = pendencias(
      estado({ nome: "X", racaId: "r", origemId: "aristocrata", classeId: "c", classeNome: "Guerreiro", nivel: 5 })
    );
    expect(falta.some((f) => f.startsWith("Escolha 4 poder(es)"))).toBe(true);
  });

  it("cobra as magias que faltam para um conjurador", () => {
    const falta = pendencias(
      estado({ nome: "X", racaId: "r", origemId: "aristocrata", classeId: "c", classeNome: "Clérigo", nivel: 1 })
    );
    expect(falta.some((f) => f.startsWith("Escolha 3 magia(s)"))).toBe(true);
  });

  it("guerreiro nv1 não é cobrado por magia nem por poder", () => {
    const falta = pendencias(
      estado({ nome: "X", racaId: "r", origemId: "aristocrata", classeId: "c", classeNome: "Guerreiro", nivel: 1 })
    );
    expect(falta.some((f) => f.includes("magia"))).toBe(false);
    expect(falta.some((f) => f.includes("poder(es)"))).toBe(false);
  });
});
