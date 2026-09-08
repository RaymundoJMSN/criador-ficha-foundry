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
import { livrosDisponiveis, racasDosLivros, classesDosLivros, origensDosLivros, poderesDosLivros, LIVROS } from "./livros.mjs";

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

const textos = { origens: {}, racas: {}, classes: {}, nomes: {}, divindades: {}, poderes: {} };
/** Classe variante → classe base ("alquimista": "inventor"). */
const variantes = {};

/* --- Origens: do markdown, inteiras (descrição + Benefício + Itens) -------- */

/**
 * O T20-DB nomeia as origens regionais como no Atlas de Arton; a compilação
 * Dragão Brasil dá outro nome ao mesmo verbete ("Aspirante a Herói" é
 * "Nascido Para Ser Herói"). Casado por itens iniciais + benefício, à mão.
 * `um_com_os_kami` não existe em livro nenhum daqui: fica sem texto.
 */
const ALIAS_ORIGEM = {
  agricultor_sambur: "campones_de_abri_norte",
  amoque_purpura: "morador_dos_ermos_purpuras",
  anao_de_armas: "armeiro_de_fortelle",
  andarilho_ubaneri: "patrulheiro_de_fronteira",
  aprendiz_de_dragoeiro: "cacador_de_dragoes_de_sckharshantallas",
  aprendiz_de_drogadora: "drogadora_de_galrasia",
  aristocrata_daizenshi: "nobre_de_tamuran",
  armeiro_armado: "ferreiro_de_zakharov",
  aspirante_a_heroi: "nascido_para_ser_heroi",
  assistente_forense: "investigador_de_salistick",
  bandoleiro_da_fortaleza: "menor_de_khalifor",
  barao_arruinado: "nobre_decaido",
  catador_da_cidade_velha: "mergulhador_de_malpetrim",
  cativo_das_fadas: "filho_da_pondsmania",
  competidor_do_circuito: "competidor_de_trebuck",
  cosmopolita: "cidadao_de_valkaria",
  cria_da_favela: "morador_da_favela_dos_goblins",
  criado_pelas_voracis: "criado_por_voracis",
  de_outro_mundo: "viajante_planar",
  descendente_colleniano: "descendente_de_collen",
  desertor_da_supremacia: "guerreiro_purista",
  duyshidakk_infiltrado: "espiao_goblinoide",
  escudeiro_solitario: "cupincha_do_chapeu_preto",
  estandarte_vivo: "sobrevivente_dos_ermos",
  estudante_colegio_real: "estudante_do_colegio_real",
  estudante_da_academia: "academico_de_arcadia",
  explorador_de_ruinas: "explorador_de_tyrondir",
  filhote_da_revoada: "piloto_da_revoada",
  futura_lenda: "filho_da_lenda",
  ginete_de_tumarkhan: "cavaleiro_de_tumarkhan",
  grumete_pirata: "pirata_de_tollon",
  guardiao_glacial: "protetor_das_uivantes",
  "heroi_camponês": "heroi_campones",
  iniciado_caca_monstros: "caca_monstros",
  insurgente_tapistano: "rebelde_de_tauron",
  irmao_sem_esporas: "irmao_cavalo",
  legionario: "legionario_de_tauron",
  lenhador_de_tollon: "artesao_de_tollon",
  liricista_de_lenorienn: "artista_elfico",
  membro_do_principado: "principe_mercante",
  nitamuraniano: "refugiado_do_imperio_de_jade",
  nobre_zakharoviano: "herdeiro_de_zakharov",
  pescador_parrudo: "pescador_de_khubar",
  plebeu_arcano: "filho_de_wynlla",
  prisioneiro_das_catacumbas: "sobrevivente_das_catacumbas",
  profeta_do_akzath: "seguidor_do_akzath",
  querido_filho: "filho_da_dama_altiva",
  rebelde_agitador: "rebelde_de_sckharshantallas",
  receptador_das_nuvens: "mercador_de_vectora",
  recruta_arcano: "mago_de_batalha_de_wynlla",
  recruta_da_fenix: "cavaleiro_de_grifo",
  sabio_matematico: "matematico_sar_allan",
  selvagem_sanguinario: "filho_das_montanhas",
  sucateiro_de_batalhas: "veterano_da_guerra_civil",
  tamalu: "tamalu_de_khubar",
  tocado_pela_dama_altiva: "agraciado_pela_natureza",
  tocado_pelo_indomavel: "filho_do_indomavel",
  tradicionalista_svalano: "historiador_de_svalas",
  trapaceiro_ahleniense: "malandro_de_ahlen",
  turista_da_academia: "estudante_de_arcana",
};

if (livrosDisponiveis()) {
  const porId = new Map();
  for (const o of origensDosLivros()) if (!porId.has(o.id)) porId.set(o.id, o);
  for (const o of dados("origens.json")) {
    const l = porId.get(o.id) ?? porId.get(ALIAS_ORIGEM[o.id]);
    if (!l) continue;
    // Heróis de Arton escreve benefícios e itens em lista ("- Treinado em: …").
    const lista = (t) => String(t).replace(/^-\s+/, "").replace(/\s+-\s+/g, " · ");
    const partes = [
      l.descricao,
      l.beneficios && `Benefício. ${lista(l.beneficios)}`,
      l.itens && `Itens. ${lista(l.itens)}`,
    ].filter(Boolean);
    if (partes.length > 0) textos.origens[o.id] = partes.join("\n\n");
  }
}

/* --- Origens que o markdown não tem: do PDF, que delimita com "Itens." ---- */

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
    if (textos.origens[o.id]) continue;
    const bloco = blocos.get(o.id);
    if (!bloco) continue;
    const corpo = bloco.slice(o.nome.length).trim();
    const corte = /Itens\./.exec(corpo);
    const d = (corte ? corpo.slice(0, corte.index) : corpo).trim();
    if (d.length >= 60) textos.origens[o.id] = d;
  }
} else {
  console.log("  (sem cache de PDF: origens ficam sem descrição — rode extrair-pdfs.py)");
}

/* --- Nomes de personagem: Heróis de Arton, Tabela 1-24 (uma coluna por raça) --- */

if (livrosDisponiveis()) {
  const arq = join(LIVROS, "herois-arton/01-campeoes-arton/tabelas-personagens.md");
  if (existsSync(arq)) {
    const md = readFileSync(arq, "utf-8");
    const ini = md.indexOf("Tabela 1-24");
    const fim = md.indexOf("## Tabela 1-25");
    const trecho = ini >= 0 ? md.slice(ini, fim > ini ? fim : undefined) : "";
    let colunas = [];
    for (const linha of trecho.split(/\r?\n/)) {
      const celulas = linha.split("|").slice(1, -1).map((c) => c.trim());
      if (celulas.length < 2) continue;
      if (celulas[0] === "d%") {
        colunas = celulas.slice(1).map((c) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_"));
        continue;
      }
      if (/^-+$/.test(celulas[0]) || !/^\d/.test(celulas[0])) continue;
      celulas.slice(1).forEach((nome, i) => {
        const raca = colunas[i];
        if (!raca || !nome) return;
        (textos.nomes[raca] ??= []).push(nome);
      });
    }
  }
}

/* --- Deuses do Panteão: Crenças, Símbolo, Canalizar, Arma, Obrigações (LB cap. 2) --- */

if (livrosDisponiveis()) {
  const arq = join(LIVROS, "tormenta20-core/02-criacao-personagens/06-deuses.md");
  if (existsSync(arq)) {
    const md = readFileSync(arq, "utf-8");
    const campo = (corpo, nome) => {
      const m = new RegExp("\\*\\*" + nome + "[.:]?\\*\\*[.:]?\\s*(.+)").exec(corpo);
      return m ? m[1].replace(/\*\*/g, "").trim() : null;
    };
    const blocos = md.split(/^### /m).slice(1);
    for (const b of blocos) {
      const titulo = b.split(/\r?\n/)[0] ?? "";
      const nome = titulo.split("•")[0].trim();
      const id = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const ficha = {
        crencas: campo(b, "Crenças e Objetivos"),
        simbolo: campo(b, "Símbolo Sagrado"),
        canalizar: campo(b, "Canalizar Energia"),
        arma: campo(b, "Arma Preferida"),
        obrigacoes: campo(b, "Obrigações & Restrições"),
      };
      if (ficha.crencas && ficha.simbolo) textos.divindades[id] = ficha;
    }
  }
  // Deuses menores (Deuses de Arton): mesma ficha + descrição e devotos.
  const arqMenores = join(LIVROS, "deuses-arton/04-deuses-avatares/23-deuses-menores.md");
  if (existsSync(arqMenores)) {
    const campo = (corpo, nome) => {
      const m = new RegExp("\\*\\*" + nome + "[.:]?\\*\\*[.:]?\\s*(.+)").exec(corpo);
      return m ? m[1].replace(/\*\*/g, "").trim() : null;
    };
    for (const b of readFileSync(arqMenores, "utf-8").split(/^### /m).slice(1)) {
      const linhas = b.split(/\r?\n/);
      const nome = (linhas[0] ?? "").split(",")[0].trim();
      const id = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const corpo = b.split(/^#### /m)[0];
      const descricao = corpo
        .split(/\r?\n\s*\r?\n/)
        .slice(1)
        .map((p) => p.replace(/\*\*/g, "").trim())
        .find((p) => p.length >= 40 && !/^(Crenças|Símbolo|Canalizar|Arma|Devotos|Obrigações)/.test(p) && !/status divino/i.test(p));
      const ficha = {
        descricao: descricao ?? null,
        crencas: campo(corpo, "Crenças e Objetivos"),
        simbolo: campo(corpo, "Símbolo Sagrado"),
        canalizar: campo(corpo, "Canalizar Energia"),
        arma: campo(corpo, "Arma Preferida"),
        devotos: campo(corpo, "Devotos"),
        obrigacoes: campo(corpo, "Obrigações & Restrições"),
      };
      if (id && (ficha.crencas || ficha.simbolo) && !textos.divindades[id]) textos.divindades[id] = ficha;
    }
  }
}

/* --- Poderes: texto do livro para item do compêndio sem descrição --------- */

if (livrosDisponiveis()) {
  for (const [id, texto] of poderesDosLivros()) textos.poderes[id] = texto;
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

  // Toda raça que algum livro descreve, não só as do T20-DB: "Suraggel" não é
  // id de raça jogável (Aggelus/Sulfure são), mas é o verbete que descreve as duas.
  for (const [id, r] of porId(racasDosLivros())) {
    const d = r.descricao;
    if (d && !/^---/.test(d.trim())) textos.racas[id] = primeirasFrases(d);
  }
  // Raça cujo verbete tem outro nome no livro.
  const ALIAS_RACA = {
    golem_desperto: "golem",
    kallyanach: "kallyanach_ryuujin",
    kobold: "kobolds",
    trog_anao: "trog",
  };
  for (const [id, verbete] of Object.entries(ALIAS_RACA)) {
    if (!textos.racas[id] && textos.racas[verbete]) textos.racas[id] = textos.racas[verbete];
  }

  // Toda classe que algum livro descreve (o compêndio tem mais classes que o
  // T20-DB); arquivo só de poderes cai no frontmatter e fica de fora.
  for (const [id, c] of porId(classesDosLivros())) {
    const d = c.descricao;
    if (d && !/^---/.test(d.trim())) textos.classes[id] = (c.variante ? `Classe variante de ${c.variante}. ` : "") + primeirasFrases(d);
    // "Poder de Inventor" no alquimista: a variante escolhe da lista da base.
    if (c.variante) {
      const base = c.variante
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      // Só entra se a base for outra classe de verdade.
      if (base && base !== id) variantes[id] = base;
    }
  }
} else {
  console.log("  (sem tormenta-livros: raças e classes ficam sem descrição)");
}

writeFileSync(join(DATA, "textos.json"), JSON.stringify(textos, null, 2) + "\n", "utf-8");
// Versionado (é regra, não texto da Jambo): variante → classe base.
if (Object.keys(variantes).length > 0) {
  writeFileSync(join(DATA, "classes_variantes.json"), JSON.stringify(variantes, null, 2) + "\n", "utf-8");
  console.log(`classes_variantes.json: ${Object.keys(variantes).length} classes variantes`);
}
console.log(
  `textos.json: ${Object.keys(textos.origens).length} origens, ` +
    `${Object.keys(textos.racas).length} raças, ${Object.keys(textos.classes).length} classes, ${Object.keys(textos.poderes).length} poderes, ` +
    `nomes de ${Object.keys(textos.nomes).length} raças, ${Object.keys(textos.divindades).length} deuses`
);
