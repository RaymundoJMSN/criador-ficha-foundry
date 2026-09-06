import type { IndexedEquipamento } from "../compendium/types.js";
import { getOrigem, type ItemInicial } from "./origem.js";
import { getClasse } from "./classe.js";

/**
 * Equipamento inicial (LB p.146): itens da origem + kit do 1º nível + T$.
 * Regras puras — o passo Equipamento e o writer leem daqui.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/^(uma?|dois|duas)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

type Filtro = (i: IndexedEquipamento) => boolean;
const arma = (prof: string): Filtro => (i) => i.type === "arma" && i.system["proficiencia"] === prof;
const distancia: Filtro = (i) => ["short", "medium"].includes(String(i.system["alcance"] ?? ""));
const armadura = (tipo: string): Filtro => (i) => i.type === "equipamento" && i.system["tipo"] === tipo;
const e =
  (...fs: Filtro[]): Filtro =>
  (i) =>
    fs.every((f) => f(i));

/** Texto de categoria → filtro no compêndio. Chaves já normalizadas. */
export const CATEGORIAS: Record<string, { label: string; filtro: Filtro }> = {
  "arma simples": { label: "Arma simples", filtro: arma("simples") },
  "arma marcial": { label: "Arma marcial", filtro: arma("marcial") },
  "arma exotica": { label: "Arma exótica", filtro: arma("exotica") },
  "arma de fogo": { label: "Arma de fogo", filtro: arma("fogo") },
  "arma simples de ataque a distancia": { label: "Arma simples à distância", filtro: e(arma("simples"), distancia) },
  "arma marcial de ataque a distancia": { label: "Arma marcial à distância", filtro: e(arma("marcial"), distancia) },
  "armadura leve": { label: "Armadura leve", filtro: armadura("leve") },
  "armadura pesada": { label: "Armadura pesada", filtro: armadura("pesada") },
};

/** Nome da origem/livro → item do compêndio (sem acento, sem artigo, singular/plural). */
export function acharPorNome(nome: string, itens: IndexedEquipamento[]): IndexedEquipamento | undefined {
  // "rações de viagem" ↔ "Ração de viagem", "flechas" ↔ "Flechas"
  const singular = (s: string) =>
    norm(s)
      .split(" ")
      .map((w) => w.replace(/oes$/, "ao").replace(/s$/, ""))
      .join(" ");
  const alvo = singular(nome);
  return itens.find((i) => singular(i.name) === alvo);
}

/** Dinheiro escrito como item: "T$ 100", "T$ 2d6". Devolve fixo ou fórmula. */
export function dinheiroDoTexto(texto: string): { fixo?: number; formula?: string } | null {
  const m = /^T\$\s*(\d+d\d+|\d+)$/i.exec(texto.trim());
  if (!m) return null;
  return /d/.test(m[1]!) ? { formula: m[1]! } : { fixo: Number(m[1]) };
}

export interface ItemGratis {
  label: string;
  itemId?: string;
  qtd: number;
  /** Texto para a descrição quando o item não existe no compêndio. */
  nota?: string;
}

export interface EscolhaGratis {
  chave: string;
  label: string;
  /** Opções de primeiro nível (texto da origem ou nomes de item). */
  opcoes: Array<{ valor: string; label: string; selected: boolean }>;
  /** Segundo nível: itens da categoria escolhida. */
  sub?: Array<{ valor: string; label: string; selected: boolean }>;
  feita: boolean;
}

export interface EquipamentoInicial {
  gratis: ItemGratis[];
  escolhas: EscolhaGratis[];
  dinheiroFixo: number;
  formulasDinheiro: string[];
}

/** Uma opção de texto vira: categoria (sub-select), item do compêndio ou texto solto. */
function resolverOpcao(
  chave: string,
  texto: string,
  itens: IndexedEquipamento[],
  respostas: Record<string, string>
): { gratis?: ItemGratis; sub?: EscolhaGratis["sub"]; feita: boolean } {
  const cat = CATEGORIAS[norm(texto)];
  if (cat) {
    const lista = itens.filter(cat.filtro).sort((a, b) => a.name.localeCompare(b.name));
    const idSel = respostas[`${chave}_item`];
    const item = lista.find((i) => i.id === idSel);
    return {
      gratis: item ? { label: item.name, itemId: item.id, qtd: 1 } : undefined,
      sub: [
        { valor: "", label: "— escolha —", selected: !item },
        ...lista.map((i) => ({ valor: i.id, label: i.name, selected: i.id === idSel })),
      ],
      feita: !!item,
    };
  }
  const item = acharPorNome(texto, itens);
  return {
    gratis: item ? { label: item.name, itemId: item.id, qtd: 1 } : { label: texto, qtd: 1 },
    feita: true,
  };
}

function entradaOrigem(
  idx: number,
  it: ItemInicial,
  itens: IndexedEquipamento[],
  respostas: Record<string, string>,
  out: EquipamentoInicial
): void {
  const chave = `origem_${idx}`;
  if (it.escolha?.length) {
    const sel = respostas[chave] ?? "";
    const r = sel ? resolverOpcao(chave, sel, itens, respostas) : { feita: false };
    if (r.gratis) out.gratis.push({ ...r.gratis, qtd: it.quantidade ?? 1 });
    out.escolhas.push({
      chave,
      label: it.escolha.join(" ou "),
      opcoes: [
        { valor: "", label: "— escolha —", selected: !sel },
        ...it.escolha.map((o) => ({ valor: o, label: o, selected: o === sel })),
      ],
      sub: r.sub,
      feita: r.feita,
    });
    return;
  }
  const texto = (it.item ?? "").trim();
  if (!texto) return;
  const din = dinheiroDoTexto(texto);
  if (din) {
    if (din.fixo) out.dinheiroFixo += din.fixo;
    if (din.formula) out.formulasDinheiro.push(din.formula);
    return;
  }
  const nota = [it.valor_max && `até ${it.valor_max}`, it.observacao].filter(Boolean).join(" — ");
  const item = acharPorNome(texto, itens);
  out.gratis.push(
    item
      ? { label: item.name, itemId: item.id, qtd: it.quantidade ?? 1, nota: nota || undefined }
      : { label: texto, qtd: it.quantidade ?? 1, nota: nota || undefined }
  );
}

/** Kit do 1º nível (LB p.146), conforme as proficiências da classe. */
function kitInicial(
  classeNome: string,
  itens: IndexedEquipamento[],
  respostas: Record<string, string>,
  out: EquipamentoInicial
): void {
  // ponytail: classe do compêndio sem lista de proficiências vira "simples + leves".
  const prof = getClasse(classeNome)?.proficiencias ?? [];
  const tem = (p: string) => (prof.length ? prof.includes(p) : p === "armas_simples" || p === "armaduras_leves");

  for (const nome of ["Mochila", "Saco de dormir", "Traje de viajante"]) {
    const item = acharPorNome(nome, itens);
    out.gratis.push(item ? { label: item.name, itemId: item.id, qtd: 1 } : { label: nome, qtd: 1 });
  }

  const categoria = (chave: string, label: string, texto: string) => {
    const r = resolverOpcao(chave, texto, itens, respostas);
    if (r.gratis) out.gratis.push(r.gratis);
    out.escolhas.push({ chave, label, opcoes: [], sub: r.sub, feita: r.feita });
  };
  categoria("kit_arma_simples", "Arma simples", "arma simples");
  if (tem("armas_marciais")) categoria("kit_arma_marcial", "Arma marcial", "arma marcial");

  // "Exceção: arcanistas começam sem armadura" — todo personagem sabe usar
  // armadura leve (LB p.38), então a exceção é pela classe, não pela proficiência.
  if (tem("armaduras_leves") && !norm(classeNome).startsWith("arcanista")) {
    // No compêndio a "armadura de couro" tem o nome completo; as outras não.
    const nomes = ["Armadura de couro", "Couro batido", "Gibão de peles", ...(tem("armaduras_pesadas") ? ["Brunea"] : [])];
    const lista = nomes.map((n) => acharPorNome(n, itens)).filter((i): i is IndexedEquipamento => !!i);
    const idSel = respostas["kit_armadura_item"];
    const item = lista.find((i) => i.id === idSel);
    if (item) out.gratis.push({ label: item.name, itemId: item.id, qtd: 1 });
    out.escolhas.push({
      chave: "kit_armadura",
      label: "Armadura",
      opcoes: [],
      sub: [
        { valor: "", label: "— escolha —", selected: !item },
        ...lista.map((i) => ({ valor: i.id, label: i.name, selected: i.id === idSel })),
      ],
      feita: !!item,
    });
  }
  if (tem("escudos")) {
    const item = acharPorNome("Escudo leve", itens);
    out.gratis.push(item ? { label: item.name, itemId: item.id, qtd: 1 } : { label: "Escudo leve", qtd: 1 });
  }
}

/**
 * Tudo que o personagem ganha de graça: itens da origem em qualquer nível;
 * kit e T$ da origem só no 1º nível (acima disso a Tabela 3-1 substitui).
 */
export function equipamentoInicial(
  state: { nivel: number; origemId: string; classeNome: string; escolhasPorItem: Record<string, unknown> },
  itens: IndexedEquipamento[]
): EquipamentoInicial {
  const out: EquipamentoInicial = { gratis: [], escolhas: [], dinheiroFixo: 0, formulasDinheiro: [] };
  const respostas = (state.escolhasPorItem["itens_iniciais"] as Record<string, string> | undefined) ?? {};

  const origem = state.origemId ? getOrigem(state.origemId) : null;
  origem?.itens_iniciais?.forEach((it, idx) => entradaOrigem(idx, it, itens, respostas, out));

  if (state.nivel === 1) {
    kitInicial(state.classeNome, itens, respostas, out);
  } else {
    out.dinheiroFixo = 0;
    out.formulasDinheiro = [];
  }
  return out;
}
