/**
 * `src/data/pericias_sistema.json`: como o sistema Tormenta20 guarda cada
 * perícia (atributo-chave, "somente treinada", penalidade de armadura,
 * modificador de tamanho). A ficha exportada precisa disso: escrever só
 * `{treinado:true}` num `system.pericias.<code>` apaga o resto do SkillData e a
 * perícia aparece sem nome e com atributo Força na ficha importada.
 *
 * `label` fica de fora de propósito: perícia padrão tem label vazio e a ficha
 * mostra o nome pelo código; só ofício próprio (`ofi1`, `custom: true`) usa
 * label ("Ofício: Carpinteiro").
 *
 *   node scripts/gerar-pericias.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SISTEMA = process.env.FOUNDRY_SYSTEM ?? "X:/FoundryVTT/Data/systems/tormenta20/tormenta20.mjs";
const SAIDA = join(HERE, "../src/data/pericias_sistema.json");

const src = readFileSync(SISTEMA, "utf-8");
const bloco = src.slice(src.indexOf("pericias = {"), src.indexOf("pericias = {") + 8000);
const re = /(\w{3,5}): \{ abl: "(\w+)"([^}]*)\}/g;
const out = {};
let m;
while ((m = re.exec(bloco))) {
  const rotulo = /label: "([^"]+)"/.exec(m[3]);
  if (!rotulo) continue;
  out[m[1]] = {
    atributo: m[2],
    st: /trainedOnly: ?true/.test(m[3]),
    pda: /armorPenalty: ?true/.test(m[3]),
    size: /sizeMod: ?true/.test(m[3]),
  };
}
if (Object.keys(out).length < 25) throw new Error(`só ${Object.keys(out).length} perícias — o formato do sistema mudou?`);
writeFileSync(SAIDA, JSON.stringify(out, null, 2) + "\n", "utf-8");
console.log(`${SAIDA}: ${Object.keys(out).length} perícias`);
