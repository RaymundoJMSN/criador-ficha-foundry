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
import { livrosDisponiveis, racasDosLivros, classesDosLivros, origensDosLivros } from "./livros.mjs";

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
