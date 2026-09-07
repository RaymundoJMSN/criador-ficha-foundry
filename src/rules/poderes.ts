/**
 * Elegibilidade de poder — porta de `T20-DB/motor/prerequisitos.py`.
 *
 * Regras que valem para tudo aqui:
 * - Comparação é sempre por **slug do T20-DB**, nunca por id de item do compêndio.
 * - Atributo é o valor **final** (base + racial + escolha racial), não o comprado.
 * - Tipo que não dá pra checar maquinalmente (`outro`, `narrativo`, desconhecido)
 *   NÃO bloqueia — espelha o `_manual` do motor.
 */
import prereqsDataRaw from "../data/prereqs.json";
import subcategoriasRaw from "../data/poder-subcategoria.json";
import { getDivindade } from "./divindade.js";

const prereqsData = prereqsDataRaw as unknown as Record<string, Prereq[]>;
const subcategorias = subcategoriasRaw as unknown as Record<string, string>;

export type Prereq = Record<string, unknown>;

export interface PrereqCheckResult {
  eligible: boolean;
  unmet: Prereq[];
}

/** Retrato do personagem no momento da escolha. Tudo em slug do T20-DB. */
export interface PartialWizardState {
  nivel: number;
  /** Atributos FINAIS (base + modificadores raciais). */
  atributos: Record<string, number>;
  classeSlug: string;
  racaSlug: string;
  periciasTreinadas: string[];
  /** Slugs dos poderes já escolhidos. */
  poderes: string[];
  habilidadesClasse?: string[];
  habilidadesRaciais?: string[];
  /** Raças que o personagem "conta como" (meio-orc com Sangue Orc conta como orc). */
  racasConsideradas?: string[];
  divindadeSlug?: string;
  proficiencias?: string[];
  magias?: string[];
  linhagem?: string;
  /** Escolas escolhidas pelo bardo/druida (slugs completos: "necromancia"). */
  escolasMagia?: string[];
  /** Multiclasse: níveis em cada classe ({guerreiro: 3, ladino: 2}). */
  niveisPorClasse?: Record<string, number>;
  caminho?: string;
}

/** Mesma normalização do `normalizar()` do motor: minúsculas, sem acento, `_`. */
function norm(valor: unknown): string {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Compara ignorando conectivos: `postura_combate` casa com `postura_de_combate`. */
function mesmaCoisa(a: string, b: string): boolean {
  const limpar = (s: string) =>
    s
      .split("_")
      .filter((t) => t && !["de", "do", "da", "dos", "das"].includes(t))
      .join("_");
  return limpar(a) === limpar(b);
}

function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(norm).filter(Boolean);
  const s = norm(valor);
  return s ? [s] : [];
}

function contarSubcategoria(poderes: string[], subcategoria: string): number {
  return poderes.filter((slug) => {
    const sub = subcategorias[slug];
    return sub ? mesmaCoisa(norm(sub), subcategoria) : false;
  }).length;
}

function atende(req: Prereq, state: PartialWizardState): boolean {
  const poderes = state.poderes.map(norm);
  const pericias = state.periciasTreinadas.map(norm);

  switch (req["tipo"]) {
    case "atributo": {
      const atr = String(req["atributo"] ?? "");
      return (state.atributos[atr] ?? 0) >= Number(req["valor"] ?? 0);
    }

    case "nivel":
      return state.nivel >= Number(req["valor"] ?? 0);

    case "nivel_classe": {
      // Multiclasse: "X níveis de guerreiro" compara o nível NA classe (LB p.35).
      const alvo = Number(req["valor"] ?? req["nivel"] ?? 0);
      if (state.niveisPorClasse) return (state.niveisPorClasse[norm(req["classe"])] ?? 0) >= alvo;
      if (norm(req["classe"]) !== norm(state.classeSlug)) return false;
      return state.nivel >= alvo;
    }

    case "poder":
      return poderes.includes(norm(req["id"]));

    case "pericia":
    case "pericia_treinada":
    case "treinamento_pericia": {
      // "Ofício (alquimista)" também é atendido por "oficio" treinado.
      const alvo = norm(req["pericia"] ?? req["valor"]);
      const base = alvo.split("_")[0] ?? alvo;
      return pericias.includes(alvo) || pericias.includes(base);
    }

    case "habilidade_classe": {
      // Lista = OR (basta uma).
      const alvos = comoLista(req["id"] ?? req["valor"]);
      const tem = (state.habilidadesClasse ?? []).map(norm);
      return alvos.some((a) => tem.includes(a) || poderes.includes(a));
    }

    case "habilidade_racial": {
      const alvo = norm(req["valor"] ?? req["id"]);
      if (norm(state.racaSlug) === alvo) return true;
      return (state.habilidadesRaciais ?? []).map(norm).includes(alvo);
    }

    case "raca": {
      const aceitas = comoLista(req["valor"]);
      const consideradas = new Set([
        norm(state.racaSlug),
        ...(state.racasConsideradas ?? []).map(norm),
      ]);
      return aceitas.some((r) => consideradas.has(r));
    }

    case "divindade_druida":
      return norm(state.divindadeSlug) === norm(req["divindade"]);

    case "devoto":
      if (req["valor"] === false) return true;
      return Boolean(state.divindadeSlug);

    case "devoto_divindade_aceita": {
      if (!state.divindadeSlug) return false;
      const div = getDivindade(state.divindadeSlug);
      if (!div) return false;
      const aceitos = (div.devotos_aceitos ?? {}) as {
        regra?: string;
        classes_aceitas?: string | string[];
      };
      if (aceitos.regra === "qualquer") return true;
      const classes = aceitos.classes_aceitas;
      if (typeof classes === "string")
        return classes === "todas" || classes.startsWith("todas_exceto");
      if (Array.isArray(classes)) return classes.map(norm).includes(norm(req["classe_aceita"]));
      return false;
    }

    case "magia":
      return (state.magias ?? []).map(norm).includes(norm(req["id"]));

    case "escola_de_magia_escolhida":
      return (state.escolasMagia ?? []).map(norm).includes(norm(req["valor"]));

    case "proficiencia":
      return (state.proficiencias ?? []).map(norm).includes(norm(req["valor"]));

    case "poder_subcategoria":
    case "poder_tipo": {
      const sub = norm(req["subcategoria"] ?? req["tipo_poder"]);
      return contarSubcategoria(poderes, sub) >= Number(req["quantidade"] ?? 1);
    }

    case "poder_de_brado":
      return (
        poderes.filter((p) => p.startsWith("brado_")).length >= Number(req["quantidade"] ?? 1)
      );

    case "poder_caminho": {
      const alvo = norm(req["id"]);
      return norm(state.caminho) === alvo || poderes.includes(alvo);
    }

    case "linhagem":
      return Boolean(state.linhagem) && norm(state.linhagem) === norm(req["valor"]);

    case "linhagem_definida":
      return Boolean(state.linhagem);

    // `outro`, `narrativo`, `habilidade`, `escolha_grupo` e qualquer tipo novo:
    // não dá pra decidir por código, então não bloqueia (igual ao motor).
    default:
      return true;
  }
}

export function checkPrereqs(prereqs: Prereq[], state: PartialWizardState): PrereqCheckResult {
  const unmet = prereqs.filter((req) => !atende(req, state));
  return { eligible: unmet.length === 0, unmet };
}

export function isEligible(poderSlug: string, state: PartialWizardState): boolean {
  const prereqs = prereqsData[poderSlug];
  if (!prereqs) return true;
  return checkPrereqs(prereqs, state).eligible;
}

const ATTR_LABEL: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

function titleCase(s: string): string {
  return String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function listaLegivel(valor: unknown): string {
  return comoLista(valor).map(titleCase).join(" ou ");
}

/** Rótulo em português de um pré-requisito, para explicar por que o poder está travado. */
export function formatPrereq(req: Prereq): string {
  switch (req["tipo"]) {
    case "atributo":
      return `${ATTR_LABEL[String(req["atributo"])] ?? req["atributo"]} ${req["valor"]}`;
    case "nivel":
      return `Nível ${req["valor"]}`;
    case "nivel_classe":
      return `${titleCase(String(req["classe"]))} nível ${req["valor"] ?? req["nivel"]}`;
    case "poder":
      return `Poder: ${titleCase(String(req["id"]))}`;
    case "pericia":
    case "pericia_treinada":
    case "treinamento_pericia":
      return `Treinado em ${titleCase(String(req["pericia"] ?? req["valor"]))}`;
    case "habilidade_classe":
      return `Habilidade de classe: ${listaLegivel(req["id"] ?? req["valor"])}`;
    case "habilidade_racial":
      return `Habilidade racial: ${titleCase(String(req["valor"] ?? req["id"]))}`;
    case "raca":
      return `Raça: ${listaLegivel(req["valor"])}`;
    case "divindade_druida":
      return `Devoto de ${titleCase(String(req["divindade"]))}`;
    case "devoto":
      return "Ser devoto de uma divindade";
    case "devoto_divindade_aceita":
      return `Divindade que aceite ${titleCase(String(req["classe_aceita"]))}`;
    case "magia":
      return `Conhecer a magia ${titleCase(String(req["id"]))}`;
    case "escola_de_magia_escolhida":
      return `Escola escolhida: ${titleCase(String(req["valor"]))}`;
    case "proficiencia":
      return `Proficiência: ${titleCase(String(req["valor"]))}`;
    case "poder_subcategoria":
    case "poder_tipo":
      return `${req["quantidade"] ?? 1} poder(es) de ${titleCase(
        String(req["subcategoria"] ?? req["tipo_poder"])
      )}`;
    case "poder_de_brado":
      return `${req["quantidade"] ?? 1} poder(es) de brado`;
    case "poder_caminho":
      return `Caminho: ${titleCase(String(req["id"]))}`;
    case "linhagem":
      return `Linhagem ${titleCase(String(req["valor"]))}`;
    case "linhagem_definida":
      return "Ter escolhido uma linhagem";
    default:
      return "Pré-requisito especial";
  }
}

/** Pré-requisitos não atendidos, em português (vazio quando o poder está liberado). */
export function describeUnmet(poderSlug: string, state: PartialWizardState): string[] {
  const prereqs = prereqsData[poderSlug];
  if (!prereqs) return [];
  return checkPrereqs(prereqs, state).unmet.map(formatPrereq);
}
