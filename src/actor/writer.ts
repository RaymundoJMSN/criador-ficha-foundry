import { MODULE_ID } from "../constants.js";
import { mapStateToActorData, getTrainedPericaCodes , getTrainedPericaSlugs } from "./mapper.js";
import { periciaDoOficio } from "../rules/oficio.js";
import periciasSistemaRaw from "../data/pericias_sistema.json";

const periciasSistema = periciasSistemaRaw as unknown as Record<string, { atributo: string; st: boolean; pda: boolean; size: boolean }>;

/**
 * Sentidos da ficha (Visão no Escuro etc.): o T20-DB não guarda, mas o texto da
 * raça e dos poderes raciais diz. Roda depois dos itens, no ator já montado.
 */
const SENTIDOS: Array<[RegExp, string]> = [
  [/vis[ãa]o no escuro/i, "escuro"],
  [/vis[ãa]o na penumbra/i, "penumbra"],
  [/percep[çc][ãa]o [àa]s cegas/i, "cegas"],
  [/faro/i, "faro"],
];

function sentidosDosItens(itens: Array<{ type?: string; name?: string; system?: Record<string, unknown> }>): string[] {
  const achados = new Set<string>();
  for (const item of itens) {
    const sys = (item.system ?? {}) as { tipo?: string; description?: { value?: string } };
    if (item.type !== "race" && sys.tipo !== "racial") continue;
    const texto = `${item.name ?? ""} ${(sys.description?.value ?? "").replace(/<[^>]+>/g, " ")}`;
    for (const [re, chave] of SENTIDOS) if (re.test(texto)) achados.add(chave);
  }
  return [...achados];
}
import type { WizardState } from "../wizard/state.js";
import type { IndexedPoder } from "../compendium/types.js";
import { CompendiumIndex } from "../compendium/index.js";
import { toNomeSlug } from "../compendium/slug.js";
import { getClasse, respostaSubEscolha } from "../rules/classe.js";
import { itensDeEscolhasRaciais, periciasDeEscolhasRaciais } from "../rules/raca.js";
import { toPericiaCode } from "../rules/pericia-slug.js";
import { classesDoPersonagem, habilidadesDeTodas, caminhoDe } from "../rules/multiclasse.js";
import { getClasseProgressao } from "../rules/progressao.js";
import { distincaoEscolhida } from "../rules/distincoes.js";
import { resolverPoder, opcoesDaHabilidade, chaveHabilidade } from "../compendium/resolver.js";
import { prepareEquipamentoContext } from "../wizard/steps/equipamento.js";
import { getOrigem, validarBeneficios, slugsDoPoderDaOrigem } from "../rules/origem.js";
import { getDivindade, PANTEAO } from "../rules/divindade.js";
import { slugsDosPoderes } from "../rules/magias.js";
import magiaPorPoderRaw from "../data/magia_por_poder.json";
const magiaPorPoder = magiaPorPoderRaw as Record<string, string>;
import { validateRaceModifiers, distribuirAbertos } from "../rules/subescolhas.js";
import { opcoesDaMontagem, anotacoesDaMontagem } from "../rules/montagem.js";
import { poderesAdquiridos, respostasDeSubEscolhas } from "../rules/subescolhas-poder.js";
import { PERICIA_NOMES } from "../wizard/steps/pericias.js";
import { ESCOLAS } from "../rules/magias.js";
import type { IndexedRace } from "../compendium/types.js";
import { escolhasDaRaca, pedidoAtivo, partesDoPedido } from "../rules/raca.js";
import { descricaoDoLivro } from "../compendium/index.js";
import {
  beneficiosDeOrigemPermitidos,
  complicacaoEscolhida,
  complicacoesIdadeEscolhidas,
  getComplicacaoIdade,
  faixaDoPersonagem,
  FAIXA_PADRAO,
} from "../rules/idade.js";

/** Active Effect (transfer) com as mudanças ADD — o mesmo formato das complicações de idade. */
const aeDe = (nome: string, efeitos: Array<{ chave: string; valor: number }>) =>
  efeitos.length
    ? [{ name: nome, transfer: true, changes: efeitos.map((e) => ({ key: e.chave, mode: 2, value: String(e.valor) })) }]
    : [];

interface MontagemResolvida {
  /** Itens de poder (e magias de sub-escolha) prontos para embutir. */
  docs: unknown[];
  /** O que o item do compêndio NÃO aplica sozinho e o wizard precisa aplicar. */
  atributos: Record<string, number>;
  tamanho: string | null;
  deslocamento: number | null;
}

/**
 * Montagem da raça (Duende, Kallyanach, Golem Desperto…): resolve o item de
 * cada opção marcada e olha os Active Effects que ele já traz. O item do
 * compêndio é a fonte dos efeitos mecânicos ("Duende Minúsculo" já põe For –1,
 * tamanho e deslocamento); o wizard só aplica por fora o que o item não tem —
 * senão o For –1 entrava duas vezes.
 */
async function resolverMontagem(state: WizardState): Promise<MontagemResolvida> {
  const racaRef = state.racaNome || state.racaId;
  const out: MontagemResolvida = { docs: [], atributos: {}, tamanho: null, deslocamento: null };
  const marcadas = opcoesDaMontagem(racaRef, state.escolhasPorItem);
  if (marcadas.length === 0) return out;
  const todosPoderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
  const racaSlug = toNomeSlug(racaRef.split(" (")[0]!);
  for (const { opcao, sufixo, magiaId } of marcadas) {
    const chaves = new Set<string>();
    if (opcao.poder) {
      const alvo = toNomeSlug(opcao.poder);
      const cands = todosPoderes.filter((p) => toNomeSlug(p.name) === alvo || toNomeSlug(p.name).startsWith(alvo));
      const item =
        cands.find((p) => toNomeSlug(p.system.subtipo ?? "").startsWith(racaSlug)) ??
        cands.find((p) => p.system.tipo === "racial") ??
        cands[0];
      const doc = item
        ? ((await resolveItem(item.id)) as { name: string; effects?: Array<{ changes?: Array<{ key: string }> }> } | null)
        : null;
      if (doc) {
        for (const ef of doc.effects ?? []) for (const c of ef.changes ?? []) chaves.add(c.key);
        if (sufixo) doc.name = `${doc.name} (${sufixo})`;
        const faltam = (opcao.efeitos ?? []).filter((e) => !chaves.has(e.chave));
        if (faltam.length) doc.effects = [...(doc.effects ?? []), ...aeDe(doc.name, faltam)];
        out.docs.push(doc);
        if (magiaId) {
          const magia = await resolveItem(magiaId);
          if (magia) out.docs.push(magia);
        }
      } else {
        console.warn(`${MODULE_ID} | ActorWriter: poder da montagem "${opcao.poder}" não resolveu`);
      }
    }
    for (const [k, v] of Object.entries(opcao.atributos ?? {})) {
      if (chaves.has(`system.atributos.${k}.value`) || chaves.has(`system.atributos.${k}.bonus`)) continue;
      out.atributos[k] = (out.atributos[k] ?? 0) + v;
    }
    if (opcao.tamanho && !chaves.has("system.tracos.tamanho")) out.tamanho = opcao.tamanho;
    if (opcao.deslocamento && !chaves.has("system.attributes.movement.walk")) out.deslocamento = opcao.deslocamento;
  }
  return out;
}

const ATRIBUTO_NOME: Record<string, string> = { for: "Força", des: "Destreza", con: "Constituição", int: "Inteligência", sab: "Sabedoria", car: "Carisma" };

interface ItemNaFicha {
  name: string;
  uuid: string;
  update(d: Record<string, unknown>): Promise<unknown>;
}
interface AtorMinimo {
  items: { filter(fn: (i: ItemNaFicha) => boolean): ItemNaFicha[] };
  createEmbeddedDocuments(type: string, data: unknown[]): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Sub-escolhas de poder (data/subescolhas_poder.json) aplicadas na ficha pronta:
 * atributo vira Active Effect no ator (origem = o item), perícia treinada vira
 * `treinado`, bônus em perícia vira AE, magia escolhida entra como item, e a
 * escolha sempre fica registrada no nome do item ("Foco em Arma (Espada longa)").
 */
async function aplicarSubEscolhasDePoder(actorBruto: unknown, state: WizardState): Promise<void> {
  const actor = actorBruto as AtorMinimo;
  const allPoderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
  const respostas = respostasDeSubEscolhas(
    poderesAdquiridos(state, allPoderes, CompendiumIndex.getAll("race") as IndexedRace[]),
    state.escolhasPorItem
  );
  if (respostas.length === 0) return;

  const sufixos = new Map<ItemNaFicha, string[]>();
  const efeitos: unknown[] = [];
  const update: Record<string, unknown> = {};
  const magias: unknown[] = [];

  for (const r of respostas) {
    const itens = actor.items.filter((i) => {
      const s = toNomeSlug(i.name);
      return s === r.slug || s.startsWith(`${r.slug}_`);
    });
    const alvo = itens[Math.floor(r.i / (r.sub.quantidade ?? 1))] ?? itens[0];
    let rotulo = r.valor;
    switch (r.sub.tipo) {
      case "atributo": {
        rotulo = ATRIBUTO_NOME[r.valor] ?? r.valor;
        efeitos.push({
          name: `${r.nome} (${rotulo})`,
          transfer: false,
          origin: alvo?.uuid,
          changes: [{ key: `system.atributos.${r.valor}.bonus`, mode: 2, value: String(r.sub.valor ?? 1) }],
        });
        break;
      }
      case "pericia": {
        rotulo = PERICIA_NOMES[r.valor] ?? r.valor;
        const code = toPericiaCode(r.valor);
        if (code && r.sub.treinar) update[`system.pericias.${code}.treinado`] = true;
        if (code && r.sub.bonus) {
          efeitos.push({
            name: `${r.nome} (${rotulo})`,
            transfer: false,
            origin: alvo?.uuid,
            changes: [{ key: `system.pericias.${code}.outros`, mode: 2, value: String(r.sub.bonus) }],
          });
        }
        break;
      }
      case "magia": {
        const doc = await resolveItem(r.valor);
        if (doc) magias.push(doc);
        rotulo = CompendiumIndex.getById("magia", r.valor)?.name ?? r.valor;
        break;
      }
      case "magia_conhecida":
        rotulo = CompendiumIndex.getById("magia", r.valor)?.name ?? r.valor;
        break;
      case "arma":
        rotulo = CompendiumIndex.getById("arma", r.valor)?.name ?? r.valor;
        break;
      case "lista": {
        const op = r.sub.opcoes?.find((o) => o.id === r.valor);
        rotulo = op?.rotulo ?? r.valor;
        // Totem Espiritual: o animal define a magia, que entra como item.
        if (op?.magia) {
          const m = CompendiumIndex.getAll("magia").find((x) => toNomeSlug(x.name) === op.magia);
          const doc = m ? await resolveItem(m.id) : null;
          if (doc) magias.push(doc);
        }
        break;
      }
      case "escola":
        rotulo = ESCOLAS[r.valor]?.nome ?? r.valor;
        break;
      case "habilidade_outra_classe":
      case "poder_da_classe":
      case "poder_classe_ou_geral": {
        const doc = await resolveItem(r.valor);
        if (doc) magias.push(doc);
        rotulo = CompendiumIndex.getById("poder", r.valor)?.name ?? r.valor;
        break;
      }
      case "texto":
        rotulo = r.valor.trim();
        break;
    }
    if (alvo) sufixos.set(alvo, [...(sufixos.get(alvo) ?? []), rotulo]);
    else console.warn(`${MODULE_ID} | ActorWriter: poder "${r.nome}" não achado na ficha para registrar "${rotulo}"`);
  }

  try {
    for (const [item, lista] of sufixos) await item.update({ name: `${item.name} (${lista.join(", ")})` });
    if (efeitos.length) await actor.createEmbeddedDocuments("ActiveEffect", efeitos);
    if (Object.keys(update).length) await actor.update(update);
    if (magias.length) await actor.createEmbeddedDocuments("Item", magias);
    console.log(`${MODULE_ID} | ActorWriter: ${respostas.length} sub-escolha(s) de poder aplicada(s)`);
  } catch (err) {
    console.warn(`${MODULE_ID} | ActorWriter: falha nas sub-escolhas de poder:`, err);
  }
}

/**
 * Compatibilidade com o módulo T20 Nível dos Poderes (`flags.t20-nivel-poderes.
 * nivelObtido`: 1–20 ou "bonus"). Habilidade de classe leva o nível da tabela;
 * poder escolhido ocupa, na ordem, os níveis que dão poder; o resto (origem,
 * raça, divindade, distinção, idade) é "bonus" — obtido fora de nível.
 */
async function marcarNiveisDosPoderes(actorBruto: unknown, state: WizardState): Promise<void> {
  const g = (globalThis as unknown as { game?: { modules?: { get(id: string): { active?: boolean } | undefined } } }).game;
  if (!g?.modules?.get("t20-nivel-poderes")?.active) return;
  const actor = actorBruto as {
    items: { filter(fn: (i: { id: string; type: string; name: string }) => boolean): Array<{ id: string; type: string; name: string }> };
    updateEmbeddedDocuments(type: string, data: unknown[]): Promise<unknown>;
  };
  const allPoderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
  const nivelPorSlug = new Map<string, number | "bonus">();
  const slots: number[] = [];
  for (const c of classesDoPersonagem(state)) {
    const tabela = (getClasseProgressao(c.classeNome || c.classeId)?.tabela ?? {}) as Record<string, { automaticos?: string[]; escolhas?: number }>;
    for (let n = 1; n <= c.niveis; n++) {
      const linha = tabela[String(n)];
      for (const slug of linha?.automaticos ?? []) {
        const item = resolverPoder(slug, c.classeSlug, allPoderes, "ability")?.item;
        if (item) nivelPorSlug.set(toNomeSlug(item.name), n);
      }
      for (let k = 0; k < (linha?.escolhas ?? 0); k++) slots.push(n);
    }
  }
  for (const id of state.poderes) {
    const p = allPoderes.find((x) => x.id === id);
    if (p) nivelPorSlug.set(toNomeSlug(p.name), slots.shift() ?? "bonus");
  }
  const updates = actor.items
    .filter((i) => i.type === "poder")
    .map((i) => {
      const slug = toNomeSlug(i.name);
      const achado = [...nivelPorSlug.entries()].find(([s]) => slug === s || slug.startsWith(`${s}_`));
      return { _id: i.id, "flags.t20-nivel-poderes.nivelObtido": achado?.[1] ?? "bonus" };
    });
  if (updates.length === 0) return;
  try {
    await actor.updateEmbeddedDocuments("Item", updates);
    console.log(`${MODULE_ID} | ActorWriter: nível dos poderes marcado em ${updates.length} item(ns)`);
  } catch (err) {
    console.warn(`${MODULE_ID} | ActorWriter: falha ao marcar nível dos poderes:`, err);
  }
}

/**
 * Resolves a compendium item id to its full document object.
 * Returns null if the pack or document is not found.
 */
/** Item do compêndio pronto para embutir; poder sem descrição ganha o texto do livro. */
async function resolveItem(itemId: string): Promise<unknown | null> {
  const obj = (await resolveItemBruto(itemId)) as { type?: string; name?: string; system?: { description?: { value?: string } } } | null;
  if (obj?.type === "poder" && !(obj.system?.description?.value ?? "").replace(/<[^>]+>/g, "").trim()) {
    const texto = descricaoDoLivro(obj.name ?? "");
    if (texto) ((obj.system ??= {}).description ??= {}).value = `<p>${texto}</p>`;
  }
  return obj;
}

async function resolveItemBruto(itemId: string): Promise<unknown | null> {
  // @ts-expect-error fvtt-types game.packs typing incomplete for v13
  const packs = game.packs as Collection<CompendiumCollection<Item>>;
  for (const pack of packs) {
    // @ts-expect-error fvtt-types documentName typed as document type not string in v13
    if (pack.documentName !== "Item") continue;
    try {
      const doc = await pack.getDocument(itemId);
      if (doc) return (doc as { toObject(): unknown }).toObject();
    } catch {
      // not in this pack
    }
  }
  return null;
}

/**
 * Creates a tormenta20 character actor from the given wizard state.
 * Resolves all item ids from compendium packs before calling Actor.create().
 *
 * Race and classe items are added via createEmbeddedDocuments in separate calls
 * so the tormenta20 system's onCreate hooks fire and auto-grant powers/features.
 * Perícias are applied via actor.update() after all items are embedded so the
 * system schema has set correct atributo values for each perícia.
 */
export class ActorWriter {
  static async create(state: WizardState): Promise<void> {
    const missingItems: string[] = [];

    const idsToResolve = [
      state.racaId,
      state.classeId,
      ...state.poderes,
      ...state.poderesAutoGrant,
      ...state.magias,
    ].filter(Boolean);

    const resolvedItems: unknown[] = [];
    for (const id of idsToResolve) {
      const obj = await resolveItem(id);
      if (obj) {
        resolvedItems.push(obj);
      } else {
        missingItems.push(id);
        console.warn(`${MODULE_ID} | ActorWriter: item not found in packs: ${id}`);
      }
    }

    if (missingItems.length > 0) {
      ui.notifications?.warn(
        `T20W: ${missingItems.length} item(s) não encontrado(s). Actor criado sem eles.`
      );
    }

    // Separate race + classe — both need createEmbeddedDocuments for system hooks
    const raceItemData = resolvedItems.find(
      (item) => (item as Record<string, unknown>)["type"] === "race"
    );
    const classeItemData = resolvedItems.find(
      (item) => (item as Record<string, unknown>)["type"] === "classe"
    );
    const otherItems = resolvedItems.filter(
      (item) => {
        const t = (item as Record<string, unknown>)["type"];
        return t !== "race" && t !== "classe";
      }
    );

    // Level lives on the classe item: the system derives actor.nivel from
    // sum(classe items .system.niveis) and rewrites attributes.nivel.value from it.
    // Set it on the item DATA (before embedding) so PV/PM are computed once, correctly.
    if (classeItemData) {
      const sys = (((classeItemData as Record<string, unknown>)["system"] ??= {}) as Record<
        string,
        unknown
      >);
      sys["niveis"] = state.nivel;
      sys["inicial"] = true;
    }

    // Raça com atributo à escolha (humano +1×3, osteon…): o sistema abriria o
    // diálogo "Atributos Dinâmicos" ao embutir o item e ficava esperando o
    // jogador — a criação travava aí. A escolha já foi feita no wizard: soma
    // no `system.atributos` do item (vira `.racial` na ficha) e zera a lista
    // dinâmica para o diálogo não abrir.
    const montagem = await resolverMontagem(state);
    if (raceItemData) {
      const sys = (((raceItemData as Record<string, unknown>)["system"] ??= {}) as Record<string, unknown>);
      const escolhas = (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];
      const racaRef = state.racaNome || state.racaId;
      const { modificadores } = validateRaceModifiers(racaRef, escolhas, state.escolhasPorItem);
      const atributos = ((sys["atributos"] ??= {}) as Record<string, number>);
      // Montagem: só o que o item da opção não aplica sozinho (ver resolverMontagem).
      for (const [k, v] of Object.entries(montagem.atributos)) atributos[k] = (atributos[k] ?? 0) + v;
      if (montagem.deslocamento) {
        sys["movement"] = { ...((sys["movement"] as Record<string, unknown> | undefined) ?? {}), walk: montagem.deslocamento };
      }
      // Raças Abertas (HA p.281): os fixos da raça vão para onde o jogador pôs.
      if (state.config.racasAbertas) {
        const dist = (state.escolhasPorItem["raca_aberta"] as Record<string, string> | undefined) ?? {};
        const abertos = distribuirAbertos(state.racaNome || state.racaId, dist).modificadores;
        for (const k of ["for", "des", "con", "int", "sab", "car"]) atributos[k] = abertos[k as keyof typeof abertos] ?? 0;
      }
      // Idades Variadas (HA p.288): o sistema calcula PV/PM só com base + racial
      // ("Pontos ignoram bônus de Atributo"), então o modificador permanente da
      // faixa etária vai na coluna racial junto com o da raça — um ancião com
      // Con −2 tem menos PV, como manda o livro.
      if (state.config.idadesVariadas) {
        for (const [k, v] of Object.entries(faixaDoPersonagem(state).atributos)) atributos[k] = (atributos[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(modificadores)) atributos[k] = (atributos[k] ?? 0) + (v ?? 0);
      const din = (sys["atributosDinamicos"] as Record<string, unknown> | undefined) ?? {};
      sys["atributosDinamicos"] = { ...din, value: [] };
    }

    // NOTE: pericias excluded from Actor.create data — applied via update() after init
    const equip = prepareEquipamentoContext(state, CompendiumIndex.equipamentos());
    // Comprados (com quantidade) + grátis (origem e kit do 1º nível, LB p.146).
    // Item que não existe no compêndio (“joia de família”) vira item simples com
    // a observação na descrição, para não sumir da ficha.
    const mochila: unknown[] = [];
    for (const e of state.equipamento) {
      const doc = (await resolveItem(e.itemId)) as { system?: Record<string, unknown> } | null;
      if (!doc) {
        console.warn(`${MODULE_ID} | ActorWriter: item comprado não achado: ${e.itemId}`);
        continue;
      }
      (doc.system ??= {})["qtd"] = e.qty;
      mochila.push(doc);
    }
    for (const g of equip.gratis) {
      const doc = g.itemId
        ? ((await resolveItem(g.itemId)) as { system?: Record<string, unknown> } | null)
        : null;
      if (doc) {
        (doc.system ??= {})["qtd"] = g.qtd;
        if (g.nota) {
          const d = (doc.system["description"] as { value?: string } | undefined) ?? {};
          doc.system["description"] = { ...d, value: `<p><em>${g.nota}</em></p>${d.value ?? ""}` };
        }
        mochila.push(doc);
      } else {
        mochila.push({
          name: g.label,
          type: "equipamento",
          img: "icons/svg/item-bag.svg",
          system: { qtd: g.qtd, description: { value: g.nota ? `<p>${g.nota}</p>` : "" } },
        });
      }
    }
    const data = mapStateToActorData(state, otherItems, equip.dinheiroRestante);
    // Retrato e token: ícone da raça, em vez do "mystery man" padrão.
    const imgRaca = CompendiumIndex.getAll("race").find((r) => r.id === state.racaId)?.img;
    if (imgRaca && !imgRaca.includes("mystery-man")) {
      const extra = data as unknown as Record<string, unknown>;
      extra["img"] = imgRaca;
      extra["prototypeToken"] = { texture: { src: imgRaca }, name: data.name };
    }

    const actor = (await Actor.create(data as unknown as Parameters<typeof Actor.create>[0])) as
      | {
          name: string;
          id: string;
          sheet?: { render(force: boolean): void };
          createEmbeddedDocuments(type: string, data: unknown[]): Promise<unknown>;
          update(data: Record<string, unknown>): Promise<unknown>;
        }
      | null
      | undefined;

    if (!actor) return;

    // Add race item separately — fires tormenta20 onCreate hooks → auto-grants race powers
    if (raceItemData) {
      // Com a regra "Raças Abertas" DO SISTEMA ligada, _onCreateOwnedRace abre o
      // diálogo de distribuição e espera o jogador — e o wizard já distribuiu.
      // Mestre desliga só durante o embed; jogador sem permissão só é avisado.
      // @ts-expect-error settings do sistema não tipados
      const openRaces = Boolean(game.settings.get("tormenta20", "openRaces"));
      const podeMexer = openRaces && Boolean(game.user?.isGM);
      // @ts-expect-error settings do sistema não tipados
      if (podeMexer) await game.settings.set("tormenta20", "openRaces", false);
      else if (openRaces) ui.notifications?.warn("Raças Abertas do sistema está ligada: confirme o diálogo de atributos com os valores já escolhidos.");
      try {
        await actor.createEmbeddedDocuments("Item", [raceItemData]);
        console.log(`${MODULE_ID} | ActorWriter: race item added via createEmbeddedDocuments (hooks fired)`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to add race item separately:`, err);
      } finally {
        // @ts-expect-error settings do sistema não tipados
        if (podeMexer) await game.settings.set("tormenta20", "openRaces", true);
      }
    }

    // Add classe item separately — fires tormenta20 onCreate hooks for PV/PM setup.
    // Multiclasse (LB p.35): um item por classe; só a principal é `inicial`
    // (PV do 1º nível) — "ganha os PV de um nível subsequente, não do primeiro".
    const todasClasses = classesDoPersonagem(state);
    const classeItens: unknown[] = [];
    if (classeItemData) {
      ((classeItemData as Record<string, unknown>)["system"] as Record<string, unknown>)["niveis"] = todasClasses[0]!.niveis;
      classeItens.push(classeItemData);
    }
    for (const c of todasClasses.slice(1)) {
      const doc = (await resolveItem(c.classeId)) as { system?: Record<string, unknown> } | null;
      if (!doc) {
        console.warn(`${MODULE_ID} | ActorWriter: classe "${c.classeNome}" não resolveu`);
        continue;
      }
      (doc.system ??= {})["niveis"] = c.niveis;
      doc.system["inicial"] = false;
      classeItens.push(doc);
    }
    if (classeItens.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", classeItens);
        console.log(`${MODULE_ID} | ActorWriter: ${classeItens.length} item(ns) de classe`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to add classe item:`, err);
      }
    }

    // Arma dentro do Actor.create quebrava a preparação de dados (getAttackToHit
    // lê atributos que ainda não existem) e abortava raça/classe. Vai depois.
    if (mochila.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", mochila);
        console.log(`${MODULE_ID} | ActorWriter: ${mochila.length} item(ns) de equipamento`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: falha no equipamento:`, err);
      }
    }

    // Auto-grant class habilidades up to the character's level. An upgrade entry
    // (ataque_especial_8) has no item of its own — fall back to the family's base slug.
    const classeSlug = toNomeSlug(state.classeNome ?? "");
    const classeData = getClasse(classeSlug);
    const habilidadesTodas = habilidadesDeTodas(state);
    if (habilidadesTodas.length > 0) {
      const allPoderes = CompendiumIndex.getAll("poder");
      const habItems: unknown[] = [];
      // Slugs diferentes podem ser o mesmo item (Baluarte "aliados adjacentes" e
      // "alcance curto"): um item por id, senão a ficha ganha a habilidade em dobro.
      const idsVistos = new Set<string>();
      for (const { classe, slug } of habilidadesTodas) {
        // "Bênção da Justiça: Égide Sagrada / Montaria Sagrada": vai a opção escolhida.
        const opcoes = opcoesDaHabilidade(slug, allPoderes);
        const escolhido = state.escolhasPorItem[chaveHabilidade(slug)] as string | undefined;
        const match = opcoes.length
          ? opcoes.find((o) => o.id === escolhido)
          : resolverPoder(slug, classe.classeSlug, allPoderes, "ability")?.item;
        if (match) {
          if (idsVistos.has(match.id)) continue;
          idsVistos.add(match.id);
          const doc = await resolveItem(match.id);
          if (doc) habItems.push(doc);
          else console.warn(`${MODULE_ID} | ActorWriter: habilidade "${slug}" resolved null`);
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: habilidade "${slug}" not found in CompendiumIndex`);
        }
      }
      if (habItems.length > 0) {
        try {
          await actor.createEmbeddedDocuments("Item", habItems);
          console.log(`${MODULE_ID} | ActorWriter: granted ${habItems.length} class habilidades`);
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: failed to add habilidades:`, err);
        }
      }
    }

    // Caminho de cada classe (principal e multiclasse), se ela tem e já chegou nele.
    void classeData;
    const caminhosItens: unknown[] = [];
    for (const c of todasClasses) {
      const dados = getClasse(c.classeNome || c.classeId);
      const slugCaminho = caminhoDe(state, c);
      if (!slugCaminho || !dados?.caminhos?.some((x) => x.slug === slugCaminho) || c.niveis < (dados.caminho_nivel ?? 1)) continue;
      const item = resolverPoder(slugCaminho, c.classeSlug, CompendiumIndex.getAll("poder"), "ability")?.item;
      const doc = item ? await resolveItem(item.id) : null;
      if (doc) caminhosItens.push(doc);
      else console.warn(`${MODULE_ID} | ActorWriter: caminho "${slugCaminho}" não resolveu`);
    }
    if (caminhosItens.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", caminhosItens);
        console.log(`${MODULE_ID} | ActorWriter: ${caminhosItens.length} caminho(s)`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to add caminho:`, err);
      }
    }

    // Linhagem do feiticeiro: no 1º nível ele recebe a herança BÁSICA
    // ("Linhagem Dracônica Básica" no compêndio) — LB cap. 4, Arcanista.
    const arcanista = todasClasses.find((c) => c.classeSlug === "arcanista");
    const classeCaminhoSlug = arcanista ? caminhoDe(state, arcanista) : "";
    if (arcanista && classeCaminhoSlug) {
      const linhagem = respostaSubEscolha(
        arcanista.classeSlug,
        classeCaminhoSlug,
        state.escolhasPorItem,
        "linhagem"
      );
      if (linhagem) {
        const allPoderes = CompendiumIndex.getAll("poder");
        const item = resolverPoder(`linhagem_basica_${linhagem}`, classeSlug, allPoderes, "ability")?.item;
        if (item) {
          const doc = await resolveItem(item.id);
          if (doc) {
            try {
              await actor.createEmbeddedDocuments("Item", [doc]);
              console.log(`${MODULE_ID} | ActorWriter: linhagem "${linhagem}" adicionada`);
            } catch (err) {
              console.warn(`${MODULE_ID} | ActorWriter: falha ao adicionar linhagem:`, err);
            }
          }
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: linhagem "${linhagem}" não achada no compêndio`);
        }
      }
    }

    // Add origem powers + physical initial items
    const origem = state.origemId ? getOrigem(state.origemId) : null;
    if (origem) {
      const allPoderes = CompendiumIndex.getAll("poder");
      const origemItems: unknown[] = [];

      // Benefícios escolhidos: DOIS da lista (perícia e/ou poder). O poder
      // exclusivo é uma das opções, não um brinde automático (LB cap. 2).
      const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [];
      const beneficios = validarBeneficios(origem.id, escolhidos, beneficiosDeOrigemPermitidos(state));
      for (const categoria of beneficios.livres) {
        const itemId = state.escolhasPorItem[`origem_poder_livre_${categoria}`] as
          | string
          | undefined;
        if (!itemId) continue;
        const doc = await resolveItem(itemId);
        if (doc) origemItems.push(doc);
        else console.warn(`${MODULE_ID} | ActorWriter: poder livre "${itemId}" não resolveu`);
      }
      for (const slug of beneficios.poderes) {
        const match = slugsDoPoderDaOrigem(origem.id, slug)
          .map((s) => resolverPoder(s, classeSlug, allPoderes)?.item)
          .find(Boolean);
        if (match) {
          const doc = await resolveItem(match.id);
          if (doc) origemItems.push(doc);
          else console.warn(`${MODULE_ID} | ActorWriter: origem poder "${slug}" resolved null`);
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: origem poder "${slug}" not found`);
        }
      }

      if (origemItems.length > 0) {
        try {
          await actor.createEmbeddedDocuments("Item", origemItems);
          console.log(`${MODULE_ID} | ActorWriter: added ${origemItems.length} origem items`);
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: failed to add origem items:`, err);
        }
      }
    }

    // Add divindade conceded powers
    const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;
    if (divindade?.id === PANTEAO.id) {
      // Sem concedido; a restrição fica registrada como um poder na ficha.
      try {
        await actor.createEmbeddedDocuments("Item", [
          {
            name: "Devoto do Panteão",
            type: "poder",
            img: "icons/svg/holy-symbol.svg",
            system: {
              tipo: "concedido",
              subtipo: "Panteão",
              description: { value: "<p>Cultua o Panteão como um todo (LB p.103). Não recebe poder concedido; não pode usar armas cortantes ou perfurantes.</p>" },
            },
          },
        ]);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: falha no Devoto do Panteão:`, err);
      }
    } else if (divindade) {
      const allPoderes = CompendiumIndex.getAll("poder");
      // O devoto ESCOLHE (1, ou 2 se clérigo/druida/paladino) — não recebe todos.
      const escolhidos = (state.escolhasPorItem["divindade_poderes"] as string[]) ?? [];
      const poderesParaAdd = escolhidos.filter((s) => divindade.poderes_concedidos.includes(s));

      const divItems: unknown[] = [];
      for (const slug of poderesParaAdd) {
        const match = resolverPoder(slug, classeSlug, allPoderes, "concedido")?.item;
        if (match) {
          const doc = await resolveItem(match.id);
          if (doc) divItems.push(doc);
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: divindade poder "${slug}" not found`);
        }
      }

      if (divItems.length > 0) {
        try {
          await actor.createEmbeddedDocuments("Item", divItems);
          console.log(`${MODULE_ID} | ActorWriter: added ${divItems.length} divindade powers`);
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: failed to add divindade powers:`, err);
        }
      }
    }

    // Poder que dá uma magia específica (Manto de Batalha → Vestimenta da Fé,
    // Dedo Verde → Controlar Plantas): a magia vai junto, fora da cota.
    const slugsComMagia = [
      ...slugsDosPoderes(state.poderes),
      ...((state.escolhasPorItem["divindade_poderes"] as string[] | undefined) ?? []),
      ...(origem ? validarBeneficios(origem.id, (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [], beneficiosDeOrigemPermitidos(state)).poderes : []),
    ];
    const magiasDePoder: unknown[] = [];
    const jaTem = new Set(state.magias);
    for (const slug of slugsComMagia) {
      const magiaSlug = magiaPorPoder[slug];
      if (!magiaSlug) continue;
      const magia = CompendiumIndex.getAll("magia").find((m) => toNomeSlug(m.name) === magiaSlug);
      if (!magia || jaTem.has(magia.id)) continue;
      jaTem.add(magia.id);
      const doc = await resolveItem(magia.id);
      if (doc) magiasDePoder.push(doc);
      else console.warn(`${MODULE_ID} | ActorWriter: magia "${magiaSlug}" do poder "${slug}" não resolveu`);
    }
    if (magiasDePoder.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", magiasDePoder);
        console.log(`${MODULE_ID} | ActorWriter: ${magiasDePoder.length} magia(s) de poder`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: falha nas magias de poder:`, err);
      }
    }

    // Escolhas de habilidade racial: itens (poder geral, magia, habilidade de
    // outra raça) e bônus de perícia (+2 da Deformidade do lefou).
    {
      const racaRef = state.racaNome || state.racaId;
      const ids = itensDeEscolhasRaciais(racaRef, state.escolhasPorItem);
      const docs: unknown[] = [];
      for (const id of ids) {
        const doc = await resolveItem(id);
        if (doc) docs.push(doc);
        else console.warn(`${MODULE_ID} | ActorWriter: escolha racial "${id}" não resolveu`);
      }
      if (docs.length > 0) {
        try {
          await actor.createEmbeddedDocuments("Item", docs);
          console.log(`${MODULE_ID} | ActorWriter: ${docs.length} escolha(s) racial(is)`);
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: falha nas escolhas raciais:`, err);
        }
      }

      // Montagem: poderes escolhidos (presentes, bênçãos, chassi…), com a
      // sub-escolha no nome e a magia da sub-escolha como item.
      if (montagem.docs.length > 0) {
        try {
          await actor.createEmbeddedDocuments("Item", montagem.docs);
          console.log(`${MODULE_ID} | ActorWriter: ${montagem.docs.length} item(ns) da montagem da raça`);
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: falha na montagem da raça:`, err);
        }
      }
      // Tamanho vai direto no ator (o item de raça não tem esse campo) — só
      // quando o item da opção não o define por Active Effect.
      if (montagem.tamanho) {
        try {
          await actor.update({ "system.tracos.tamanho": montagem.tamanho });
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: falha ao gravar o tamanho:`, err);
        }
      }

      // Escolha registrada no item que a raça já concedeu: "Fonte Elemental (Fogo)",
      // "Tabu (Diplomacia)" com o –5. Sem isto a escolha ficava só no wizard.
      const anotacoes = [...anotacoesDaMontagem(racaRef, state.escolhasPorItem)];
      for (const escolha of escolhasDaRaca(racaRef)) {
        partesDoPedido(pedidoAtivo(escolha, state.escolhasPorItem)).forEach((pedido, pi) => {
          if (pedido.tipo !== "lista") return;
          const valor = state.escolhasPorItem[`${escolha.chave}_${pi}_0`] as string | undefined;
          const rotulo = pedido.opcoes?.find((o) => o.id === valor)?.rotulo;
          if (rotulo) anotacoes.push({ item: escolha.habilidade, sufixo: rotulo, efeitos: [] });
        });
      }
      for (const a of anotacoes) {
        const itens = (actor as unknown as { items: { find(fn: (i: { name: string }) => boolean): unknown } }).items;
        const alvo = itens.find((i) => i.name === a.item) as
          | { name: string; uuid: string; update(d: Record<string, unknown>): Promise<unknown> }
          | undefined;
        if (!alvo) {
          console.warn(`${MODULE_ID} | ActorWriter: item "${a.item}" não achado na ficha para anotar "${a.sufixo}"`);
          continue;
        }
        try {
          if (a.sufixo) await alvo.update({ name: `${a.item} (${a.sufixo})` });
          // No ATOR, não no item: efeito posto num item que já existe não é
          // transferido (só os que nascem junto do item são).
          if (a.efeitos.length) {
            await actor.createEmbeddedDocuments(
              "ActiveEffect",
              aeDe(`${a.item} (${a.sufixo ?? ""})`, a.efeitos).map((e) => ({ ...e, transfer: false, origin: alvo.uuid }))
            );
          }
        } catch (err) {
          console.warn(`${MODULE_ID} | ActorWriter: falha ao anotar "${a.item}":`, err);
        }
      }

      const bonus = periciasDeEscolhasRaciais(racaRef, state.escolhasPorItem).bonus;
      if (bonus.length > 0) {
        const update: Record<string, unknown> = {};
        for (const b of bonus) {
          const code = toPericiaCode(b.pericia);
          if (code) update[`system.pericias.${code}.outros`] = b.valor;
        }
        if (Object.keys(update).length > 0) {
          try {
            await actor.update(update);
          } catch (err) {
            console.warn(`${MODULE_ID} | ActorWriter: falha no bônus de perícia racial:`, err);
          }
        }
      }
    }

    // Idade & Complicações (HA cap. 4): complicação do compêndio, complicações
    // de idade e a faixa etária viram itens; o que é número na ficha vai como
    // Active Effect (atributos, Defesa, resistências, PM, perícias, deslocamento).
    const itensIdade: unknown[] = [];
    const complicacaoId = complicacaoEscolhida(state);
    if (complicacaoId) {
      const doc = await resolveItem(complicacaoId);
      if (doc) itensIdade.push(doc);
      else console.warn(`${MODULE_ID} | ActorWriter: complicação "${complicacaoId}" não resolveu`);
    }
    const ae = (nome: string, efeitos: Array<{ chave: string; valor: number }>) =>
      efeitos.length
        ? [{ name: nome, transfer: true, changes: efeitos.map((e) => ({ key: e.chave, mode: 2, value: String(e.valor) })) }]
        : [];
    for (const id of complicacoesIdadeEscolhidas(state)) {
      const c = getComplicacaoIdade(id);
      if (!c) continue;
      itensIdade.push({
        name: c.nome,
        type: "poder",
        img: "icons/svg/downgrade.svg",
        system: { tipo: "complicacao", subtipo: "Idade", description: { value: `<p>${c.resumo}</p>` } },
        effects: ae(c.nome, c.efeitos),
      });
    }
    const faixa = faixaDoPersonagem(state);
    if (state.config.idadesVariadas && faixa.id !== FAIXA_PADRAO) {
      // Atributos da faixa já foram para o item de raça (ver acima); aqui só o resto.
      const efeitos = faixa.habilidades.flatMap((h) => h.efeitos);
      const linhas = [
        ...Object.entries(faixa.atributos).map(([a, v]) => `${a.toUpperCase()} ${v > 0 ? "+" : ""}${v} (aplicado na coluna racial da ficha)`),
        ...(faixa.niveisExtras ? [`${faixa.niveisExtras} nível(is) a mais que o grupo`] : []),
        ...(faixa.tamanhoMenor ? ["Tamanho: uma categoria menor"] : []),
        ...faixa.habilidades.map((h) => `<strong>${h.nome}.</strong> ${h.resumo}`),
      ];
      itensIdade.push({
        name: `Faixa etária: ${faixa.nome}`,
        type: "poder",
        img: "icons/svg/clockwork.svg",
        system: { tipo: "geral", subtipo: "Idade", description: { value: linhas.map((l) => `<p>${l}</p>`).join("") } },
        effects: ae(`Faixa etária: ${faixa.nome}`, efeitos),
      });
    }
    // Marca da distinção (HA p.104): "recebida automaticamente quando o personagem conquista a distinção".
    const distincao = distincaoEscolhida(state);
    if (distincao?.marca) {
      const doc = await resolveItem(distincao.marca.id);
      if (doc) itensIdade.push(doc);
      else console.warn(`${MODULE_ID} | ActorWriter: marca da distinção "${distincao.nome}" não resolveu`);
    }
    if (itensIdade.length > 0) {
      try {
        await actor.createEmbeddedDocuments("Item", itensIdade);
        console.log(`${MODULE_ID} | ActorWriter: ${itensIdade.length} item(ns) de idade/complicação`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: falha em idade/complicações:`, err);
      }
    }

    const sentidos = sentidosDosItens([...((actor as unknown as { items: Iterable<never> }).items ?? [])]);
    if (sentidos.length > 0) {
      try {
        // Aninhado, não por caminho: `sentidos.value` é um SetField e o update
        // com "system.attributes.sentidos.value" não grava nada (some em silêncio).
        await actor.update({ system: { attributes: { sentidos: { value: sentidos } } } } as never);
        console.log(`${MODULE_ID} | ActorWriter: sentidos ${sentidos.join(", ")}`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: falha nos sentidos:`, err);
      }
    }

    // Set trained perícias after full actor initialization (system schema = correct attributes)
    const trainedCodes = getTrainedPericaCodes(state);
    // "oficio" não tem code: vira a perícia fixa escolhida (alfa, arme…) ou uma própria (ofi1).
    const oficio = getTrainedPericaSlugs(state).includes("oficio") ? periciaDoOficio(state.escolhasPorItem) : null;
    if (Object.keys(trainedCodes).length > 0 || oficio) {
      const pericasUpdate: Record<string, unknown> = {};
      for (const code of Object.keys(trainedCodes)) {
        // Só `treinado` bastaria no Foundry (o resto já existe), mas no site a
        // ficha nasce vazia: sem atributo a perícia chega na importação com
        // Força. `label` fica VAZIO — perícia padrão mostra o nome pelo código,
        // e escrever "T20.SkillAtle" faz a ficha exibir a chave crua.
        const info = periciasSistema[code];
        pericasUpdate[`system.pericias.${code}.treinado`] = true;
        if (info) {
          pericasUpdate[`system.pericias.${code}.atributo`] = info.atributo;
          pericasUpdate[`system.pericias.${code}.st`] = info.st;
          pericasUpdate[`system.pericias.${code}.pda`] = info.pda;
          pericasUpdate[`system.pericias.${code}.size`] = info.size;
          pericasUpdate[`system.pericias.${code}.custom`] = false;
          pericasUpdate[`system.pericias.${code}.label`] = "";
        }
      }
      if (oficio && "code" in oficio) pericasUpdate[`system.pericias.${oficio.code}.treinado`] = true;
      else if (oficio) pericasUpdate[`system.pericias.${oficio.key}`] = oficio.dados;
      try {
        await actor.update(pericasUpdate);
        console.log(`${MODULE_ID} | ActorWriter: trained ${Object.keys(trainedCodes).length} perícias`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to update pericias:`, err);
      }
    }

    await aplicarSubEscolhasDePoder(actor, state);
    await marcarNiveisDosPoderes(actor, state);

    actor.sheet?.render(true);
    console.log(`${MODULE_ID} | ActorWriter: created actor "${actor.name}" (${actor.id})`);

    // Aviso na mesa: quem criou, o quê. Link do ator para o mestre abrir.
    try {
      const classes = classesDoPersonagem(state)
        .map((c) => `${c.classeNome}${classesDoPersonagem(state).length > 1 ? ` ${c.niveis}` : ""}`)
        .join(" / ");
      const linha = [state.racaNome, classes, `nível ${state.nivel}`].filter(Boolean).join(" · ");
      await (globalThis as any).ChatMessage.create({
        content: `<p><strong>Ficha criada:</strong> @UUID[Actor.${actor.id}]{${actor.name}}<br/><small>${linha}</small></p>`,
        speaker: { alias: "Criador de Ficha" },
      });
    } catch (err) {
      console.warn(`${MODULE_ID} | ActorWriter: sem mensagem no chat:`, err);
    }
  }
}
