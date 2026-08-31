/**
 * Leitor dos livros em markdown (`tormenta-livros`).
 *
 * Serve a dois consumidores:
 *   - `conferir-livros.mjs` — compara o T20-DB com o livro e lista divergência;
 *   - `port-t20db.mjs --textos` — gera as descrições (arquivo gitignorado).
 *
 * O texto é da Jambo: fica no disco do Ray, nunca num commit.
 * Caminho por `TORMENTA_LIVROS`; o padrão é a junction do Soltos.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export const LIVROS = process.env.TORMENTA_LIVROS ?? "X:/Soltos/tormenta-livros/livros";

export function livrosDisponiveis() {
  return existsSync(LIVROS);
}

function ler(caminho) {
  // Tira o frontmatter YAML: senão ele vaza para dentro da descrição.
  const FRONTMATTER = new RegExp("^---\r?\n[\s\S]*?\r?\n---\r?\n");
  return readFileSync(caminho, "utf-8").replace(FRONTMATTER, "");
}

/** Tira negrito, links e imagens — sobra o texto corrido. */
export function limpar(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slug(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Divide um markdown nas seções de um dado nível (`###` → nivel 3).
 * Um título de nível igual OU MAIOR fecha a seção — sem isso o corpo de
 * "### Proficiências" seguia engolindo o "## Habilidades de Classe" seguinte.
 */
export function seccionar(md, nivel) {
  const linhas = md.split(/\r?\n/);
  const secoes = [];
  let atual = null;
  for (const linha of linhas) {
    const cabecalho = /^(#{1,6}) +(.+)$/.exec(linha);
    if (cabecalho) {
      const grau = cabecalho[1].length;
      if (grau === nivel) {
        atual = { titulo: cabecalho[2].trim(), corpo: [] };
        secoes.push(atual);
        continue;
      }
      if (grau <= nivel) {
        atual = null;
        continue;
      }
    }
    if (atual) atual.corpo.push(linha);
  }
  return secoes.map((s) => ({ titulo: s.titulo, corpo: s.corpo.join("\n") }));
}

/** Corpo de uma seção `## Título` (para restringir a busca a um bloco). */
export function bloco(md, tituloRegex, nivel = 2) {
  return seccionar(md, nivel).find((s) => tituloRegex.test(s.titulo))?.corpo ?? null;
}

/** Valor de `**Campo:** valor`, `**Campo.** valor` ou `**Campo**: valor`. */
export function campo(corpo, nome) {
  const re = new RegExp(`\\*\\*${nome}\\s*[:.]?\\*\\*\\s*[:.]?\\s*(.+)`, "i");
  const m = re.exec(corpo);
  return m ? limpar(m[1]) : null;
}

/** Valor de uma célula de tabela `| **Campo** | valor |`. */
export function celula(corpo, nome) {
  const re = new RegExp(`^\\|\\s*\\*\\*${nome}\\*\\*\\s*\\|\\s*([^|]+)\\|`, "im");
  const m = re.exec(corpo);
  return m ? limpar(m[1]) : null;
}

function arquivosDe(...partes) {
  const dir = join(LIVROS, ...partes);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !/^README/i.test(f))
    .map((f) => ({ nome: f, texto: ler(join(dir, f)) }));
}

/* ------------------------------------------------------------------ */
/*  Origens                                                            */
/* ------------------------------------------------------------------ */

/**
 * Cada livro escreve origem de um jeito:
 *   core            `### Nome` + `**Itens:**` + `**Benefícios:**`
 *   dragão brasil   `## Nome` + `**Itens.**` + `**Benefício.**`
 *   heróis de arton um arquivo por origem, `## Benefícios` em lista
 */
export function origensDosLivros() {
  const out = [];

  const core = join(LIVROS, "tormenta20-core/02-criacao-personagens/05-origens.md");
  if (existsSync(core)) {
    for (const s of seccionar(ler(core), 3)) {
      const itens = campo(s.corpo, "Itens");
      const beneficios = campo(s.corpo, "Benefícios");
      if (!itens && !beneficios) continue;
      out.push({
        livro: "tormenta20-core",
        nome: s.titulo,
        id: slug(s.titulo),
        itens,
        beneficios,
        descricao: primeiroParagrafo(s.corpo),
      });
    }
  }

  for (const arq of arquivosDe("dragao-brasil", "03-origens")) {
    for (const s of seccionar(arq.texto, 2)) {
      const itens = campo(s.corpo, "Itens");
      const beneficios = campo(s.corpo, "Benefício") ?? campo(s.corpo, "Benefícios");
      if (!itens && !beneficios) continue;
      out.push({
        livro: "dragao-brasil",
        nome: s.titulo,
        id: slug(s.titulo),
        itens,
        beneficios,
        descricao: primeiroParagrafo(s.corpo),
      });
    }
  }

  for (const arq of arquivosDe("herois-arton", "01-campeoes-arton")) {
    if (!arq.nome.startsWith("origem-")) continue;
    const titulo = /^#\s+(.+)$/m.exec(arq.texto)?.[1]?.trim();
    if (!titulo) continue;
    const secoes = Object.fromEntries(seccionar(arq.texto, 2).map((s) => [s.titulo, s.corpo]));
    out.push({
      livro: "herois-arton",
      nome: titulo,
      id: slug(titulo),
      itens: secoes["Itens Iniciais"] ? limpar(secoes["Itens Iniciais"]) : null,
      beneficios: secoes["Benefícios"] ? limpar(secoes["Benefícios"]) : null,
      descricao: secoes["Descrição"] ? limpar(secoes["Descrição"]) : null,
    });
  }

  return out;
}

/** Divide por vírgula ignorando vírgulas dentro de parênteses. */
export function dividirForaDeParenteses(texto) {
  const partes = [];
  let atual = "";
  let profundidade = 0;
  for (const ch of String(texto)) {
    if (ch === "(") profundidade++;
    if (ch === ")") profundidade = Math.max(0, profundidade - 1);
    if (ch === "," && profundidade === 0) {
      partes.push(atual);
      atual = "";
      continue;
    }
    atual += ch;
  }
  partes.push(atual);
  return partes;
}

function primeiroParagrafo(corpo) {
  for (const bruto of corpo.split(/\r?\n\r?\n/)) {
    const p = limpar(bruto);
    if (!p || p.startsWith("|") || p.startsWith(">") || p.startsWith("#")) continue;
    if (/^(Itens|Benefícios?|Descrição)\b/i.test(p)) continue;
    if (p.length < 40) continue;
    return p;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Raças                                                              */
/* ------------------------------------------------------------------ */

const ATRIBUTO_POR_NOME = {
  forca: "for",
  for: "for",
  destreza: "des",
  des: "des",
  constituicao: "con",
  con: "con",
  inteligencia: "int",
  int: "int",
  sabedoria: "sab",
  sab: "sab",
  carisma: "car",
  car: "car",
};

/** "Con +2, Sab +1, Des –1" → {con: 2, sab: 1, des: -1} */
export function lerModificadores(texto) {
  if (!texto) return null;
  const out = {};
  // O traço do livro é o "–" (en dash), não o hífen.
  const re = /([A-Za-zÀ-ÿ]+)\s*([+\-–−])\s*(\d+)/g;
  let m;
  while ((m = re.exec(texto))) {
    const chave = ATRIBUTO_POR_NOME[slug(m[1])];
    if (!chave) continue;
    out[chave] = (m[2] === "+" ? 1 : -1) * Number(m[3]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function racasDosLivros() {
  const out = [];
  const fontes = [
    ["tormenta20-core", "03-racas"],
    ["herois-arton", "01-campeoes-arton"],
    ["dragao-brasil", "01-racas"],
  ];

  for (const [livro, pasta] of fontes) {
    for (const arq of arquivosDe(livro, pasta)) {
      if (arq.nome.startsWith("origem-")) continue;
      const titulo = /^#\s+(.+)$/m.exec(arq.texto)?.[1]?.trim();
      if (!titulo) continue;

      const modTexto =
        celula(arq.texto, "Modificadores") ??
        campo(arq.texto, "Modificadores de Atributo") ??
        (seccionar(arq.texto, 3).find((s) => /Modificadores de Atributo/i.test(s.titulo))?.corpo ??
          null);

      const blocoHab = bloco(arq.texto, /Habilidades de Ra[çc]a/i);
      const habilidades = seccionar(blocoHab ?? "", 3)
        .filter((s) => !/Modificadores de Atributo/i.test(s.titulo))
        .map((s) => s.titulo);

      out.push({
        livro,
        nome: titulo,
        id: slug(titulo),
        modificadores: lerModificadores(modTexto ? limpar(modTexto) : null),
        tamanho: celula(arq.texto, "Tamanho"),
        deslocamento: celula(arq.texto, "Deslocamento"),
        habilidades,
        descricao: primeiroParagrafo(
          seccionar(arq.texto, 2).find((s) => /Descrição/i.test(s.titulo))?.corpo ?? arq.texto
        ),
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Classes                                                            */
/* ------------------------------------------------------------------ */

export function classesDosLivros() {
  const out = [];
  for (const [livro, pasta] of [
    ["tormenta20-core", "04-classes"],
    ["dragao-brasil", "02-classes"],
  ]) {
    for (const arq of arquivosDe(livro, pasta)) {
      const titulo = /^#\s+(.+)$/m.exec(arq.texto)?.[1]?.trim();
      // "Guerreiro - Poderes de Classe" é lista de poder, não o verbete da classe.
      if (!titulo || /poderes de classe/i.test(titulo)) continue;

      const pv = /\*\*Inicial\*\*:\s*(\d+)\s*PV/i.exec(arq.texto);
      const pvNivel = /\*\*Por n[íi]vel\*\*:\s*\+?(\d+)\s*PV/i.exec(arq.texto);
      const pmNivel = /\*\*Por n[íi]vel\*\*:\s*\+?(\d+)\s*PM/i.exec(arq.texto);

      // Tabela final: | **3º** | Durão, poder de guerreiro |
      const niveis = {};
      const re = /^\|\s*\*\*(\d+)º\*\*\s*\|\s*([^|]+)\|/gm;
      let m;
      while ((m = re.exec(arq.texto))) {
        // "Abençoado (+Car PM, devoto)" é UMA habilidade — a vírgula de dentro
        // dos parênteses não separa.
        niveis[m[1]] = dividirForaDeParenteses(limpar(m[2]))
          .map((s) => s.trim())
          .filter(Boolean);
      }

      out.push({
        livro,
        nome: titulo.replace(/\s*[-–]\s*.*$/, "").trim(),
        id: slug(titulo.replace(/\s*[-–]\s*.*$/, "")),
        pv_inicial: pv ? Number(pv[1]) : null,
        pv_por_nivel: pvNivel ? Number(pvNivel[1]) : null,
        pm_por_nivel: pmNivel ? Number(pmNivel[1]) : null,
        pericias_treinadas: campo(arq.texto, "Treinadas"),
        pericias_escolha: campo(arq.texto, "Escolha \\+2"),
        proficiencias: (() => {
          const sec = seccionar(arq.texto, 3).find((s) => /Profici[êe]ncias/i.test(s.titulo));
          return sec ? limpar(sec.corpo) : null;
        })(),
        niveis,
        descricao: primeiroParagrafo(
          seccionar(arq.texto, 2).find((s) => /Descrição/i.test(s.titulo))?.corpo ?? arq.texto
        ),
      });
    }
  }
  return out;
}
