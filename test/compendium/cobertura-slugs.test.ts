/**
 * Auditoria de cobertura: quantos slugs do T20-DB o resolver acha no compêndio REAL.
 *
 * Fora do `npm test` de propósito (o vitest.config só inclui `test/`) — depende de um
 * Foundry instalado nesta máquina. Rodar:
 *
 *   npm test (pula sozinho onde não houver Foundry)
 *
 * Variáveis: FOUNDRY_CODE (instalação) e FOUNDRY_DATA (pasta de dados).
 * Os packs ficam travados enquanto o Foundry roda, então são copiados antes de ler.
 */
import { describe, it, expect } from "vitest";
import { cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolverPoder, type ViaResolucao } from "../../src/compendium/resolver.js";
import prog from "../../src/data/progressao_classes.json";
import classes from "../../src/data/classes.json";

const FOUNDRY_CODE = process.env["FOUNDRY_CODE"] ?? "X:/FoundryVTT/Code";
const FOUNDRY_DATA = process.env["FOUNDRY_DATA"] ?? "X:/FoundryVTT/Data";
const PACKS = join(FOUNDRY_DATA, "systems/tormenta20/packs");
/**
 * O mundo do Ray tem o módulo `suplementos-de-arton`, que traz os poderes de
 * Heróis de Arton e dos livros de deuses. Em runtime o CompendiumIndex varre
 * TODOS os packs, então a medição precisa varrer também — olhar só o sistema
 * subestima a cobertura.
 */
const PACKS_MODULO = join(FOUNDRY_DATA, "modules/suplementos-de-arton/packs");

interface ItemPack {
  name: string;
  system?: { descricao?: string; tipo?: string };
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

  const tmp = mkdtempSync(join(tmpdir(), "t20w-packs-"));
  const itens: ItemPack[] = [];
  try {
    for (const nome of nomes) {
      const destino = join(tmp, nome);
      // LOCK é o único arquivo que o Foundry mantém aberto; o resto copia limpo.
      const origem = existsSync(join(PACKS, nome))
        ? join(PACKS, nome)
        : join(PACKS_MODULO, nome);
      if (!existsSync(origem)) continue;
      cpSync(origem, destino, { recursive: true, filter: (s) => !s.endsWith("LOCK") });
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

describe.skipIf(!existsSync(PACKS))("cobertura de slugs contra o compêndio instalado", () => {
  it("toda habilidade automática de classe acha item", async () => {
    const itens = await lerPacks(["poderes", "poderes-distincao"]);
    expect(itens.length).toBeGreaterThan(500);

    const porVia: Partial<Record<ViaResolucao | "AUSENTE", number>> = {};
    const ausentes: string[] = [];

    for (const [classeId, dados] of Object.entries(prog as Record<string, ProgClasse>)) {
      for (const [nivel, linha] of Object.entries(dados.tabela ?? {})) {
        for (const slug of linha.automaticos ?? []) {
          const via = resolverPoder(slug, classeId, itens)?.via ?? "AUSENTE";
          porVia[via] = (porVia[via] ?? 0) + 1;
          if (via === "AUSENTE") ausentes.push(`${classeId} nv${nivel} ${slug}`);
        }
      }
    }

    console.log("habilidades automáticas por via:", porVia);
    // "bencao_da_justica" é sub-escolha (Égide ou Montaria), não item único — Bloco 3.
    expect(ausentes.filter((a) => !a.includes("bencao_da_justica"))).toEqual([]);
  });

  it("mede quanto dos poderes de classe está instalado", async () => {
    const itens = await lerPacks([
      "poderes",
      "poderes-distincao",
      "herois-de-arton",
      "deuses-de-arton",
      "distincoes",
    ]);
    let achados = 0;
    let total = 0;
    const semItem: string[] = [];

    for (const [classeId, dados] of Object.entries(classes as Record<string, ClasseData>)) {
      for (const slug of dados.poderes_classe_ids ?? []) {
        total++;
        if (resolverPoder(slug, classeId, itens)) achados++;
        else semItem.push(`${classeId}/${slug}`);
      }
    }

    const pct = Math.round((achados / total) * 100);
    console.log(`poderes de classe instalados: ${achados}/${total} (${pct}%)`);
    console.log(`sem item: ${semItem.length}`, semItem.join(", "));
    // Com os suplementos instalados passa de 85%; abaixo disso é regressão.
    expect(pct).toBeGreaterThanOrEqual(80);
  });
});

interface ProgClasse {
  tabela?: Record<string, { automaticos: string[]; escolhas: number }>;
}
interface ClasseData {
  poderes_classe_ids?: string[];
}
