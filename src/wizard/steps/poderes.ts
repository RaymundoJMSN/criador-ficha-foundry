import { toNomeSlug, uuidDe } from "../../compendium/slug.js";
import { getClasse, respostaSubEscolha } from "../../rules/classe.js";
import { getRaca } from "../../rules/raca.js";
import { getTrainedPericaSlugs } from "../../actor/mapper.js";
import { getDivindade } from "../../rules/divindade.js";
import { describeUnmet, temPrereqsConhecidos, prereqDoTexto, prereqsDoTexto, type PartialWizardState } from "../../rules/poderes.js";
import { totaisRaciaisDoEstado } from "../../rules/subescolhas.js";
import { poderesGeraisExtras, faixaDoPersonagem, idsDePoderesExtras, poderesExtrasEscolhidos, fontesDePoderExtra } from "../../rules/idade.js";
import { distincaoEscolhida, podeTerDistincao, listDistincoes } from "../../rules/distincoes.js";
import { habilidadesAte, getClasseProgressao } from "../../rules/progressao.js";
import { classesDoPersonagem, habilidadesDeTodas, slotsDePoderTotal, niveisPorClasse } from "../../rules/multiclasse.js";
import { resolverPoder, opcoesDaHabilidade, chaveHabilidade } from "../../compendium/resolver.js";
import type { IndexedEquipamento, IndexedMagia, IndexedPoder, IndexedRace } from "../../compendium/types.js";
import { poderesAdquiridos, respostasDeSubEscolhas, subEscolhaDoPoder, respostasEsperadas, chaveSubPoder, type SubEscolhaPoder } from "../../rules/subescolhas-poder.js";
import { PERICIA_SLUGS } from "../../rules/pericia-slug.js";
import { PERICIA_NOMES, PERICIA_ATRIBUTO } from "./pericias.js";
import type { WizardState } from "../state.js";
import { ESCOLAS } from "../../rules/magias.js";
import repetiveisRaw from "../../data/poderes_repetiveis.json";
import progressaoRaw from "../../data/progressao_classes.json";

/** "Você pode escolher este poder quantas vezes quiser" (T20-DB). */
const REPETIVEIS = new Set(repetiveisRaw as string[]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export interface PoderEntry {
  id: string;
  name: string;
  img: string;
  uuid: string;
  eligible: boolean;
  unmet: string[];
  /** Pré-requisito só do texto do livro (poder fora do T20-DB); não é conferido. */
  requerTexto: string;
  selected: boolean;
  tipo: string;
  /** Rótulo do filtro: Classe, Combate, Destino, Magia, Tormenta, Concedido, Raça, Geral, Distinção. */
  categoria: string;
  subtipo: string;
  descricao: string;
  /** Whether this entry is a class power or a general power taken in its place. */
  origem: "classe" | "geral";
  /** Escolhido em outro passo (Versátil, complicação…): fica marcado e riscado, fora da cota. */
  extraDe: string;
  /** "Aumento de Atributo": uma linha só; o item real é o da variante escolhida no select. */
  variantes?: Array<{ id: string; rotulo: string; vezes: number; selected: boolean; eligible: boolean; bloqueado: boolean; unmet: string }>;
  /** Não pode ser marcado agora: pré-requisito não cumprido ou cota cheia. */
  bloqueado: boolean;
  /** Pode ser escolhido mais de uma vez (Orar, Foco em Arma…). */
  repetivel: boolean;
  /** Quantas vezes foi escolhido. */
  vezes: number;
  /** Ainda cabe mais uma cópia (repetível, selecionado, cota não cheia). */
  podeMais: boolean;
}

export interface PoderesContext {
  stepTitle: string;
  /** Auto-granted class ability slugs with display names; `opcoes` quando é "Nome: X". */
  habilidades: Array<{
    slug: string;
    nome: string;
    descricao: string;
    uuid: string;
    opcoes: Array<{ id: string; nome: string; selected: boolean }>;
    pendente: boolean;
  }>;
  /** How many free picks allowed at this level (0 = none) */
  poderesParaPick: number;
  /** Dos quais, quantos vêm de complicação/Já Vi Coisas e têm de ser gerais. */
  extrasGerais: number;
  /** Filtered power list for picking (empty when poderesParaPick === 0) */
  poderes: PoderEntry[];
  /** Classe sem tabela de progressão em nenhuma fonte disponível. */
  semTabela: boolean;
  /** Distinções (HA cap. 2) quando liberadas pelo mestre e nível ≥ 5. */
  distincoes: {
    opcoes: Array<{ nome: string; n: number; selected: boolean }>;
    escolhida: { nome: string; marca: string; n: number } | null;
  } | null;
  /** Filtro "só elegíveis" ligado. */
  soElegiveis: boolean;
  /** Quantos ficam escondidos com o filtro. */
  inelegiveis: number;
  categorias: string[];
  selectedCount: number;
  /** Poderes adquiridos que pedem uma decisão (Aspirante a Herói: qual atributo). */
  subEscolhas: SubEscolhaView[];
  errors: string[];
}

export interface SubEscolhaView {
  name: string;
  poder: string;
  rotulo: string;
  /** Campo de texto livre em vez de lista. */
  texto: boolean;
  valor: string;
  opcional: boolean;
  opcoes: Array<{ id: string; nome: string; selected: boolean }>;
  /** De onde o poder veio (classe, poder, origem, divindade, raça). */
  fonte: string;
  slug: string;
}

const CLASSES_TODAS = Object.keys(progressaoRaw as Record<string, unknown>);

const ATRIBUTOS_OPCOES = [
  { id: "for", nome: "Força" },
  { id: "des", nome: "Destreza" },
  { id: "con", nome: "Constituição" },
  { id: "int", nome: "Inteligência" },
  { id: "sab", nome: "Sabedoria" },
  { id: "car", nome: "Carisma" },
];

function opcoesDaSub(
  sub: SubEscolhaPoder,
  state: WizardState,
  allMagias: IndexedMagia[],
  armas: IndexedEquipamento[],
  allPoderes: IndexedPoder[],
  elegivel: (p: IndexedPoder) => boolean
): Array<{ id: string; nome: string }> {
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");
  const minhas = classesDoPersonagem(state);
  const minhasSlugs = new Set(minhas.map((c) => c.classeSlug));
  switch (sub.tipo) {
    case "texto":
      return [];
    case "habilidade_outra_classe": {
      // Duplo Feérico: habilidade de 1º nível de uma classe que não seja a sua.
      const out: Array<{ id: string; nome: string }> = [];
      for (const classe of CLASSES_TODAS) {
        if (minhasSlugs.has(classe)) continue;
        for (const h of habilidadesAte(classe, 1)) {
          const item = resolverPoder(h, classe, allPoderes, "ability")?.item;
          if (item && !out.some((o) => o.id === item.id)) out.push({ id: item.id, nome: `${prettifySlug(classe)}: ${item.name}` });
        }
      }
      return out.sort(porNome);
    }
    case "poder_da_classe":
      return allPoderes
        .filter((p) => p.system.tipo === "classe" && minhasSlugs.has(toNomeSlug(p.system.subtipo ?? "")))
        .filter(elegivel)
        .map((p) => ({ id: p.id, nome: p.name }))
        .sort(porNome);
    case "poder_classe_ou_geral": {
      const comDois = new Set(minhas.filter((c) => c.niveis >= 2).map((c) => c.classeSlug));
      return allPoderes
        .filter(
          (p) =>
            (p.system.tipo === "geral" && ["combate", "destino", "magia"].includes(toNomeSlug(p.system.subtipo ?? ""))) ||
            (p.system.tipo === "classe" && comDois.has(toNomeSlug(p.system.subtipo ?? "")))
        )
        .filter(elegivel)
        .map((p) => ({ id: p.id, nome: `${p.name}${p.system.tipo === "classe" ? ` (${p.system.subtipo})` : ""}` }))
        .sort(porNome);
    }
    case "atributo":
      return ATRIBUTOS_OPCOES;
    case "pericia":
      return PERICIA_SLUGS.filter((p) => !sub.atributo || PERICIA_ATRIBUTO[p] === sub.atributo)
        .filter((p) => !(sub.excluir ?? []).includes(p))
        .map((p) => ({ id: p, nome: PERICIA_NOMES[p] ?? p }))
        .sort(porNome);
    case "magia":
      return allMagias
        .filter((m) => !sub.circulo || Number(m.system.circulo) === sub.circulo)
        .filter((m) => !sub.tradicao || sub.tradicao.includes(m.system.tipo ?? "") || m.system.tipo === "uni")
        .filter((m) => !sub.escola || m.system.escola === sub.escola)
        .map((m) => ({ id: m.id, nome: m.name }))
        .sort(porNome);
    case "magia_conhecida":
      return [...new Set(state.magias)]
        .map((id) => allMagias.find((m) => m.id === id))
        .filter((m): m is IndexedMagia => Boolean(m))
        .map((m) => ({ id: m.id, nome: m.name }))
        .sort(porNome);
    case "arma": {
      const vistos = new Set<string>();
      return armas
        .filter((a) => a.type === "arma" && !vistos.has(a.name) && vistos.add(a.name))
        .map((a) => ({ id: a.id, nome: a.name }))
        .sort(porNome);
    }
    case "lista":
      return (sub.opcoes ?? []).map((o) => ({ id: o.id, nome: o.rotulo }));
    case "escola":
      return Object.entries(ESCOLAS).map(([abrev, e]) => ({ id: abrev, nome: e.nome })).sort(porNome);
    default:
      return [];
  }
}

export function montarSubEscolhas(
  state: WizardState,
  allPoderes: IndexedPoder[],
  allMagias: IndexedMagia[],
  racas: IndexedRace[],
  armas: IndexedEquipamento[],
  elegivel: (p: IndexedPoder) => boolean = () => true
): SubEscolhaView[] {
  const out: SubEscolhaView[] = [];
  for (const p of poderesAdquiridos(state, allPoderes, racas)) {
    const sub = subEscolhaDoPoder(p.slug, p.descricao);
    if (!sub) continue;
    const opcoes = opcoesDaSub(sub, state, allMagias, armas, allPoderes, elegivel);
    const total = respostasEsperadas(sub, p.vezes);
    for (let i = 0; i < total; i++) {
      const atual = (state.escolhasPorItem[chaveSubPoder(p.slug, i)] as string | undefined) ?? "";
      out.push({
        name: `sp-${p.slug}-${i}`,
        poder: total > 1 ? `${p.nome} (${i + 1}/${total})` : p.nome,
        rotulo: sub.rotulo,
        texto: sub.tipo === "texto",
        valor: atual,
        opcional: Boolean(sub.opcional),
        opcoes: opcoes.map((o) => ({ ...o, selected: o.id === atual })),
        fonte: p.fonte,
        slug: p.slug,
      });
    }
  }
  return out;
}

/**
 * Poder geral (`tipo:"geral"`) que o personagem pode escolher. No compêndio o
 * subtipo é a categoria do livro (Combate, Destino, Magia, Tormenta) — mas os
 * módulos também guardam como "geral" poderes de raça ("Glamour (Duende)",
 * subtipo Duende), complicações ("Desvantagem"), poderes de montaria, de
 * parceiro, de grupo, de distinção… Só entram as categorias do livro e os da
 * própria raça (com a raça-base: Aggelus recebe os "(Suraggel)"; a escolha da
 * raça também conta: qareen de Luz vê "Qareen de Luz").
 */
const CATEGORIAS_GERAIS = new Set(["", "combate", "destino", "magia", "tormenta"]);
const IGNORAR_TOKENS = new Set(["de", "do", "da", "dos", "das", "heranca"]);
const tokensDe = (s: string): string[] =>
  toNomeSlug(s)
    .split("_")
    .filter((t) => t && !IGNORAR_TOKENS.has(t));

export function geralDaLista(state: WizardState): (subtipo: string, pasta?: string) => boolean {
  const raca = getRaca(state.racaNome || state.racaId);
  const extras = Object.entries(state.escolhasPorItem)
    .filter(([k, v]) => k.startsWith("raca_") && typeof v === "string")
    .flatMap(([, v]) => tokensDe(String(v)));
  const racas = [state.racaNome, raca?.nome, raca?.raca_base ?? ""]
    .filter((x): x is string => Boolean(x))
    .map((r) => new Set([...tokensDe(r.split(" (")[0]!), ...extras]));
  return (subtipo: string, pasta = "") => {
    let s = toNomeSlug(subtipo);
    if (s === "") {
      // Sem subtipo: o Guia de NPCs guarda os poderes de raça em pastas
      // "Raças - Vampiro (DB#220)/…" e as distinções em "Distinções - …".
      // "Raças - Vampiro (DB#220)/…" (Guia de NPCs) ou "…/Poderes Raciais/Golem" (HdA).
      const m = /Ra[cç]as? - ([^(/]+)|Raciais\s*\/\s*([^(/]+)/i.exec(pasta);
      if (m) subtipo = (m[1] ?? m[2] ?? "").trim();
      else if (/Distin/i.test(pasta)) return false;
      s = toNomeSlug(subtipo);
    }
    if (CATEGORIAS_GERAIS.has(s)) return true;
    const t = tokensDe(subtipo);
    return t.length > 0 && racas.some((rt) => t.every((x) => rt.has(x)));
  };
}

/**
 * "Aumento de Atributo (Força)"… viram UMA linha "Aumento de Atributo" com o
 * atributo num select (Ray: o poder sem atributo nunca é uma opção real). O
 * item que vai para a ficha é o da variante. Mexe na lista no lugar.
 */
const VARIANTE = /^(Aumento de Atributo) \((.+)\)$/;
export function agruparVariantes(entries: PoderEntry[]): void {
  const grupos = new Map<string, PoderEntry[]>();
  for (const e of entries) {
    const m = VARIANTE.exec(e.name);
    if (m) (grupos.get(m[1]!) ?? grupos.set(m[1]!, []).get(m[1]!)!).push(e);
  }
  for (const [base, vars] of grupos) {
    const generico = entries.find((e) => e.name === base);
    const ancora = generico ?? vars[0]!;
    const grupo: PoderEntry = {
      ...ancora,
      id: `grupo:${toNomeSlug(base)}`,
      name: base,
      selected: vars.some((v) => v.selected),
      eligible: vars.some((v) => v.eligible),
      unmet: vars.every((v) => !v.eligible) ? (vars[0]?.unmet ?? []) : [],
      bloqueado: true,
      repetivel: false,
      podeMais: false,
      vezes: vars.reduce((s, v) => s + v.vezes, 0),
      extraDe: vars.map((v) => v.extraDe).find(Boolean) ?? "",
      variantes: vars.map((v) => ({
        id: v.id,
        rotulo: VARIANTE.exec(v.name)![2]!,
        vezes: v.vezes,
        selected: v.selected,
        eligible: v.eligible,
        bloqueado: v.bloqueado,
        unmet: v.unmet.join(", "),
      })),
    };
    const pos = entries.indexOf(ancora);
    const fora = new Set<PoderEntry>([...vars, ...(generico ? [generico] : [])]);
    const restante = entries.filter((e) => !fora.has(e));
    restante.splice(Math.min(pos, restante.length), 0, grupo);
    entries.splice(0, entries.length, ...restante);
  }
}

function prettifySlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function preparePoderesContext(
  state: WizardState,
  allPoderes: IndexedPoder[],
  errors: string[] = [],
  resolvePoderNome: (slug: string) => string | null = () => null,
  allMagias: IndexedMagia[] = [],
  extras: { racas?: IndexedRace[]; armas?: IndexedEquipamento[] } = {}
): PoderesContext {
  // Sem tabela/classe: monta sem filtro de elegibilidade (não há o que conferir).
  let subEscolhas = montarSubEscolhas(state, allPoderes, allMagias, extras.racas ?? [], extras.armas ?? []);
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const classeData = getClasse(classeSlug);

  // Auto-granted class abilities up to this level (same source the writer uses)
  // Multiclasse: habilidades de cada classe no nível dela (LB p.35).
  const todasClasses = classesDoPersonagem(state);
  const habilidadeSlugs = habilidadesDeTodas(state).map((h) => h.slug);
  const habilidades = habilidadesDeTodas(state)
    .map(({ classe, slug }) => {
      const opcoes = opcoesDaHabilidade(slug, allPoderes);
      if (opcoes.length > 0) {
        const escolhido = state.escolhasPorItem[chaveHabilidade(slug)] as string | undefined;
        const item = opcoes.find((o) => o.id === escolhido);
        return {
          slug,
          nome: opcoes[0]!.name.split(":")[0]!.trim(),
          descricao: item?.system.descricao ?? "",
          uuid: item ? uuidDe(item) : "",
          opcoes: opcoes
            .map((o) => ({ id: o.id, nome: o.name.split(":").slice(1).join(":").trim(), selected: o.id === escolhido }))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
          pendente: !opcoes.some((o) => o.id === escolhido),
        };
      }
      const item = resolverPoder(slug, classe.classeSlug, allPoderes, "ability")?.item;
      return {
        slug,
        nome: item?.name ?? resolvePoderNome(slug) ?? prettifySlug(slug),
        descricao: item?.system.descricao ?? "",
        uuid: item ? uuidDe(item) : "",
        opcoes: [] as Array<{ id: string; nome: string; selected: boolean }>,
        pendente: false,
      };
    })
    .filter((h, i, arr) => arr.findIndex((o) => o.nome === h.nome) === i);
  // Samurai, Místico, Miragem: existem no compêndio mas nenhum livro dos PDFs
  // traz a tabela de progressão — sem ela não há como saber habilidades e cota.
  const semTabela = Boolean(state.classeNome) && getClasseProgressao(state.classeNome) === null;

  // Free picks a character of this level has ACCUMULATED (levels 1..N), not the
  // single pick this level grants — a nv5 guerreiro picks 4 powers, not 1.
  // Vagas de classe (podem virar geral) + poderes gerais extras de complicação /
  // Já Vi Coisas (HA p.282/289), que só podem ser gerais.
  const slotsClasse = slotsDePoderTotal(state);
  const extrasGerais = poderesGeraisExtras(state);
  // Os extras (Versátil, complicação, Já Vi Coisas) são escolhidos na tela de
  // origem e não entram na cota daqui: só aparecem marcados e riscados.
  const poderesParaPick = slotsClasse;
  const faixa = faixaDoPersonagem(state);
  const idsExtras = idsDePoderesExtras(state);
  const semExtras = [...state.poderes];
  for (const id of idsExtras) {
    const i = semExtras.indexOf(id);
    if (i >= 0) semExtras.splice(i, 1);
  }
  const rotuloDoExtra = new Map<string, string>();
  for (const f of fontesDePoderExtra(state)) {
    const id = poderesExtrasEscolhidos(state)[f.fonte];
    if (id) rotuloDoExtra.set(id, f.rotulo);
  }

  // Build pick list from poderes_classe_ids. O nome no compêndio raramente é o slug
  // ("Ambidestria (Guerreiro)"), então resolve slug → item e guarda o id resolvido.
  // Slug sem item = conteúdo não instalado (Heróis de Arton) — some da lista, sem erro.
  // Poder de classe no compêndio é `tipo:"classe"` + `subtipo:"<Classe>"` — vale
  // para Samurai e as outras classes que só existem no compêndio (o T20-DB só
  // cobre o Livro Básico). Os slugs do T20-DB entram por cima só para casar o
  // pré-requisito {tipo:"poder"} pelo slug certo.
  const idsDaClasse = new Set<string>();
  const idParaSlug = new Map<string, string>();
  const nomesClasses = todasClasses.map((c) => norm(c.classeNome)).filter(Boolean);
  for (const p of allPoderes) {
    // subtipo "Geral" = poder de classe de toda classe (Aumento de Atributo).
    const sub = norm(p.system.subtipo ?? "");
    if (p.system.tipo === "classe" && nomesClasses.length && (nomesClasses.includes(sub) || sub === "geral")) {
      idsDaClasse.add(p.id);
    }
  }
  for (const c of todasClasses) {
    for (const slug of getClasse(c.classeNome || c.classeId)?.poderes_classe_ids ?? []) {
      const achado = resolverPoder(slug, c.classeSlug, allPoderes, "classe");
      if (!achado) continue;
      idsDaClasse.add(achado.item.id);
      idParaSlug.set(achado.item.id, slug);
    }
  }

  // Pré-requisito compara slug do T20-DB, não id de compêndio nem nome de item:
  // "Ambidestria (Guerreiro)" precisa virar `ambidestria` para casar com {tipo:"poder"}.
  const slugDoItem = (p: IndexedPoder) => idParaSlug.get(p.id) ?? toNomeSlug(p.name);
  const poderesEscolhidos = state.poderes
    .map((id) => allPoderes.find((p) => p.id === id))
    .filter((p): p is IndexedPoder => Boolean(p))
    .map(slugDoItem);

  const totaisRaca = totaisRaciaisDoEstado(state);
  const atributos: Record<string, number> = Object.fromEntries(
    (["for", "des", "con", "int", "sab", "car"] as const).map((a) => [
      a,
      (state.atributosBase[a] ?? 0) + (totaisRaca[a] ?? 0),
    ])
  );
  // Sub-escolha de atributo (Aspirante a Herói +1) conta para pré-requisito.
  for (const r of respostasDeSubEscolhas(poderesAdquiridos(state, allPoderes, extras.racas ?? []), state.escolhasPorItem)) {
    if (r.sub.tipo === "atributo" && r.valor in atributos) atributos[r.valor] = (atributos[r.valor] ?? 0) + 1;
  }

  const stateForEligibility: PartialWizardState = {
    nivel: state.nivel,
    atributos,
    classeSlug,
    racaSlug: toNomeSlug(state.racaNome || ""),
    periciasTreinadas: getTrainedPericaSlugs(state),
    poderes: poderesEscolhidos,
    habilidadesClasse: habilidadeSlugs,
    niveisPorClasse: niveisPorClasse(state),
    divindadeSlug: state.divindadeId,
    proficiencias: classeData?.proficiencias ?? [],
    // state.magias guarda id de compêndio; o pré-req {tipo:"magia"} compara slug.
    magias: state.magias
      .map((id) => allMagias.find((m) => m.id === id)?.name)
      .filter((n): n is string => Boolean(n))
      .map(toNomeSlug),
    linhagem: respostaSubEscolha(
      classeSlug,
      (state.escolhasPorItem["classe_caminho"] as string) ?? "",
      state.escolhasPorItem,
      "linhagem"
    ),
    escolasMagia: ((state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? []).map(
      (abrev) => ESCOLAS[abrev]?.slug ?? abrev
    ),
    caminho: (state.escolhasPorItem["classe_caminho"] as string) ?? "",
  };

  subEscolhas = montarSubEscolhas(state, allPoderes, allMagias, extras.racas ?? [], extras.armas ?? [], (p) =>
    describeUnmet(slugDoItem(p), stateForEligibility, p.system.descricao ?? "").length === 0
  );

  const noLimite = semExtras.length >= poderesParaPick;
  const classeEscolhidos = semExtras.filter((id) => idsDaClasse.has(id)).length;
  const classeNoLimite = classeEscolhidos >= slotsClasse;
  // Velho/ancião: "não pode escolher o poder Aumento de Atributo para atributos físicos" (HA p.289).
  const aumentoFisico = /^aumento de atributo \((força|destreza|constituição)\)/i;

  // "Sempre que você recebe um poder de classe, pode trocá-lo por um poder geral"
  // (LB cap. 5) — so every class-power slot may also be spent on a general power.
  // O mesmo poder geral em dois módulos aparecia duas vezes; fica o primeiro.
  // Distinção admitida pelo mestre (HA p.104): os poderes dela entram como gerais.
  const distincao = distincaoEscolhida(state);
  const idsDaDistincao = new Set(distincao?.poderes.map((p) => p.id) ?? []);
  const nomesVistos = new Set<string>();
  const geralDisponivel = geralDaLista(state);
  // Concedidos são poderes gerais para o devoto (LB cap. 5, "Grupos"): os do
  // deus que ainda não vieram pela devoção entram na lista.
  const jaConcedidos = new Set((state.escolhasPorItem["divindade_poderes"] as string[] | undefined) ?? []);
  const concedidosDoDeus = new Set(
    (state.divindadeId ? getDivindade(state.divindadeId)?.poderes_concedidos ?? [] : []).filter((s) => !jaConcedidos.has(s))
  );
  const ehGeral = (p: IndexedPoder) =>
    idsDaDistincao.has(p.id) ||
    (p.system.tipo === "geral" && geralDisponivel(p.system.subtipo ?? "", p.pasta ?? "")) ||
    (p.system.tipo === "concedido" && concedidosDoDeus.has(slugDoItem(p)));
  const NOMES_CAT: Record<string, string> = { "": "Geral", combate: "Combate", destino: "Destino", magia: "Magia", tormenta: "Tormenta" };
  const categoriaDe = (p: IndexedPoder): string => {
    if (idsDaDistincao.has(p.id)) return "Distinção";
    if (p.system.tipo === "concedido") return "Concedido";
    if (p.system.tipo !== "geral") return "Classe";
    const s = toNomeSlug(p.system.subtipo ?? "");
    if (s === "" && /Ra[cç]as? - |Raciais\s*\//i.test(p.pasta ?? "")) return "Raça";
    return NOMES_CAT[s] ?? "Raça";
  };
  const entries: PoderEntry[] = allPoderes
    .filter((p) => idsDaClasse.has(p.id) || ehGeral(p))
    .filter((p) => !nomesVistos.has(p.name) && nomesVistos.add(p.name))
    .map((p) => {
      const unmet = describeUnmet(slugDoItem(p), stateForEligibility, p.system.descricao ?? "");
      const vezes = state.poderes.filter((id) => id === p.id).length;
      const repetivel = REPETIVEIS.has(slugDoItem(p));
      // Pré-requisito que nem o T20-DB nem o leitor de texto entenderam: só mostra.
      const requerTexto =
        temPrereqsConhecidos(slugDoItem(p)) || prereqsDoTexto(p.system.descricao ?? "").length > 0
          ? ""
          : prereqDoTexto(p.system.descricao ?? "");
      return {
        id: p.id,
        name: p.name,
        img: p.img,
        uuid: uuidDe(p),
        eligible: unmet.length === 0,
        unmet,
        requerTexto,
        selected: state.poderes.includes(p.id),
        tipo: idsDaDistincao.has(p.id) ? "distinção" : (p.system.tipo ?? ""),
        categoria: categoriaDe(p),
        subtipo: p.system.subtipo ?? "",
        descricao: p.system.descricao ?? "",
        origem: ehGeral(p) ? ("geral" as const) : ("classe" as const),
        extraDe: rotuloDoExtra.get(p.id) ?? "",
        // Elegibilidade é recalculada a cada render: escolher o Poder A libera
        // na hora o Poder B que exigia A.
        bloqueado:
          rotuloDoExtra.has(p.id) ||
          !state.poderes.includes(p.id) &&
          (unmet.length > 0 ||
            noLimite ||
            (!ehGeral(p) && classeNoLimite) ||
            (faixa.bloqueiaAumentoFisico && aumentoFisico.test(p.name))),
        repetivel,
        vezes,
        podeMais: repetivel && vezes > 0 && !noLimite,
      };
    });

  // Marcados primeiro, depois os elegíveis, depois o resto — cada bloco por nome.
  const ordem = (e: PoderEntry) => (e.selected ? 0 : e.eligible ? 1 : 2);
  agruparVariantes(entries);
  entries.sort((a, b) => ordem(a) - ordem(b) || a.name.localeCompare(b.name));
  const categorias = [...new Set(entries.map((e) => e.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const podeDistincao = podeTerDistincao(state);
  const distincoesView = podeDistincao
    ? {
        opcoes: listDistincoes().map((d) => ({ nome: d.nome, n: d.poderes.length, selected: d.nome === distincao?.nome })),
        escolhida: distincao ? { nome: distincao.nome, marca: distincao.marca?.name ?? "", n: distincao.poderes.length } : null,
      }
    : null;

  return {
    stepTitle: "Poderes",
    habilidades,
    poderesParaPick,
    extrasGerais,
    poderes: entries,
    semTabela,
    categorias,
    distincoes: distincoesView,
    soElegiveis: Boolean(state.escolhasPorItem["poder_so_elegiveis"]),
    inelegiveis: entries.filter((e) => !e.eligible && !e.selected).length,
    subEscolhas,
    selectedCount: semExtras.length,
    errors,
  };
}

/** Habilidades "Nome: X" ainda sem opção escolhida — vai para as pendências da Revisão. */
export function pendenciasDeHabilidades(state: WizardState, allPoderes: IndexedPoder[]): string[] {
  const out: string[] = [];
  for (const slug of habilidadesDeTodas(state).map((h) => h.slug)) {
    const opcoes = opcoesDaHabilidade(slug, allPoderes);
    if (opcoes.length === 0) continue;
    const escolhido = state.escolhasPorItem[chaveHabilidade(slug)] as string | undefined;
    if (!opcoes.some((o) => o.id === escolhido)) out.push(`Escolha a opção de ${opcoes[0]!.name.split(":")[0]!.trim()}.`);
  }
  return out;
}
