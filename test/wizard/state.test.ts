import { describe, it, expect } from "vitest";
import { WizardState } from "../../src/wizard/state.js";

describe("WizardState", () => {
  it("starts with defaults", () => {
    const s = new WizardState();
    expect(s.nivel).toBe(1);
    expect(s.nome).toBe("");
    expect(s.classeId).toBe("");
    expect(s.racaId).toBe("");
  });

  it("apply sets a field", () => {
    const s = new WizardState();
    s.apply({ nivel: 5, nome: "Aragorn" });
    expect(s.nivel).toBe(5);
    expect(s.nome).toBe("Aragorn");
  });

  it("apply does not reset other fields", () => {
    const s = new WizardState();
    s.apply({ racaId: "humano" });
    s.apply({ classeId: "guerreiro" });
    expect(s.racaId).toBe("humano");
    expect(s.classeId).toBe("guerreiro");
  });

  it("serialize → JSON string", () => {
    const s = new WizardState();
    s.apply({ nome: "Test", nivel: 3 });
    const json = s.serialize();
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.nome).toBe("Test");
    expect(parsed.nivel).toBe(3);
  });

  it("deserialize restores state", () => {
    const s = new WizardState();
    s.apply({ nome: "Gandalf", classeId: "arcanista", nivel: 10 });
    const json = s.serialize();
    const s2 = WizardState.deserialize(json);
    expect(s2.nome).toBe("Gandalf");
    expect(s2.classeId).toBe("arcanista");
    expect(s2.nivel).toBe(10);
  });

  it("isComplete false when required fields empty", () => {
    const s = new WizardState();
    expect(s.isComplete()).toBe(false);
  });

  it("isComplete true when required fields set", () => {
    const s = new WizardState();
    s.apply({
      nome: "Hero",
      nivel: 1,
      racaId: "humano",
      origemId: "acolito",
      classeId: "guerreiro",
      metodoAtributos: "compra_pontos",
      atributosBase: { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 },
    });
    expect(s.isComplete()).toBe(true);
  });
});
