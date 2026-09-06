/**
 * Monta os personagens da matriz de aceitação de ponta a ponta contra os
 * compêndios REAIS instalados, sem abrir o Foundry: escolhas → pendências →
 * itens que o writer resolveria → ficha do mapper.
 *
 * Pula sozinho onde não houver Foundry instalado (ver FOUNDRY_DATA).
 * É o teste que faltava: os outros cobrem regra pura, e os defeitos de origem
 * viviam justamente na junção entre regra, compêndio e actor.
 */
import { describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { WizardState } from "../../src/wizard/state.js";
import { pendencias, type EngineState } from "../../src/rules/engine.js";
import { habilidadesAte, slotsDePoder, magiasConhecidas } from "../../src/rules/progressao.js";
import { resolverPoder } from "../../src/compendium/resolver.js";
import { getClasse } from "../../src/rules/classe.js";
import { getTrainedPericaCodes, mapStateToActorData } from "../../src/actor/mapper.js";

const FOUNDRY_CODE = process.env["FOUNDRY_CODE"] ?? "X:/FoundryVTT/Code";
const FOUNDRY_DATA = process.env["FOUNDRY_DATA"] ?? "X:/FoundryVTT/Data";
const PACKS = join(FOUNDRY_DATA, "systems/tormenta20/packs");

interface ItemPack {
  name: string;
  system?: { descricao?: string; tipo?: string; circulo?: number };
}

async function lerPacks(nomes: string[]): Promise<ItemPack[]> {
  const levelUrl = pathToFileURL(
    join(FOUNDRY_CODE, "resources/app/node_modules/classic-level/index.js")
  ).href;
  const { ClassicLevel } = (await import(/* @vite-ignore */ levelUrl)) as {
    ClassicLevel: new (
      p: string,
      o: Record<string, unknown>
    ) => {
      open(): Promise<void>;
      close(): Promise<void>;
      iterator(): AsyncIterable<[string, ItemPack]>;
    };
  };
  const tmp = mkdtempSync(join(tmpdir(), "t20w-int-"));
  const itens: ItemPack[] = [];
  try {
    for (const nome of nomes) {
      const destino = join(tmp, nome);
      cpSync(join(PACKS, nome), destino, { recursive: true, filter: (s) => !s.endsWith("LOCK") });
      const db = new ClassicLevel(destino, { valueEncoding: "json" });
      await db.open();
      for await (const [chave, valor] of db.iterator()) {
        if (chave.startsWith("!items!")) itens.push(valor);
      }
      await db.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return itens;
}

const est = (s: WizardState) => s as unknown as EngineState;

describe.skipIf(!existsSync(PACKS))("personagens de aceitação (compêndio real)", () => {
  it("guerreiro humano nv7: habilidades certas, sem Campeão, 6 poderes", async () => {
    const poderes = await lerPacks(["poderes", "poderes-distincao"]);

    const s = new WizardState({
      nome: "Teste NV7",
      nivel: 7,
      racaId: "r",
      racaNome: "Humano",
      classeId: "c",
      classeNome: "Guerreiro",
      origemId: "aristocrata",
      atributosBase: { for: 3, des: 1, con: 2, int: 0, sab: 1, car: -1 },
      escolhasPorItem: {
        raca_modificadores: [["for", "con", "des"]],
        origem_beneficios: ["pericia:nobreza", "poder:sangue_azul"],
        pericias: {
          obrigatorias: [["luta"]],
          escolhas: ["atletismo", "percepcao"],
          extras_int: [],
          raca: ["cavalgar", "iniciativa"],
        },
      },
      poderes: ["p1", "p2", "p3", "p4", "p5", "p6"],
    });

    // Nível 7 dá 6 escolhas de poder (níveis 2..7).
    expect(slotsDePoder("Guerreiro", 7)).toBe(6);

    // Habilidades automáticas: Ataque Especial (escalonado), Durão, Ataque Extra.
    const nomes = habilidadesAte("Guerreiro", 7)
      .map((slug) => resolverPoder(slug, "guerreiro", poderes)?.item.name)
      .filter(Boolean);
    expect(nomes).toContain("Ataque Especial");
    expect(nomes).toContain("Durão");
    expect(nomes).toContain("Ataque Extra");
    expect(nomes).not.toContain("Campeão");

    // Perícia da origem chega na ficha junto das da classe.
    const treinadas = getTrainedPericaCodes(s);
    expect(treinadas["nobr"]).toBe(true); // benefício de origem
    expect(treinadas["luta"]).toBe(true); // obrigatória do guerreiro
    expect(treinadas["fort"]).toBe(true); // fixa do guerreiro

    // O +1 escolhido do humano NÃO entra na base: vai no item de raça (.racial).
    expect(mapStateToActorData(s).system.atributos.for.base).toBe(3);

    expect(pendencias(est(s))).toEqual([]);
  });

  it("arcanista mago nv5: caminho, 9 magias (4 + 4 níveis + 1 pelo 2º círculo), 4 poderes", async () => {
    const s = new WizardState({
      nome: "Mago NV5",
      nivel: 5,
      racaId: "r",
      racaNome: "Elfo",
      classeId: "c",
      classeNome: "Arcanista",
      origemId: "aristocrata",
      escolhasPorItem: {
        classe_caminho: "caminho_do_arcanista_mago",
        origem_beneficios: ["pericia:nobreza", "poder:sangue_azul"],
        pericias: { obrigatorias: [], escolhas: ["conhecimento", "diplomacia"], extras_int: [], raca: [] },
      },
      poderes: ["p1", "p2", "p3", "p4"],
      magias: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"],
    });

    // LB p.37, Mago: "sempre que ganha acesso a um novo círculo de magias,
    // aprende uma magia adicional daquele círculo".
    expect(magiasConhecidas("Arcanista", 5, "caminho_do_arcanista_mago")).toBe(9);
    expect(slotsDePoder("Arcanista", 5)).toBe(4);
    expect(pendencias(est(s))).toEqual([]);
  });

  it("feiticeiro nv1 cobra a linhagem e o tipo de dano da dracônica", () => {
    const base = {
      nome: "Feiticeiro",
      nivel: 1,
      racaId: "r",
      racaNome: "Humano",
      classeId: "c",
      classeNome: "Arcanista",
      origemId: "aristocrata",
      magias: ["m1", "m2", "m3"],
    };
    const escolhasBase = {
      raca_modificadores: [["for", "con", "des"]],
      origem_beneficios: ["pericia:nobreza", "poder:sangue_azul"],
      pericias: { obrigatorias: [], escolhas: ["conhecimento", "diplomacia"], extras_int: [], raca: ["furtividade"] },
    };

    const semLinhagem = new WizardState({
      ...base,
      escolhasPorItem: { ...escolhasBase, classe_caminho: "caminho_do_arcanista_feiticeiro" },
    });
    expect(pendencias(est(semLinhagem))).toContain("Escolha sua linhagem sobrenatural.");

    const semDano = new WizardState({
      ...base,
      escolhasPorItem: {
        ...escolhasBase,
        classe_caminho: "caminho_do_arcanista_feiticeiro",
        classe_linhagem_feiticeiro: "draconica",
      },
    });
    expect(pendencias(est(semDano))).toContain("Tipo De Dano.");

    const completo = new WizardState({
      ...base,
      escolhasPorItem: {
        ...escolhasBase,
        classe_caminho: "caminho_do_arcanista_feiticeiro",
        classe_linhagem_feiticeiro: "draconica",
        classe_linhagem_feiticeiro_draconica: "fogo",
      },
    });
    expect(pendencias(est(completo))).toEqual([]);
  });

  it("clérigo nv3 exige divindade e 5 magias", () => {
    const s = new WizardState({
      nome: "Clérigo",
      nivel: 3,
      racaId: "r",
      racaNome: "Humano",
      classeId: "clerigo",
      classeNome: "Clérigo",
      origemId: "acolito",
      escolhasPorItem: {
        raca_modificadores: [["sab", "con", "car"]],
        origem_beneficios: ["pericia:religiao", "pericia:cura"],
        pericias: { obrigatorias: [], escolhas: ["conhecimento", "diplomacia"], extras_int: [], raca: ["vontade"] },
      },
      poderes: ["p1", "p2"],
    });

    const falta = pendencias(est(s));
    expect(falta).toContain("Esta classe exige uma divindade.");
    expect(falta.some((f) => f.startsWith("Escolha 5 magia(s)"))).toBe(true);
  });

  it("cada raça do compêndio acha suas regras no T20-DB", async () => {
    const racas = await lerPacks(["racas"]);
    const { getRaca } = await import("../../src/rules/raca.js");
    const semRegra = racas.filter((r) => !getRaca(r.name)).map((r) => r.name);
    expect(semRegra).toEqual([]);
  });
});
