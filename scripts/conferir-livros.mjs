/**
 * Confere os dados portados do T20-DB contra os PDFs oficiais.
 *
 *   python scripts/extrair-pdfs.py        # uma vez, gera o cache
 *   node scripts/conferir-livros.mjs      # confere tudo
 *   node scripts/conferir-livros.mjs origens
 *
 * **Por que PDF e não o markdown de `tormenta-livros`.** A primeira versão deste
 * script lia o markdown e acusou 19 divergências. Conferidas uma a uma contra o
 * PDF, TODAS eram erro da conversão em markdown, não do T20-DB:
 *   - joia do Aristocrata: markdown T$ 100; PDF, T20-DB e o dataset do arauto T$ 300;
 *   - itens do Amnésico: markdown T$ 100; PDF T$ 500;
 *   - tabela do Nobre: o markdown é de uma impressão anterior (Gritar Ordens no
 *     5º nível, sem Palavras Afiadas); PDF diz "Palavras Afiadas. No 2º nível",
 *     igual ao T20-DB e ao compêndio da Edição Jogo do Ano.
 * O markdown continua ótimo para ler regra; para conferir número, o livro é o PDF.
 *
 * Não corrige nada — lista divergência para decisão humana.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "../src/data");
const CACHE = join(HERE, ".cache-pdf");

const dados = (nome) => JSON.parse(readFileSync(join(DATA, nome), "utf-8"));

if (!existsSync(CACHE) || readdirSync(CACHE).length === 0) {
  console.error("Cache dos PDFs vazio. Rode: python scripts/extrair-pdfs.py");
  process.exit(1);
}

/** Todo o texto dos livros, um blob por livro. */
const LIVROS = Object.fromEntries(
  readdirSync(CACHE)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const c = JSON.parse(readFileSync(join(CACHE, f), "utf-8"));
      return [c.livro, c.paginas.map((p) => p.texto).join("\n\f\n")];
    })
);
const TUDO = Object.values(LIVROS).join("\n\f\n");

const secaoPedida = process.argv[2] ?? null;
const verboso = process.argv.includes("--tudo");
let totalDivergencias = 0;
let totalNaoAchado = 0;

function relatar(secao, divergencias, naoAchado) {
  const cab = `${secao} — ${divergencias.length} divergência(s), ${naoAchado.length} não localizado(s) no PDF`;
  console.log(`\n${"=".repeat(70)}\n${cab}\n${"=".repeat(70)}`);
  for (const l of divergencias) console.log("  x " + l);
  if (verboso) for (const l of naoAchado) console.log("  ? " + l);
  totalDivergencias += divergencias.length;
  totalNaoAchado += naoAchado.length;
}

const norm = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Valores em T$ que aparecem no trecho. */
function valores(texto) {
  return [...String(texto ?? "").matchAll(/T\$\s*([\d.]+)/g)].map((m) =>
    Number(m[1].replace(/\./g, ""))
  );
}

/**
 * Localiza o verbete de cada nome e recorta ATÉ o começo do próximo verbete.
 *
 * Janela de tamanho fixo não serve: o PDF é corrido, e 1.200 caracteres a partir
 * de "Aristocrata" invadem o "Artesão" seguinte — foi assim que o conferidor
 * acusou "T$ 300, T$ 50" para uma origem que só tem um item com preço.
 * Também pula o sumário exigindo o marcador (`Itens.`) logo adiante.
 */
function recortarVerbetes(nomes, marcador, janelaMax = 2500) {
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
    // O marcador tem de estar DENTRO do recorte, não só perto: o nome também
    // aparece no sumário e na tabela-resumo, onde os campos do verbete não
    // existem e o texto que segue é de outra entrada.
    if (!marcador.test(trecho)) return;
    // Entre os recortes válidos, o mais curto é o verbete; os maiores são
    // ocorrências que arrastaram texto vizinho junto.
    const anterior = out.get(p.nome);
    if (!anterior || trecho.length < anterior.length) out.set(p.nome, trecho);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/*  Origens                                                            */
/* ------------------------------------------------------------------ */

function conferirOrigens() {
  const linhas = [];
  const naoAchado = [];
  const origens = dados("origens.json");
  const verbetes = recortarVerbetes(
    origens.map((o) => o.nome),
    /Itens\..*Benef[íi]cios?\./s,
    2500
  );

  for (const origem of origens) {
    const trecho = verbetes.get(origem.nome);
    if (!trecho) {
      naoAchado.push(origem.nome);
      continue;
    }

    // "Itens." vai só até "Benefícios." — sem esse corte o trecho engolia os
    // T$ do poder seguinte (Frutos do Trabalho fala em T$ 100/300/500).
    const itensPdf = /Itens\.\s*(.*?)(?=Benef[íi]cios?\.|$)/s.exec(trecho)?.[1] ?? "";
    const noPdf = valores(itensPdf);
    const noDb = valores(JSON.stringify(origem.itens_iniciais));
    if (noPdf.length && JSON.stringify(noPdf.sort()) !== JSON.stringify(noDb.sort())) {
      linhas.push(
        `${origem.nome}: valor de item — PDF ${noPdf.map((v) => "T$ " + v).join(", ")} | ` +
          `T20-DB ${noDb.map((v) => "T$ " + v).join(", ") || "(nenhum)"}`
      );
    }

    // Benefícios vão até o fecho "(poderes)".
    const benefPdf =
      /Benef[íi]cios?\.\s*(.*?\(poderes?\))/s.exec(trecho)?.[1] ??
      /Benef[íi]cios?\.\s*(.{0,240})/s.exec(trecho)?.[1] ??
      "";
    const faltando = origem.beneficios.pericias.filter(
      (p) => !norm(benefPdf).includes(norm(p.replace(/\s*\([^)]*\)/g, "")))
    );
    if (faltando.length && benefPdf) {
      linhas.push(
        `${origem.nome}: perícia no T20-DB que não achei no benefício do PDF — ${faltando.join(", ")}`
      );
    }
  }

  relatar("ORIGENS", linhas, naoAchado);
}

/* ------------------------------------------------------------------ */
/*  Raças                                                              */
/* ------------------------------------------------------------------ */

const ATRIBUTOS = {
  forca: "for",
  destreza: "des",
  constituicao: "con",
  inteligencia: "int",
  sabedoria: "sab",
  carisma: "car",
};

/** "Constituição +2, Sabedoria +1, Destreza –1" → {con:2, sab:1, des:-1} */
function lerModificadores(texto) {
  const out = {};
  const re = /(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)\s*([+\-–−])\s*(\d+)/gi;
  let m;
  while ((m = re.exec(texto))) {
    const chave = ATRIBUTOS[norm(m[1])];
    if (chave) out[chave] = (m[2] === "+" ? 1 : -1) * Number(m[3]);
  }
  return out;
}

function conferirRacas() {
  const linhas = [];
  const naoAchado = [];

  const racas = dados("racas.json");
  const verbetes = recortarVerbetes(
    racas.map((r) => r.nome),
    /Atributos?\.?\s*[+\-–−]?\s*(Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/s,
    900
  );

  for (const raca of racas) {
    if ((raca.atributos_fixos ?? []).length === 0) continue; // escolhíveis não listam
    const trecho = verbetes.get(raca.nome);
    if (!trecho) {
      naoAchado.push(raca.nome);
      continue;
    }
    const doPdf = lerModificadores(trecho.slice(0, 500));
    if (Object.keys(doPdf).length === 0) {
      naoAchado.push(raca.nome);
      continue;
    }
    const doDb = {};
    for (const f of raca.atributos_fixos) doDb[f.atributo] = f.valor;

    const chaves = new Set([...Object.keys(doPdf), ...Object.keys(doDb)]);
    const difere = [...chaves].filter((k) => (doPdf[k] ?? 0) !== (doDb[k] ?? 0));
    if (difere.length) {
      linhas.push(
        `${raca.nome}: modificadores — PDF ${JSON.stringify(doPdf)} | T20-DB ${JSON.stringify(doDb)}`
      );
    }
  }

  relatar("RAÇAS", linhas, naoAchado);
}

/* ------------------------------------------------------------------ */
/*  Classes                                                            */
/* ------------------------------------------------------------------ */

function conferirClasses() {
  const linhas = [];
  const naoAchado = [];
  const classes = dados("classes.json");
  const verbetes = recortarVerbetes(
    Object.values(classes).map((c) => c.nome),
    /Pontos de Vida/i,
    3000
  );

  for (const [id, classe] of Object.entries(classes)) {
    const trecho = verbetes.get(classe.nome);
    if (!trecho) {
      naoAchado.push(classe.nome);
      continue;
    }
    const pv = /Pontos de Vida[^.]*?(\d+)\s*\+\s*Constitui/i.exec(trecho);
    const pvNivel = /por n[íi]vel[^.]*?(\d+)\s*\+\s*Constitui/i.exec(trecho);
    const pm = /Pontos de Mana[^.]*?(\d+)\s*por n[íi]vel/i.exec(trecho);

    if (pv && classe.pv.inicial != null && Number(pv[1]) !== classe.pv.inicial) {
      linhas.push(`${classe.nome}: PV inicial — PDF ${pv[1]} | T20-DB ${classe.pv.inicial}`);
    }
    if (pvNivel && classe.pv.por_nivel != null && Number(pvNivel[1]) !== classe.pv.por_nivel) {
      linhas.push(
        `${classe.nome}: PV por nível — PDF ${pvNivel[1]} | T20-DB ${classe.pv.por_nivel}`
      );
    }
    if (pm && Number(pm[1]) !== classe.pm.por_nivel) {
      linhas.push(`${classe.nome}: PM por nível — PDF ${pm[1]} | T20-DB ${classe.pm.por_nivel}`);
    }
    if (!pv && !pm) naoAchado.push(`${classe.nome} (PV/PM não extraíram)`);
    void id;
  }

  relatar("CLASSES", linhas, naoAchado);
}

/* ------------------------------------------------------------------ */

if (!secaoPedida || secaoPedida === "origens") conferirOrigens();
if (!secaoPedida || secaoPedida === "racas") conferirRacas();
if (!secaoPedida || secaoPedida === "classes") conferirClasses();

console.log(
  `\nTotal: ${totalDivergencias} divergência(s), ${totalNaoAchado} não localizado(s).` +
    (verboso ? "" : " Use --tudo para ver os não localizados.")
);
