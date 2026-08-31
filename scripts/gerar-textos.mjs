/**
 * Gera `src/data/textos.json` com as descrições de origem, raça e classe.
 *
 *   python scripts/extrair-pdfs.py     # cache dos PDFs (uma vez)
 *   npm run textos
 *
 * **De onde vem cada coisa.** Número sai do PDF, que é o livro; prosa sai do
 * markdown de `tormenta-livros`, que tem "## Descrição" delimitado. No PDF o
 * verbete de raça é prosa corrida sem marcador nenhum, e a heurística acabava
 * pegando texto do bestiário ("Urso-Coruja", "Tendrículo") no lugar da raça.
 * Origem é exceção: no PDF ela tem "Itens."/"Benefícios." delimitando, então sai
 * de lá mesmo.
 *
 * O arquivo é **gitignorado**: é texto da Jambo e este repositório é público.
 * Sem ele o wizard funciona igual, só sem os parágrafos de descrição.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { livrosDisponiveis, racasDosLivros, classesDosLivros } from "./livros.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "../src/data");
const CACHE = join(HERE, ".cache-pdf");

const dados = (nome) => JSON.parse(readFileSync(join(DATA, nome), "utf-8"));
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Corta no fim de frase, sem passar do limite. */
function primeirasFrases(texto, limite = 420) {
  const frases = String(texto).match(/[^.!?]+[.!?]/g) ?? [String(texto)];
  let out = "";
  for (const f of frases) {
    if (out.length + f.length > limite) break;
    out += f;
  }
  return (out || frases[0] || "").trim();
}

const textos = { origens: {}, racas: {}, classes: {} };

/* --- Origens: do PDF, que delimita com "Itens." e "Benefícios." ----------- */

if (existsSync(CACHE) && readdirSync(CACHE).length > 0) {
  const TUDO = readdirSync(CACHE)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(CACHE, f), "utf-8")))
    .map((c) => c.paginas.map((p) => p.texto).join("\n\f\n"))
    .join("\n\f\n");

  const origens = dados("origens.json");
  const posicoes = [];
  for (const o of origens) {
    const re = new RegExp(`\\b${escapar(o.nome)}\\b`, "gi");
    let m;
    while ((m = re.exec(TUDO))) posicoes.push({ nome: o.nome, id: o.id, inicio: m.index });
  }
  posicoes.sort((a, b) => a.inicio - b.inicio);

  const blocos = new Map();
  posicoes.forEach((p, i) => {
    const fim = Math.min(posicoes[i + 1]?.inicio ?? TUDO.length, p.inicio + 2500);
    const trecho = TUDO.slice(p.inicio, fim);
    if (!/Itens\..*Benef[íi]cios?\./s.test(trecho)) return;
    const anterior = blocos.get(p.id);
    if (!anterior || trecho.length < anterior.length) blocos.set(p.id, trecho);
  });

  for (const o of origens) {
    const bloco = blocos.get(o.id);
    if (!bloco) continue;
    const corpo = bloco.slice(o.nome.length).trim();
    const corte = /Itens\./.exec(corpo);
    const d = (corte ? corpo.slice(0, corte.index) : corpo).trim();
    if (d.length >= 60) textos.origens[o.id] = primeirasFrases(d);
  }
} else {
  console.log("  (sem cache de PDF: origens ficam sem descrição — rode extrair-pdfs.py)");
}

/* --- Raças e classes: do markdown, que tem "## Descrição" ----------------- */

if (livrosDisponiveis()) {
  // O primeiro vence: os livros vêm na ordem core → heróis → dragão brasil, e o
  // verbete do Livro Básico é o que descreve a raça/classe base.
  const porId = (lista) => {
    const m = new Map();
    for (const x of lista) if (!m.has(x.id)) m.set(x.id, x);
    return m;
  };

  const racasLivro = porId(racasDosLivros());
  for (const r of dados("racas.json")) {
    const d = racasLivro.get(r.id)?.descricao;
    if (d) textos.racas[r.id] = primeirasFrases(d);
  }

  const classesLivro = porId(classesDosLivros());
  for (const id of Object.keys(dados("classes.json"))) {
    const d = classesLivro.get(id)?.descricao;
    if (d) textos.classes[id] = primeirasFrases(d);
  }
} else {
  console.log("  (sem tormenta-livros: raças e classes ficam sem descrição)");
}

writeFileSync(join(DATA, "textos.json"), JSON.stringify(textos, null, 2) + "\n", "utf-8");
console.log(
  `textos.json: ${Object.keys(textos.origens).length} origens, ` +
    `${Object.keys(textos.racas).length} raças, ${Object.keys(textos.classes).length} classes`
);
