// Porta os deuses menores (Guia de Deuses Menores) a partir do cache do PDF:
// nome e a linha "Devotos." (raças/classes aceitas) → src/data/deuses_menores.json.
// Os poderes concedidos vêm do compêndio em runtime (poder tipo "concedido"
// com subtipo = nome do deus).
//
// Uso: node scripts/port-pdf-deuses-menores.mjs
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".cache-pdf", "deuses-menores.json");
const OUT = resolve(HERE, "../src/data/deuses_menores.json");

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Nomes curtos dos deuses menores (os mesmos dos poderes concedidos no compêndio). */
const DEUSES = [
  "A Espada-Deus", "Akok", "Altair", "Anilatir", "Apis", "Artaphan", "Ayllana", "Beluhga", "Benthos", "Betsumial",
  "Blinar", "Caerdellach", "Canastra", "Canora", "Cette", "Champarr", "Dahriol", "Drumak", "Dunsark", "Elrophin",
  "Escamandra", "Esmeralda", "Garanaam", "Garth", "Goharom", "Granto", "Gratissa", "Hippion", "Hurlaagh", "Hydora",
  "Inghlblhpholstgt", "Irione", "Jandra", "Klangor", "Kurur Lianth", "Laan", "Lamashtu", "Lupan", "Luvithy", "Marina",
  "Mzzileyn", "Nerelim", "Neruíte", "O Deus Cristal de Urielka", "O Deus das Cidades", "O Deus do Medo", "Piscigeros",
  "Rhond", "Sartan", "Sckhar", "Sunnary", "Tamagrah", "Teldiskan", "Tessalus", "Toris", "Ur", "Yasshara", "Zadbblein",
  "Zakharov",
];

/** Raças cujo nome não muda no plural (ou muda de um jeito que a regra geral erra). */
const INVARIANTES = new Set([
  "aggelus", "moreau", "dahllan", "hynne", "qareen", "kallyanach", "galokk", "tabrachi", "kliren", "nezumi", "kappa",
  "tengu", "eiradaan", "osteon", "sulfure", "lefou", "suraggel", "naidora", "minauro", "pteros", "yidishan", "velocis",
  "voracis", "mashin", "kaijin", "finntroll", "ceratops",
]);
const CORRECOES = { golens: "golem", eiradann: "eiradaan", trog: "trog", trogs: "trog" };

/** "anões" → "anão", "lutadores" → "lutador", "elfos-do-mar" → "elfo-do-mar", "nobres" → "nobre". */
export function singular(palavra) {
  const p = palavra.trim().toLowerCase();
  if (CORRECOES[p]) return CORRECOES[p];
  if (INVARIANTES.has(p)) return p;
  return p
    .split("-")
    .map((seg, i, arr) => {
      const alvo = arr.length === 1 || i === 0 || i === arr.length - 1;
      if (!alvo || !seg.endsWith("s") || INVARIANTES.has(seg)) return seg;
      if (seg.endsWith("ões")) return seg.slice(0, -3) + "ão";
      if (seg.endsWith("ores")) return seg.slice(0, -2);
      if (seg.endsWith("is") && seg.length > 4) return seg.slice(0, -2) + "l";
      return seg.slice(0, -1);
    })
    .join("-");
}

const CLASSES = new Set([
  "arcanista", "barbaro", "bardo", "bucaneiro", "cacador", "cavaleiro", "clerigo", "druida", "guerreiro",
  "inventor", "ladino", "lutador", "nobre", "paladino", "treinador", "frade", "samurai", "mistico", "miragem",
]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function portarDeusesMenores() {
  const d = JSON.parse(readFileSync(CACHE, "utf-8"));
  const pags = Array.isArray(d) ? d : d.paginas;
  const texto = pags.map((p) => (p.texto ?? "").replace(/\s+/g, " ")).join(" ");

  // Cabeçalho do verbete: "<Nome>, o Deus … Mortal ascendido/status divino".
  const cabecalhos = [];
  for (const curto of DEUSES) {
    const re = new RegExp(`${esc(curto)}(?:, (?:o|a) [^.]{2,60}?)? (?:Mortal ascendido|Divindade [a-z]+|Espírito [a-z]+|Deus [a-z]+ ascendido|[A-Z][a-z]+ [a-z ]{0,30}?, )?status divino`, "");
    const m = re.exec(texto);
    if (!m) {
      console.warn(`  ! sem cabeçalho: ${curto}`);
      continue;
    }
    const nome = /^([^,]+(?:, (?:o|a) [^.]{2,60}?))(?= Mortal| Divindade| Espírito| Deus [a-z]+ ascendido| [A-Z][a-z]+ [a-z ]{0,30}?, | status)/.exec(m[0])?.[1] ?? curto;
    // Lixo que a extração cola no fim do cabeçalho ("Dragão-Real,", ", exibem seu").
    const limpo = nome.trim().replace(/ Dragão-Real,?$/, "").replace(/,\s*[a-z].*$/, "").trim();
    cabecalhos.push({ pos: m.index, nome: limpo, curto });
  }
  cabecalhos.sort((a, b) => a.pos - b.pos);

  const out = [];
  cabecalhos.forEach((cab, i) => {
    const fim = cabecalhos[i + 1]?.pos ?? texto.length;
    const trecho = texto.slice(cab.pos, fim);
    const m = /Devotos\. ([^.]{2,300})\./.exec(trecho);
    const linha = m ? m[1].trim() : "";
    const qualquer = !m || /^quaisquer|^qualquer|^todos/i.test(linha);
    const racas = [];
    const classes = [];
    if (m && !qualquer) {
      for (const parte of linha.split(/,|\se\s/)) {
        const bruto = parte.replace(/\(.*?\)/g, "").trim().toLowerCase();
        if (!bruto) continue;
        const s = slug(bruto.split("/").map(singular).join("/"));
        if (!s) continue;
        if (CLASSES.has(s)) classes.push(s);
        else racas.push(s);
      }
    }
    if (!m) console.warn(`  ! sem linha Devotos: ${cab.curto}`);
    out.push({ id: slug(cab.curto), nome: cab.nome, curto: cab.curto, devotos: { qualquer, racas, classes } });
  });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!existsSync(CACHE)) {
    console.error("Sem scripts/.cache-pdf/deuses-menores.json — rode scripts/extrair-pdfs.py antes.");
    process.exit(1);
  }
  const lista = portarDeusesMenores();
  writeFileSync(OUT, JSON.stringify(lista, null, 2) + "\n", "utf-8");
  console.log(`deuses_menores.json: ${lista.length} deus(es)`);
  for (const d of lista) console.log(`  ${d.nome} — ${d.devotos.qualquer ? "qualquer" : [...d.devotos.racas, ...d.devotos.classes].join(", ")}`);
}
