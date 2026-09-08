/**
 * Raças montadas por passos: Duende (natureza, tamanho, presentes, tabu),
 * Kallyanach (bênçãos), Golens Despertos (chassi, fonte, tamanho), Mashin
 * (maravilha mecânica), Kobolds (talentos do bando) e Vampiro (Resquícios).
 *
 * Os passos vivem em `data/montagem.json` (só estrutura e números — o texto de
 * cada opção sai do item do compêndio). As respostas ficam em
 * `escolhasPorItem`: `mont_<passo>` = ids marcados; `mont_<passo>_<opção>_sub`
 * = a sub-escolha (arma natural, elemento, magia).
 */
import montagemRaw from "../data/montagem.json";
import type { AtributoEscolhaDef, EscolhaRacial } from "./raca.js";

export interface Efeito {
  chave: string;
  valor: number;
}

export interface SubEscolha {
  rotulo: string;
  opcoes?: Array<{ id: string; rotulo: string }>;
  magia?: { circulo: number; tradicao?: string };
}

export interface OpcaoMontagem {
  id: string;
  nome: string;
  /** Nome do poder racial no compêndio. Sem ele, a opção é só regra (Médio do duende). */
  poder?: string;
  atributos?: Record<string, number>;
  atributos_escolha?: { valor: number; quantidade: number; atributos_diferentes?: boolean };
  tamanho?: string;
  deslocamento?: number;
  efeitos?: Efeito[];
  /** Só uma opção do mesmo grupo exclusivo (as três Afinidades Elementais). */
  exclusivo?: string;
  /** Ids de opções do mesmo passo que precisam estar marcadas. */
  requer?: string[];
  /** Item concedido pela raça que recebe o sufixo/efeito (Tabu). */
  anotar?: string;
  sub?: SubEscolha;
  nota?: string;
}

export interface PassoMontagem {
  id: string;
  nome: string;
  escolher: number;
  opcional?: boolean;
  /** Mashin: a maravilha toma o lugar de uma perícia treinada do chassi. */
  troca_pericia?: boolean;
  nota?: string;
  opcoes: OpcaoMontagem[];
}

export interface Montagem {
  atributos_escolha?: AtributoEscolhaDef[];
  passos?: PassoMontagem[];
  escolhas?: EscolhaRacial[];
}

const MONTAGENS = montagemRaw as unknown as Record<string, Montagem>;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Nome exibido → id do T20-DB. O compêndio tem dois itens "Golem": o do Livro
 * Básico e o de Golens Despertos (Ameaças); o wizard mostra o segundo como
 * "Golem (Ameaças de Arton)" e é assim que ele chega aqui.
 */
const ALIAS: Record<string, string> = {
  golem_ameacas_de_arton: "golem_desperto",
  kobolds: "kobold",
};

export function chaveDaRaca(idOrName: string): string {
  const s = slug(idOrName);
  return ALIAS[s] ?? s;
}

export function montagemDaRaca(idOrName: string): Montagem | null {
  return MONTAGENS[chaveDaRaca(idOrName)] ?? null;
}

export const chavePasso = (passoId: string): string => `mont_${passoId}`;
export const chaveSub = (passoId: string, opcaoId: string): string => `mont_${passoId}_${opcaoId}_sub`;

export function opcoesMarcadas(passo: PassoMontagem, escolhas: Record<string, unknown>): OpcaoMontagem[] {
  const ids = escolhas[chavePasso(passo.id)];
  const lista = Array.isArray(ids) ? ids.map(String) : typeof ids === "string" && ids ? [ids] : [];
  return passo.opcoes.filter((o) => lista.includes(o.id));
}

/** Passo de uma escolha obrigatória vira radio; o resto é checkbox. */
export function ehRadio(passo: PassoMontagem): boolean {
  return passo.escolher === 1 && !passo.opcional;
}

/**
 * Introdução que o pacote repete nas opções do passo ("Se escolher uma
 * maravilha mecânica, você recebe um dos poderes a seguir…"): aparece uma vez
 * no cabeçalho e sai das descrições. Nem toda opção a repete (Arma Elemental
 * não tem), então vale a frase que abre a MAIORIA delas.
 */
export function introRepetida(descricoes: string[]): string {
  const textos = descricoes.map((d) => d.trim()).filter((d) => d.length > 0);
  if (textos.length < 3) return "";
  const frases = (t: string): string[] => t.split(/(?<=[.!?])\s+/).filter(Boolean);

  const contagem = new Map<string, number>();
  for (const t of textos) {
    const primeira = frases(t)[0] ?? "";
    if (primeira.length >= 30) contagem.set(primeira, (contagem.get(primeira) ?? 0) + 1);
  }
  let abertura = "";
  let vezes = 0;
  for (const [frase, n] of contagem) {
    if (n > vezes) {
      abertura = frase;
      vezes = n;
    }
  }
  if (vezes < 2 || vezes * 2 < textos.length) return "";

  // Estende enquanto as descrições que abrem assim seguirem iguais.
  const grupo = textos.filter((t) => t.startsWith(abertura)).map(frases);
  const intro = [abertura];
  for (let i = 1; ; i++) {
    const frase = grupo[0]?.[i];
    if (!frase || !grupo.every((f) => f[i] === frase)) break;
    intro.push(frase);
  }
  return intro.join(" ");
}

/**
 * Opção que o jogador não pode marcar agora: o passo já encheu, outra opção do
 * mesmo grupo exclusivo está marcada (as três Afinidades Elementais) ou falta o
 * pré-requisito. Prevenir é melhor que avisar depois (Ray).
 */
export function opcaoBloqueada(
  passo: PassoMontagem,
  opcao: OpcaoMontagem,
  marcadas: OpcaoMontagem[]
): boolean {
  if (marcadas.some((o) => o.id === opcao.id)) return false;
  // Radio (uma escolha obrigatória) troca sozinho; checkbox precisa travar ao
  // encher a cota, senão "no máximo 1" vira aviso ("Maravilha Mecânica").
  if (!ehRadio(passo) && marcadas.length >= passo.escolher) return true;
  if (opcao.exclusivo && marcadas.some((o) => o.exclusivo === opcao.exclusivo)) return true;
  const ids = new Set(marcadas.map((o) => o.id));
  return (opcao.requer ?? []).some((req) => !ids.has(req));
}

export function subMarcada(passoId: string, opcaoId: string, escolhas: Record<string, unknown>): string {
  const v = escolhas[chaveSub(passoId, opcaoId)];
  return typeof v === "string" ? v : "";
}

function marcadas(idOrName: string, escolhas: Record<string, unknown>): Array<{ passo: PassoMontagem; opcao: OpcaoMontagem }> {
  const m = montagemDaRaca(idOrName);
  if (!m?.passos) return [];
  return m.passos.flatMap((passo) => opcoesMarcadas(passo, escolhas).map((opcao) => ({ passo, opcao })));
}

/** Grupos de atributo à escolha: os da raça inteira (Dons) + os da opção marcada (Natureza Animal, Bronze). */
export function gruposDeAtributoDaMontagem(idOrName: string, escolhas: Record<string, unknown>): AtributoEscolhaDef[] {
  const m = montagemDaRaca(idOrName);
  if (!m) return [];
  const grupos: AtributoEscolhaDef[] = [...(m.atributos_escolha ?? [])];
  for (const { opcao } of marcadas(idOrName, escolhas)) {
    if (opcao.atributos_escolha) {
      grupos.push({
        valor: opcao.atributos_escolha.valor,
        quantidade: opcao.atributos_escolha.quantidade,
        atributos_diferentes: Boolean(opcao.atributos_escolha.atributos_diferentes),
        atributos_disponiveis: null,
        observacao: opcao.nome,
      });
    }
  }
  return grupos;
}

/** Modificadores fixos das opções marcadas (Minúsculo For –1, chassi de Barro Con +2…). */
export function atributosFixosDaMontagem(idOrName: string, escolhas: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { opcao } of marcadas(idOrName, escolhas)) {
    for (const [k, v] of Object.entries(opcao.atributos ?? {})) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function tamanhoDaMontagem(idOrName: string, escolhas: Record<string, unknown>): string | null {
  return marcadas(idOrName, escolhas).find((x) => x.opcao.tamanho)?.opcao.tamanho ?? null;
}

export function deslocamentoDaMontagem(idOrName: string, escolhas: Record<string, unknown>): number | null {
  return marcadas(idOrName, escolhas).find((x) => x.opcao.deslocamento)?.opcao.deslocamento ?? null;
}

/** Quantas perícias treinadas da raça viraram outra coisa (Mashin: maravilha no lugar de uma perícia). */
export function periciasTrocadasNaMontagem(idOrName: string, escolhas: Record<string, unknown>): number {
  const m = montagemDaRaca(idOrName);
  if (!m?.passos) return 0;
  return m.passos.filter((p) => p.troca_pericia && opcoesMarcadas(p, escolhas).length > 0).length;
}

/** Opções marcadas, na ordem dos passos, com a sub-escolha resolvida. */
export function opcoesDaMontagem(
  idOrName: string,
  escolhas: Record<string, unknown>
): Array<{ opcao: OpcaoMontagem; sufixo?: string; magiaId?: string }> {
  return marcadas(idOrName, escolhas).map(({ passo, opcao }) => {
    const sub = subMarcada(passo.id, opcao.id, escolhas);
    const out: { opcao: OpcaoMontagem; sufixo?: string; magiaId?: string } = { opcao };
    if (opcao.sub?.opcoes && sub) out.sufixo = opcao.sub.opcoes.find((o) => o.id === sub)?.rotulo ?? sub;
    if (opcao.sub?.magia && sub) out.magiaId = sub;
    return out;
  });
}

export interface PoderDaMontagem {
  poder: string;
  /** Vai no nome do item: "Armamento Kallyanach (Cauda (impacto))". */
  sufixo?: string;
  efeitos: Efeito[];
  /** Id de magia do compêndio escolhida na sub-escolha. */
  magiaId?: string;
}

/** Itens de poder a embutir na ficha, com sufixo/efeitos/magia da sub-escolha. */
export function poderesDaMontagem(idOrName: string, escolhas: Record<string, unknown>): PoderDaMontagem[] {
  const out: PoderDaMontagem[] = [];
  for (const { passo, opcao } of marcadas(idOrName, escolhas)) {
    if (!opcao.poder) continue;
    const sub = subMarcada(passo.id, opcao.id, escolhas);
    const item: PoderDaMontagem = { poder: opcao.poder, efeitos: opcao.efeitos ?? [] };
    if (opcao.sub?.opcoes && sub) item.sufixo = opcao.sub.opcoes.find((o) => o.id === sub)?.rotulo ?? sub;
    if (opcao.sub?.magia && sub) item.magiaId = sub;
    out.push(item);
  }
  return out;
}

export interface Anotacao {
  item: string;
  sufixo?: string;
  efeitos: Efeito[];
}

/** Opções sem item próprio que marcam um item já concedido pela raça (Tabu: –5 na perícia). */
export function anotacoesDaMontagem(idOrName: string, escolhas: Record<string, unknown>): Anotacao[] {
  return marcadas(idOrName, escolhas)
    .filter(({ opcao }) => opcao.anotar)
    .map(({ opcao }) => ({ item: opcao.anotar!, sufixo: opcao.nome, efeitos: opcao.efeitos ?? [] }));
}

export function pendenciasDaMontagem(idOrName: string, escolhas: Record<string, unknown>): string[] {
  const m = montagemDaRaca(idOrName);
  if (!m?.passos) return [];
  const faltando: string[] = [];
  for (const passo of m.passos) {
    const marc = opcoesMarcadas(passo, escolhas);
    if (marc.length === 0) {
      if (!passo.opcional) faltando.push(`${passo.nome}: escolha ${passo.escolher}.`);
      continue;
    }
    if (marc.length < passo.escolher && !passo.opcional) faltando.push(`${passo.nome}: escolha ${passo.escolher} (${marc.length} marcada(s)).`);
    if (marc.length > passo.escolher) faltando.push(`${passo.nome}: no máximo ${passo.escolher}.`);
    const grupos = marc.map((o) => o.exclusivo).filter(Boolean);
    if (new Set(grupos).size !== grupos.length) faltando.push(`${passo.nome}: só uma opção do mesmo grupo (${marc.find((o) => o.exclusivo)?.nome.split(" (")[0]}).`);
    const ids = new Set(marc.map((o) => o.id));
    for (const o of marc) {
      for (const req of o.requer ?? []) {
        if (!ids.has(req)) faltando.push(`${o.nome} exige ${passo.opcoes.find((x) => x.id === req)?.nome ?? req}.`);
      }
      if (o.sub && !subMarcada(passo.id, o.id, escolhas)) faltando.push(`${o.nome}: ${o.sub.rotulo.toLowerCase()} — complete a escolha.`);
    }
  }
  return faltando;
}
