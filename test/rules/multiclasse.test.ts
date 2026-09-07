import { describe, it, expect } from "vitest";
import {
  classesDoPersonagem,
  classesExtras,
  niveisNaClasse,
  slotsDePoderTotal,
  habilidadesDeTodas,
  errosMulticlasse,
  temMulticlasse,
} from "../../src/rules/multiclasse.js";
import { checkPrereqs } from "../../src/rules/poderes.js";
import { passosAplicaveis, WizardStep } from "../../src/rules/steps.js";

const st = (nivel: number, multiclasse: unknown = undefined) => ({
  nivel,
  classeId: "g",
  classeNome: "Guerreiro",
  escolhasPorItem: multiclasse === undefined ? {} : { multiclasse },
});

describe("multiclasse — LB p.35 (Zaled: arcanista 3 / paladino 1 = personagem 4)", () => {
  it("sem multiclasse a principal tem todos os níveis", () => {
    const c = classesDoPersonagem(st(5));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ classeSlug: "guerreiro", niveis: 5, principal: true, caminhoChave: "classe_caminho" });
    expect(temMulticlasse(st(5))).toBe(false);
  });
  it("guerreiro 5 com ladino 2 = guerreiro 3 / ladino 2", () => {
    const s = st(5, [{ classeId: "l", classeNome: "Ladino", niveis: 2 }]);
    const c = classesDoPersonagem(s);
    expect(c.map((x) => [x.classeSlug, x.niveis])).toEqual([["guerreiro", 3], ["ladino", 2]]);
    expect(c[1]!.caminhoChave).toBe("classe_caminho_ladino");
    expect(niveisNaClasse(s, "ladino")).toBe(2);
    expect(niveisNaClasse(s, "arcanista")).toBe(0);
    expect(errosMulticlasse(s)).toEqual([]);
  });
  it("linha repetida, principal de novo ou níveis demais dão erro", () => {
    expect(errosMulticlasse(st(3, [{ classeId: "l", classeNome: "Ladino", niveis: 3 }]))).toEqual([
      "Os níveis das outras classes (3) têm de somar menos que o nível 3.",
    ]);
    expect(errosMulticlasse(st(5, [{ classeId: "g", classeNome: "Guerreiro", niveis: 1 }]))).toContain(
      "A classe principal não entra de novo na multiclasse."
    );
    expect(classesExtras(st(5, [{ classeId: "l", classeNome: "Ladino", niveis: 1 }, { classeId: "l", classeNome: "Ladino", niveis: 1 }]))).toHaveLength(1);
    expect(errosMulticlasse(st(5, [{ classeId: "", classeNome: "", niveis: 1 }]))).toContain(
      "Escolha a classe da linha da multiclasse ou remova a linha."
    );
  });
  it("vagas de poder e habilidades somam por classe no nível dela", () => {
    // guerreiro nv3: escolhas nv2, nv3 = 2; ladino nv2: nv2 = 1
    const s = st(5, [{ classeId: "l", classeNome: "Ladino", niveis: 2 }]);
    expect(slotsDePoderTotal(s)).toBe(3);
    const habs = habilidadesDeTodas(s);
    expect(habs.filter((h) => h.classe.classeSlug === "guerreiro").map((h) => h.slug)).toEqual(
      expect.arrayContaining(["ataque_especial", "durao"])
    );
    expect(habs.filter((h) => h.classe.classeSlug === "ladino").map((h) => h.slug)).toEqual(
      expect.arrayContaining(["ataque_furtivo_1d6"])
    );
    expect(habs.map((h) => h.slug)).not.toContain("ataque_especial_8");
  });
  it("pré-requisito 'X níveis de classe' usa o nível NA classe", () => {
    const base = { nivel: 5, atributos: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }, classeSlug: "guerreiro", racaSlug: "humano", periciasTreinadas: [], poderes: [] };
    const req = [{ tipo: "nivel_classe", classe: "ladino", valor: 2 }];
    expect(checkPrereqs(req, { ...base, niveisPorClasse: { guerreiro: 3, ladino: 2 } }).eligible).toBe(true);
    expect(checkPrereqs(req, { ...base, niveisPorClasse: { guerreiro: 4, ladino: 1 } }).eligible).toBe(false);
    expect(checkPrereqs(req, base).eligible).toBe(false);
  });
  it("Magias aparece se qualquer classe conjura", () => {
    expect(passosAplicaveis(["guerreiro", "arcanista"])).toContain(WizardStep.Magias);
    expect(passosAplicaveis(["guerreiro", "ladino"])).not.toContain(WizardStep.Magias);
  });
});
