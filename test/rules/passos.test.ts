import { describe, it, expect } from "vitest";
import { passosAplicaveis, WizardStep } from "../../src/rules/steps.js";

describe("passosAplicaveis", () => {
  it("lutador não passa por Magias", () => {
    expect(passosAplicaveis("lutador")).not.toContain(WizardStep.Magias);
  });

  it("arcanista passa por Magias", () => {
    expect(passosAplicaveis("arcanista")).toContain(WizardStep.Magias);
  });

  it("paladino só vê Magias com Orar; lutador com Truque Mágico? não, é do ladino", () => {
    expect(passosAplicaveis("paladino")).not.toContain(WizardStep.Magias);
    expect(passosAplicaveis("paladino", ["orar"])).toContain(WizardStep.Magias);
    expect(passosAplicaveis("ladino", ["truque_magico"])).toContain(WizardStep.Magias);
  });

  it("sem classe ainda, mostra o fluxo sem Magias", () => {
    expect(passosAplicaveis("")).not.toContain(WizardStep.Magias);
  });

  it("mantém a ordem e o resto dos passos", () => {
    const p = passosAplicaveis("guerreiro");
    expect(p[0]).toBe(WizardStep.Nivel);
    expect(p[p.length - 1]).toBe(WizardStep.Revisao);
    expect(p).toContain(WizardStep.Divindade);
  });
});
