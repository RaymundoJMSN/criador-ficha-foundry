import { describe, it, expect } from "vitest";
import { lerPericiasDaFrase, classeDoCompendio } from "../../src/rules/classe-do-compendio.js";
import type { IndexedClasse } from "../../src/compendium/types.js";

/** Frase real do item "Guerreiro" do pack tormenta20.classes. */
const GUERREIRO =
  "Luta (For) ou Pontaria (Des), Fortitude (Con), mais 2 a sua escolha entre " +
  "Adestramento (Car), Atletismo (For), Cavalgar (Des), Guerra (Int), Iniciativa (Des), " +
  "Intimidação (Car), Luta (For), Ofício (Int), Percepção (Sab), Pontaria (Des) e Reflexos (Des).";

describe("lerPericiasDaFrase", () => {
  it("separa fixa, escolha obrigatória e escolha livre", () => {
    const p = lerPericiasDaFrase(GUERREIRO, 2);
    expect(p.fixas).toEqual(["fortitude"]);
    expect(p.escolhas_obrigatorias).toEqual([{ quantidade: 1, opcoes: ["luta", "pontaria"] }]);
    expect(p.escolhas.quantidade).toBe(2);
    expect(p.escolhas.opcoes).toContain("adestramento");
    expect(p.escolhas.opcoes).toContain("reflexos");
  });

  it("descarta o que não é perícia (o '(For)' e a pontuação do fim)", () => {
    const p = lerPericiasDaFrase(GUERREIRO, 2);
    for (const s of [...p.fixas, ...p.escolhas.opcoes]) {
      expect(s).toMatch(/^[a-z_]+$/);
    }
  });

  it("aceita quantidade por extenso", () => {
    const p = lerPericiasDaFrase("Vontade (Sab), mais duas a sua escolha entre Cura (Sab) e Luta (For).");
    expect(p.escolhas.quantidade).toBe(2);
    expect(p.escolhas.opcoes).toEqual(["cura", "luta"]);
  });

  it("frase vazia sem quantidade não abre escolha", () => {
    expect(lerPericiasDaFrase("").escolhas.quantidade).toBe(0);
    expect(lerPericiasDaFrase(undefined as unknown as string).fixas).toEqual([]);
  });
});

describe("classeDoCompendio", () => {
  it("monta a classe a partir do item, com PV/PM do próprio item", () => {
    const item = {
      id: "x",
      name: "Samurai",
      img: "",
      packId: "p",
      type: "classe",
      system: { pvPorNivel: 4, pmPorNivel: 4, pericias: { inatas: GUERREIRO, numero: 2 } },
    } as unknown as IndexedClasse;

    const c = classeDoCompendio(item);
    expect(c.nome).toBe("Samurai");
    expect(c.pv.por_nivel).toBe(4);
    expect(c.pm.por_nivel).toBe(4);
    expect(c.pericias.escolhas.quantidade).toBe(2);
  });
});

describe("classe sem lista de perícias no compêndio", () => {
  it("libera todas as perícias e marca a lista como incompleta", () => {
    const p = lerPericiasDaFrase("", 2);
    expect(p.escolhas.quantidade).toBe(2);
    expect(p.escolhas.opcoes.length).toBeGreaterThan(15);
    expect(p.listaIncompleta).toBe(true);
  });

  it("sem quantidade não marca nada", () => {
    expect(lerPericiasDaFrase("", 0).listaIncompleta).toBe(false);
  });
});
