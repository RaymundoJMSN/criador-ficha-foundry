/**
 * Gera `src/data/textos.json` com as descrições de origem, raça e classe.
 *
 *   python scripts/extrair-pdfs.py     # cache dos PDFs (uma vez)
 *   node scripts/gerar-textos.mjs
 *
 * O arquivo é **gitignorado**: é texto da Jambo e este repositório é público.
 * Quem clonar roda estes dois comandos e gera o seu; sem eles o wizard funciona
 * igual, só sem os parágrafos de descrição.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "../src/data");
const CACHE = join(HERE, ".cache-pdf");

if (!existsSync(CACHE) || readdirSync(CACHE).length === 0) {
  console.error("Cache dos PDFs vazio. Rode: python scripts/extrair-pdfs.py");
  process.exit(1);
}

const TUDO = readdirSync(CACHE)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(CACHE, f), "utf-8")))
  .map((c) => c.paginas.map((p) => p.texto).join("\n\f\n"))
  .join("\n\f\n");

const dados = (nome) => JSON.parse(readFileSync(join(DATA, nome), "utf-8"));
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mesmo recorte do conferidor: menor bloco que contém o marcador. */
function recortar(nomes, marcador, janelaMax = 2500) {
  const posicoes = [];
  for (const nome of nomes) {
    const re = new RegExp(`\\b${escapar(nome)}\\b`, "gi");
    let m;
    while ((m = re.exec(TUDO))) posicoes.push({ nome, inicio: m.index });
  }
  posicoes.sort((a, b) => a.inicio - b.inicio);

  const out = new Map();
  posicoes.forEach((p, i) => {
    const fim = Math.min(posicoes[i + 1]?.inicio ?? TUDO.length, p.inicio + janelaMax);
    const trecho = TUDO.slice(p.inicio, fim);
    if (!marcador.test(trecho)) return;
    const anterior = out.get(p.nome);
    if (!anterior || trecho.length < anterior.length) out.set(p.nome, trecho);
  });
  return out;
}

/** A descrição é o que vem entre o nome e o primeiro campo do verbete. */
function descricao(trecho, nome, ateRegex) {
  const semNome = trecho.slice(nome.length).trim();
  const corte = ateRegex.exec(semNome);
  const texto = (corte ? semNome.slice(0, corte.index) : semNome).trim();
  // Parágrafo solto de meia dúzia de palavras é sobra de diagramação.
  return texto.length >= 60 ? texto : null;
}

const textos = { origens: {}, racas: {}, classes: {} };

{
  const origens = dados("origens.json");
  const blocos = recortar(
    origens.map((o) => o.nome),
    /Itens\..*Benef[íi]cios?\./s
  );
  for (const o of origens) {
    const bloco = blocos.get(o.nome);
    if (!bloco) continue;
    const d = descricao(bloco, o.nome, /Itens\./);
    if (d) textos.origens[o.id] = d;
  }
}

{
  const racas = dados("racas.json");
  const blocos = recortar(
    racas.map((r) => r.nome),
    /Atributos?\.?\s*[+\-–−]?\s*(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/s,
    1800
  );
  for (const r of racas) {
    const bloco = blocos.get(r.nome);
    if (!bloco) continue;
    const d = descricao(bloco, r.nome, /Atributos?\.?\s*(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/);
    if (d) textos.racas[r.id] = d;
  }
}

{
  const classes = dados("classes.json");
  const blocos = recortar(
    Object.values(classes).map((c) => c.nome),
    /Pontos de Vida/i,
    3000
  );
  for (const [id, c] of Object.entries(classes)) {
    const bloco = blocos.get(c.nome);
    if (!bloco) continue;
    const d = descricao(bloco, c.nome, /Pontos de Vida/i);
    if (d) textos.classes[id] = d;
  }
}

writeFileSync(join(DATA, "textos.json"), JSON.stringify(textos, null, 2) + "\n", "utf-8");
console.log(
  `textos.json: ${Object.keys(textos.origens).length} origens, ` +
    `${Object.keys(textos.racas).length} raças, ${Object.keys(textos.classes).length} classes`
);
