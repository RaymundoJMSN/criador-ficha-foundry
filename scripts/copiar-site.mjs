/**
 * Depois do `vite build` do site: copia templates, CSS, lang e o despejo do
 * compêndio para dentro de `site/dist`, nos mesmos caminhos que o módulo usa
 * no Foundry (`modules/t20-ficha-wizard/...`).
 *
 *   node scripts/copiar-site.mjs            # só monta site/dist
 *   node scripts/copiar-site.mjs --deploy   # e copia para o servidor do t20-ficha-online
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(HERE, "..");
const DIST = join(RAIZ, "site/dist");
const MOD = join(DIST, "modules/t20-ficha-wizard");
const DEPLOY = process.env.T20W_SITE_DEPLOY ?? "X:/FoundryVTT/Data/modules/t20-ficha-online/server/public/criar";

if (!existsSync(DIST)) throw new Error("rode `vite build --config vite.config.site.ts` antes");
for (const pasta of ["templates", "styles", "lang"]) cpSync(join(RAIZ, pasta), join(MOD, pasta), { recursive: true });
const dados = join(RAIZ, "site/data/compendio.json");
if (existsSync(dados)) {
  mkdirSync(join(DIST, "data"), { recursive: true });
  cpSync(dados, join(DIST, "data/compendio.json"));
  // Ícones dos itens: o site serve só o dist, então copia os arquivos que o despejo referencia.
  const RAIZES = [process.env.FOUNDRY_DATA ?? "X:/FoundryVTT/Data", join(process.env.FOUNDRY_CODE ?? "X:/FoundryVTT/Code", "resources/app/public")];
  const imgs = new Set();
  for (const pack of JSON.parse(readFileSync(dados, "utf8")).packs) for (const it of pack.items) if (it.img && !/^(https?:|data:)/.test(it.img)) imgs.add(it.img);
  let copiados = 0;
  for (const img of imgs) {
    const origem = RAIZES.map((r) => join(r, img)).find((f) => existsSync(f));
    if (!origem) continue;
    mkdirSync(dirname(join(DIST, img)), { recursive: true });
    cpSync(origem, join(DIST, img));
    copiados++;
  }
  console.log(`${copiados}/${imgs.size} ícones copiados`);
} else {
  console.warn("site/data/compendio.json não existe — rode `npm run export:compendio`");
}
console.log(`site montado em ${DIST}`);

if (process.argv.includes("--deploy")) {
  rmSync(DEPLOY, { recursive: true, force: true });
  cpSync(DIST, DEPLOY, { recursive: true });
  console.log(`publicado em ${DEPLOY}`);
}
