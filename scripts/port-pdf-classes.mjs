// Porta a tabela de progressão das classes a partir dos PDFs (cache de
// scripts/extrair-pdfs.py em scripts/.cache-pdf/*.json) para
// src/data/progressao_livros.json.
//
// Serve para as classes que o T20-DB não cobre (Frade, Treinador e as 14
// classes de Heróis de Arton) e, de quebra, confere as 14 do Livro Básico
// contra progressao_classes.json (o que veio do T20-DB).
//
// Uso: node scripts/port-pdf-classes.mjs [--conferir]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".cache-pdf");
const OUT = resolve(HERE, "../src/data");

const LIVROS = {
  "tormenta20-core.json": "Tormenta20 (Livro Básico)",
  "herois-arton.json": "Heróis de Arton",
  "deuses-arton.json": "Deuses de Arton",
  "deuses-menores.json": "Guia de Deuses Menores",
  "guia-npcs.json": "Guia de NPCs & DBs",
  "ameacas-arton.json": "Ameaças de Arton",
};

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const NUM = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, três: 3, quatro: 4, cinco: 5 };

function paginas(arquivo) {
  const d = JSON.parse(readFileSync(join(CACHE, arquivo), "utf-8"));
  return Array.isArray(d) ? d : d.paginas;
}

/**
 * "1º Ataque especial +4 2º Poder de guerreiro 3º Durão, … 20º Campeão" → linha por nível.
 * Os marcadores são lidos em ordem (1º, 2º, …): "redução de dano 2 6º" não vira
 * "26º", e "1 8º" (extração quebrada) vira 18º quando é o próximo esperado.
 */
function linhasDaTabela(texto) {
  const t = texto.replace(/\s+/g, " ");
  const re = /(\d)\s?(\d)?º(?=\s)/g;
  const marcas = [];
  let esperado = 1;
  let pos = 0;
  while (pos < t.length && esperado <= 20) {
    re.lastIndex = pos;
    const m = re.exec(t);
    if (!m) break;
    // "2 2º" (o +2 da Fúria seguido do marcador 2º) não é 22 nem 2: o dígito
    // solto antes do espaço é texto; só "1 8º" (dois dígitos) ou "2º" valem.
    const ok = m[2] ? m[1] + m[2] : m[1];
    if (Number(ok) === esperado) {
      const fim = m.index + m[0].length;
      marcas.push({ nv: esperado, ini: m.index, fim });
      esperado++;
      pos = fim;
    } else {
      pos = m.index + 1;
    }
  }
  const linhas = {};
  let fim = 0;
  marcas.forEach((mk, i) => {
    let celula = t.slice(mk.fim, i + 1 < marcas.length ? marcas[i + 1].ini : mk.fim + 120).trim();
    if (i === marcas.length - 1) {
      // Última linha: corta no número da página, num "•" ou no primeiro ponto —
      // o texto agora é o livro inteiro emendado, não só a página.
      celula = celula.split(/\s\d{1,3}(?=\s|$)|\s[•]\s|\.\s|\.$/)[0].trim();
      fim = mk.fim + celula.length;
    }
    linhas[mk.nv] = celula;
  });
  return { linhas, fim };
}

/** Uma célula da tabela → {automaticos, escolhas, circulo}. */
function classificar(celula, classeSlug) {
  const out = { automaticos: [], escolhas: 0, circulo: null };
  for (let parte of celula.split(/,\s*(?![^()]*\))/)) {
    parte = parte.trim().replace(/\.$/, "");
    if (!parte) continue;
    const p = slug(parte.replace(/\(.*?\)/g, "").replace(/\+\s*\d+.*$/, ""));
    if (/^poder_de_/.test(p) || p === `poder_de_${classeSlug}`) {
      out.escolhas += 1;
      continue;
    }
    const mag = /^magias\s*\((\d)º\s*c[ií]rculo\)/i.exec(parte);
    if (mag) {
      out.circulo = Number(mag[1]);
      if (out.circulo === 1) out.automaticos.push("magias");
      continue;
    }
    if (p) out.automaticos.push(p);
  }
  return out;
}

/** Texto "Magias." da classe → progressão de magias conhecidas (ou null). */
function magiasDoTexto(texto) {
  const plano = texto.replace(/\s+/g, " ");
  let t = null;
  let ini = null;
  for (const m of plano.matchAll(/Magias\.\s+(.{0,900})/gs)) {
    const cand = m[1].toLowerCase();
    const i = /come[çc]a com (\S+) magias/.exec(cand);
    if (i) {
      t = cand;
      ini = i;
      break;
    }
  }
  if (!t || !ini) return null;
  const inicio = NUM[ini[1]] ?? Number(ini[1]);
  if (!inicio) return null;
  const par = /a cada n[íi]vel par/.test(t);
  const impar = /a cada n[íi]vel [íi]mpar/.test(t);
  const tradicao = /magias divinas/.test(t) ? "divina" : /magias arcanas/.test(t) ? "arcana" : null;
  const esc = /escolha (\S+) escolas/.exec(t);
  return {
    inicio,
    por_nivel: par || impar ? 0 : 1,
    por_nivel_par: par ? 1 : 0,
    por_nivel_impar: impar ? 1 : 0,
    tradicao,
    escolas: esc ? (NUM[esc[1]] ?? 0) : 0,
  };
}

const TITULO = /Tabela\s*[\d\-–]*\s*:?\s*(?:O|A)\s+([A-ZÁ-Úa-zá-ú][\wÁ-Úá-ú ]{2,30}?)\s*\n?\s*Nível\s+Habilidades\s+de\s+Classe/g;

export function portarClassesDosPdfs() {
  const result = {};
  for (const arquivo of readdirSync(CACHE)) {
    if (!LIVROS[arquivo]) continue;
    const pags = paginas(arquivo);
    // Um texto só, com o offset de cada página, para achar a seção de cada classe
    // (o que vem entre a tabela anterior e a tabela desta).
    let texto = "";
    const inicioPagina = [];
    for (const pg of pags) {
      inicioPagina.push({ pos: texto.length, pagina: pg.pagina });
      texto += (pg.texto ?? "") + "\n";
    }
    const paginaDe = (pos) => [...inicioPagina].reverse().find((p) => p.pos <= pos)?.pagina;

    const tabelas = [];
    TITULO.lastIndex = 0;
    let m;
    while ((m = TITULO.exec(texto))) tabelas.push({ nome: m[1].trim(), inicio: m.index, fim: m.index + m[0].length });

    tabelas.forEach((tb, i) => {
      const classeSlug = slug(tb.nome);
      const depois = texto.slice(tb.fim);
      const { linhas, fim: fimTabela } = linhasDaTabela(depois);
      tb.fimTabela = tb.fim + fimTabela;
      if (Object.keys(linhas).length < 20) {
        console.warn(`  ! ${tb.nome} (${arquivo} p.${paginaDe(tb.inicio)}): só ${Object.keys(linhas).length} níveis lidos`);
      }
      const tabela = {};
      const circulos = {};
      for (const [nv, celula] of Object.entries(linhas)) {
        const c = classificar(celula, classeSlug);
        if (c.automaticos.length || c.escolhas) tabela[nv] = { automaticos: c.automaticos, escolhas: c.escolhas };
        if (c.circulo) circulos[nv] = c.circulo;
      }
      // Seção da classe: do fim da tabela anterior (≈2.000 caracteres depois do
      // título dela) até o título desta. Sem tabela anterior, 3 páginas atrás.
      const inicioSecao = i > 0 ? tabelas[i - 1].fimTabela : Math.max(0, tb.inicio - 12000);
      const secao = texto.slice(Math.min(inicioSecao, tb.inicio), tb.inicio).replace(/\s+/g, " ");
      tb.secao = secao;
      const magias = Object.keys(circulos).length ? magiasDoTexto(secao + " " + depois.slice(0, 4000)) : null;
      result[classeSlug] = {
        nome: tb.nome,
        fonte: { livro: LIVROS[arquivo], pagina: paginaDe(tb.inicio) },
        tabela,
        circulos,
        magias,
      };
      tb.slug = classeSlug;
    });

    // "Proficiências. Armas marciais e escudos." / "Perícias. Como o cavaleiro básico."
    // 1ª passada: última ocorrência entre o fim da tabela anterior e esta tabela.
    // 2ª passada (quem ficou sem): primeira ocorrência depois da própria tabela,
    // desde que a classe seguinte não a tenha reclamado como sua (duas colunas).
    for (const campo of [
      { chave: "proficiencias_texto", re: /Profici[êe]ncias\. ([^.]{2,120})\./g },
      { chave: "pericias_texto", re: /Per[íi]cias\. ([^.]{2,320})\./g },
    ]) {
      const achados = tabelas.map((tb) => {
        let ultimo = null;
        const inicio = tabelas.indexOf(tb) > 0 ? tabelas[tabelas.indexOf(tb) - 1].fimTabela : Math.max(0, tb.inicio - 12000);
        const janela = texto.slice(Math.min(inicio, tb.inicio), tb.inicio);
        for (const x of janela.matchAll(campo.re)) ultimo = { valor: x[1].replace(/\s+/g, " ").trim(), pos: inicio + x.index };
        return ultimo;
      });
      tabelas.forEach((tb, i) => {
        let achado = achados[i];
        if (!achado) {
          const limite = achados[i + 1]?.pos ?? tabelas[i + 1]?.inicio ?? tb.fimTabela + 6000;
          const janela = texto.slice(tb.fimTabela, Math.min(limite, tb.fimTabela + 6000));
          const x = campo.re.exec(janela);
          campo.re.lastIndex = 0;
          if (x) achado = { valor: x[1].replace(/\s+/g, " ").trim(), pos: tb.fimTabela + x.index };
        }
        result[tb.slug][campo.chave] = achado?.valor ?? null;
      });
    }
  }
  return result;
}

/** Diferenças entre a leitura do PDF e o que veio do T20-DB, por classe do Livro Básico. */
export function conferir(pdf, t20db) {
  const baseSlug = (s) => s.replace(/(?:_con_mais)?_\d+[a-z0-9+]*(?:_(?:circulo|melhorias?))?$/, "");
  const linhas = [];
  for (const [cls, db] of Object.entries(t20db)) {
    const p = pdf[cls];
    if (!p) {
      linhas.push(`${cls}: sem tabela no PDF`);
      continue;
    }
    for (let nv = 1; nv <= 20; nv++) {
      const a = db.tabela?.[nv] ?? { automaticos: [], escolhas: 0 };
      const b = p.tabela?.[nv] ?? { automaticos: [], escolhas: 0 };
      const fa = [...new Set(a.automaticos.map(baseSlug))].sort();
      const fb = [...new Set(b.automaticos.map(baseSlug))].sort();
      if (a.escolhas !== b.escolhas) linhas.push(`${cls} nv${nv}: escolhas T20-DB=${a.escolhas} PDF=${b.escolhas}`);
      const so_a = fa.filter((x) => !fb.includes(x));
      const so_b = fb.filter((x) => !fa.includes(x));
      if (so_a.length || so_b.length) linhas.push(`${cls} nv${nv}: T20-DB tem [${so_a}] / PDF tem [${so_b}]`);
    }
    const ca = JSON.stringify(db.circulos ?? {});
    const cb = JSON.stringify(p.circulos ?? {});
    if (ca !== cb) linhas.push(`${cls}: círculos T20-DB=${ca} PDF=${cb}`);
    if (db.magias && p.magias) {
      for (const k of ["inicio", "por_nivel", "por_nivel_par", "por_nivel_impar", "tradicao", "escolas"]) {
        if (String(db.magias[k] ?? 0) !== String(p.magias[k] ?? 0)) linhas.push(`${cls}: magias.${k} T20-DB=${db.magias[k]} PDF=${p.magias[k]}`);
      }
    } else if (Boolean(db.magias) !== Boolean(p.magias)) {
      linhas.push(`${cls}: magias T20-DB=${JSON.stringify(db.magias)} PDF=${JSON.stringify(p.magias)}`);
    }
  }
  return linhas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!existsSync(CACHE)) {
    console.error("Sem scripts/.cache-pdf — rode scripts/extrair-pdfs.py antes.");
    process.exit(1);
  }
  const pdf = portarClassesDosPdfs();
  const t20db = JSON.parse(readFileSync(join(OUT, "progressao_classes.json"), "utf-8"));
  // Só grava o que o T20-DB não cobre: o T20-DB é a fonte conferida das 14 do LB.
  const extras = Object.fromEntries(Object.entries(pdf).filter(([k]) => !t20db[k]));
  writeFileSync(join(OUT, "progressao_livros.json"), JSON.stringify(extras, null, 2) + "\n", "utf-8");
  console.log(`progressao_livros.json: ${Object.keys(extras).length} classe(s) fora do T20-DB — ${Object.keys(extras).join(", ")}`);
  if (process.argv.includes("--conferir")) {
    const difs = conferir(pdf, t20db);
    console.log(difs.length ? `\nDiferenças PDF × T20-DB (${difs.length}):\n  ` + difs.join("\n  ") : "\nPDF × T20-DB: sem diferenças.");
  }
}
