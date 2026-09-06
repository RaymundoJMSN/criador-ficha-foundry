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
  marcas.forEach((mk, i) => {
    let celula = t.slice(mk.fim, i + 1 < marcas.length ? marcas[i + 1].ini : undefined).trim();
    if (i === marcas.length - 1) {
      // Última linha: corta o que vier depois da tabela (número da página, texto corrido).
      celula = celula.split(/\s[•]\s|\.\s/)[0].replace(/\s\d+$/, "").trim();
    }
    linhas[mk.nv] = celula;
  });
  return linhas;
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
    pags.forEach((pg, idx) => {
      const texto = pg.texto ?? "";
      let m;
      TITULO.lastIndex = 0;
      while ((m = TITULO.exec(texto))) {
        const nome = m[1].trim();
        const classeSlug = slug(nome);
        const depois = texto.slice(m.index + m[0].length);
        const linhas = linhasDaTabela(depois);
        if (Object.keys(linhas).length < 20) {
          console.warn(`  ! ${nome} (${arquivo} p.${pg.pagina}): só ${Object.keys(linhas).length} níveis lidos`);
        }
        const tabela = {};
        const circulos = {};
        for (const [nv, celula] of Object.entries(linhas)) {
          const c = classificar(celula, classeSlug);
          if (c.automaticos.length || c.escolhas) tabela[nv] = { automaticos: c.automaticos, escolhas: c.escolhas };
          if (c.circulo) circulos[nv] = c.circulo;
        }
        // Texto da classe: a tabela costuma vir logo depois da descrição.
        const janela = [idx - 3, idx - 2, idx - 1, idx, idx + 1]
          .filter((i) => i >= 0 && i < pags.length)
          .map((i) => pags[i].texto ?? "")
          .join(" ");
        const magias = Object.keys(circulos).length ? magiasDoTexto(janela) : null;
        result[classeSlug] = {
          nome,
          fonte: { livro: LIVROS[arquivo], pagina: pg.pagina },
          tabela,
          circulos,
          magias,
        };
      }
    });
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
