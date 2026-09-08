/**
 * Despeja os compêndios instalados (sistema + módulos de suplementos) em
 * `site/data/compendio.json`, no formato que o shim do site (`site/shim.ts`)
 * apresenta ao módulo como se fosse `game.packs`.
 *
 *   node scripts/exportar-compendio.mjs
 *
 * O arquivo é texto da Jambo (descrições) — fica fora do git, como textos.json.
 * Roda na máquina do Ray com o Foundry instalado (packs em LevelDB; copiados
 * antes de ler porque o Foundry mantém o LOCK enquanto roda).
 */
import { cpSync, mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOUNDRY_CODE = process.env.FOUNDRY_CODE ?? "X:/FoundryVTT/Code";
const FOUNDRY_DATA = process.env.FOUNDRY_DATA ?? "X:/FoundryVTT/Data";
const SAIDA = resolve(HERE, "../site/data/compendio.json");

/** [pasta dos packs, prefixo do `collection` que o Foundry usa] */
const FONTES = [
  [join(FOUNDRY_DATA, "systems/tormenta20/packs"), "tormenta20"],
  [join(FOUNDRY_DATA, "modules/suplementos-de-arton/packs"), "suplementos-de-arton"],
  [join(FOUNDRY_DATA, "modules/compendium-extra-t20/packs"), "compendium-extra-t20"],
];
const TIPOS = new Set(["poder", "magia", "race", "classe", "equipamento", "arma", "consumivel", "tesouro"]);

const { ClassicLevel } = await import(pathToFileURL(join(FOUNDRY_CODE, "resources/app/node_modules/classic-level/index.js")).href);
const tmp = mkdtempSync(join(tmpdir(), "t20w-export-"));
const packs = [];
try {
  for (const [dir, prefixo] of FONTES) {
    if (!existsSync(dir)) continue;
    for (const nome of readdirSync(dir)) {
      const origem = join(dir, nome);
      if (!existsSync(join(origem, "CURRENT"))) continue;
      const destino = join(tmp, `${prefixo}-${nome}`);
      cpSync(origem, destino, { recursive: true, filter: (s) => !s.endsWith("LOCK") });
      const db = new ClassicLevel(destino, { valueEncoding: "json" });
      await db.open();
      const folders = [];
      const items = [];
      for await (const [chave, v] of db.iterator()) {
        if (chave.startsWith("!folders!")) folders.push({ _id: v._id, name: v.name, folder: v.folder ?? null });
        else if (chave.startsWith("!items!") && TIPOS.has(v.type)) items.push(v);
      }
      await db.close();
      if (items.length > 0) packs.push({ collection: `${prefixo}.${nome}`, documentName: "Item", folders, items });
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify({ geradoEm: new Date().toISOString(), packs }));
const total = packs.reduce((n, p) => n + p.items.length, 0);
console.log(`${SAIDA}: ${packs.length} packs, ${total} itens`);
