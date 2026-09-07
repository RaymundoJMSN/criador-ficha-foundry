import origensDataRaw from "../data/origens.json";
const origensData = origensDataRaw as unknown as Origem[];

export interface OrigensBeneficio {
  pericias: string[];
  poderes: string[];
  poder_unico_id: string | null;
  /** Categorias de poder livre: "combate" (Gladiador) ou "tormenta". */
  poderes_categoria_livre: string[];
}

export interface ItemInicial {
  item?: string;
  /** "Estojo de disfarces ou gazua": o jogador escolhe um. */
  escolha?: string[];
  quantidade?: number;
  valor_max?: string;
  observacao?: string;
}

export interface Origem {
  id: string;
  nome: string;
  itens_iniciais: ItemInicial[];
  beneficios: OrigensBeneficio;
}

export function listOrigens(): Origem[] {
  return origensData;
}

export function getOrigem(id: string): Origem | null {
  return origensData.find((o) => o.id === id) ?? null;
}

/**
 * Renders an origem's starting items as readable strings.
 * Data entries are objects ({item, valor_max?, observacao?}); rendering them
 * directly in a template yields "[object Object]".
 */
export function formatItensIniciais(origemId: string): string[] {
  const origem = getOrigem(origemId);
  if (!origem) return [];
  return (origem.itens_iniciais ?? [])
    .map((it) => {
      let line = it.escolha?.length ? it.escolha.join(" ou ") : (it.item ?? "").trim();
      if (!line) return null; // skip empty entries
      if (it.quantidade && it.quantidade > 1) line += ` ×${it.quantidade}`;
      if (it.valor_max) line += ` (até ${it.valor_max})`;
      if (it.observacao) line += ` — ${it.observacao}`;
      return line;
    })
    .filter((l): l is string => l !== null);
}

/* ------------------------------------------------------------------ */
/*  Benefícios: escolha DOIS                                          */
/* ------------------------------------------------------------------ */

/**
 * "Você escolhe dois benefícios da lista — duas perícias, dois poderes ou uma
 * perícia e um poder" (LB cap. 2, Origens). O poder exclusivo da origem entra na
 * mesma lista: é uma das duas escolhas, não um brinde por cima delas.
 */
export const BENEFICIOS_POR_ORIGEM = 2;

export interface BeneficioOpcao {
  /** Token guardado no estado: `pericia:cura`, `poder:sangue_azul`, `livre:combate`. */
  token: string;
  tipo: "pericia" | "poder" | "livre";
  id: string;
  nome: string;
  exclusivo: boolean;
}

const CATEGORIA_LIVRE_LABEL: Record<string, string> = {
  combate: "Um poder de combate à sua escolha",
  tormenta: "Um poder da Tormenta à sua escolha",
  geral: "Um poder geral à sua escolha",
};

export interface BeneficiosPlano {
  opcoes: BeneficioOpcao[];
  quantidade: number;
  /** Pool menor ou igual à cota: não há o que escolher, aplica tudo. */
  autoAplicar: boolean;
}

function slugPericia(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titulo(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Monta o pool de benefícios de uma origem.
 * @param nomeDoPoder resolve slug → nome de exibição do item no compêndio.
 */
export function getBeneficiosPlano(
  origemId: string,
  nomeDoPoder: (slug: string) => string | null = () => null,
  /** 2 normal; 1 adolescente (Origem em Construção); 0 criança (Sem Origem) — HA p.288. */
  quantidade: number = BENEFICIOS_POR_ORIGEM
): BeneficiosPlano {
  const origem = getOrigem(origemId);
  if (!origem) return { opcoes: [], quantidade, autoAplicar: false };
  if (quantidade <= 0) return { opcoes: [], quantidade: 0, autoAplicar: true };

  const exclusivo = origem.beneficios.poder_unico_id;
  const opcoes: BeneficioOpcao[] = [
    ...origem.beneficios.pericias.map((nome) => {
      const id = slugPericia(nome);
      return { token: `pericia:${id}`, tipo: "pericia" as const, id, nome, exclusivo: false };
    }),
    ...origem.beneficios.poderes.map((id) => ({
      token: `poder:${id}`,
      tipo: "poder" as const,
      id,
      nome: nomeDoPoder(id) ?? titulo(id),
      exclusivo: id === exclusivo,
    })),
    ...(origem.beneficios.poderes_categoria_livre ?? []).map((cat) => ({
      token: `livre:${cat}`,
      tipo: "livre" as const,
      id: cat,
      nome: CATEGORIA_LIVRE_LABEL[cat] ?? `Um poder de ${titulo(cat)} à sua escolha`,
      exclusivo: false,
    })),
  ];

  return {
    opcoes,
    quantidade,
    autoAplicar: opcoes.length > 0 && opcoes.length <= quantidade,
  };
}

export interface BeneficiosEscolhidos {
  pericias: string[];
  poderes: string[];
  /** Categorias em que o jogador ainda precisa escolher um poder qualquer. */
  livres: string[];
  errors: string[];
}

/** Valida os tokens escolhidos contra o pool e separa perícias de poderes. */
export function validarBeneficios(
  origemId: string,
  escolhas: string[],
  quantidade: number = BENEFICIOS_POR_ORIGEM
): BeneficiosEscolhidos {
  const plano = getBeneficiosPlano(origemId, () => null, quantidade);
  const validos = new Set(plano.opcoes.map((o) => o.token));

  const selecionados = plano.autoAplicar ? plano.opcoes.map((o) => o.token) : [...new Set(escolhas)];
  const errors: string[] = [];

  const fora = selecionados.filter((t) => !validos.has(t));
  if (fora.length > 0) errors.push(`benefício fora da lista da origem: ${fora.join(", ")}`);

  if (!plano.autoAplicar && plano.opcoes.length > 0 && selecionados.length !== plano.quantidade) {
    errors.push(`escolha ${plano.quantidade} benefícios da origem (${selecionados.length} marcado(s))`);
  }

  const dentro = selecionados.filter((t) => validos.has(t));
  return {
    pericias: dentro.filter((t) => t.startsWith("pericia:")).map((t) => t.slice(8)),
    poderes: dentro.filter((t) => t.startsWith("poder:")).map((t) => t.slice(6)),
    livres: dentro.filter((t) => t.startsWith("livre:")).map((t) => t.slice(6)),
    errors,
  };
}
