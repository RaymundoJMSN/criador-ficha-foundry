import { MODULE_ID } from "../constants.js";
import { mapStateToActorData, getTrainedPericaCodes } from "./mapper.js";
import type { WizardState } from "../wizard/state.js";
import { CompendiumIndex } from "../compendium/index.js";
import { toNomeSlug } from "../compendium/slug.js";
import { getClasse, respostaSubEscolha } from "../rules/classe.js";
import { habilidadesAte } from "../rules/progressao.js";
import { resolverPoder } from "../compendium/resolver.js";
import { getOrigem, validarBeneficios } from "../rules/origem.js";
import { getDivindade } from "../rules/divindade.js";

/**
 * Resolves a compendium item id to its full document object.
 * Returns null if the pack or document is not found.
 */
async function resolveItem(itemId: string): Promise<unknown | null> {
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
      ...state.equipamento.map((e) => e.itemId),
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

    // NOTE: pericias excluded from Actor.create data — applied via update() after init
    const data = mapStateToActorData(state, otherItems);

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
      try {
        await actor.createEmbeddedDocuments("Item", [raceItemData]);
        console.log(`${MODULE_ID} | ActorWriter: race item added via createEmbeddedDocuments (hooks fired)`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to add race item separately:`, err);
      }
    }

    // Add classe item separately — fires tormenta20 onCreate hooks for PV/PM setup
    if (classeItemData) {
      try {
        await actor.createEmbeddedDocuments("Item", [classeItemData]);
        console.log(`${MODULE_ID} | ActorWriter: classe item added via createEmbeddedDocuments`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to add classe item:`, err);
      }
    }

    // Auto-grant class habilidades up to the character's level. An upgrade entry
    // (ataque_especial_8) has no item of its own — fall back to the family's base slug.
    const classeSlug = toNomeSlug(state.classeNome ?? "");
    const classeData = getClasse(classeSlug);
    const habilidadeSlugs = habilidadesAte(state.classeNome || state.classeId, state.nivel);
    if (classeData && habilidadeSlugs.length > 0) {
      const allPoderes = CompendiumIndex.getAll("poder");
      const habItems: unknown[] = [];
      for (const slug of habilidadeSlugs) {
        const match = resolverPoder(slug, classeSlug, allPoderes, "ability")?.item;
        if (match) {
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

    // Add chosen caminho (if class has caminhos)
    const classeCaminhoSlug = state.escolhasPorItem["classe_caminho"] as string | undefined;
    if (classeCaminhoSlug && classeData?.caminhos?.some((c) => c.slug === classeCaminhoSlug)) {
      const allPoderes = CompendiumIndex.getAll("poder");
      const caminhoItem = resolverPoder(classeCaminhoSlug, classeSlug, allPoderes, "ability")?.item;
      if (caminhoItem) {
        const doc = await resolveItem(caminhoItem.id);
        if (doc) {
          try {
            await actor.createEmbeddedDocuments("Item", [doc]);
            console.log(`${MODULE_ID} | ActorWriter: caminho "${classeCaminhoSlug}" added`);
          } catch (err) {
            console.warn(`${MODULE_ID} | ActorWriter: failed to add caminho:`, err);
          }
        }
      }
    }

    // Linhagem do feiticeiro: no 1º nível ele recebe a herança BÁSICA
    // ("Linhagem Dracônica Básica" no compêndio) — LB cap. 4, Arcanista.
    if (classeCaminhoSlug) {
      const linhagem = respostaSubEscolha(
        classeSlug,
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
      const allEquip = [
        ...CompendiumIndex.getAll("equipamento"),
        ...CompendiumIndex.getAll("arma"),
        ...CompendiumIndex.getAll("consumivel"),
      ];
      const origemItems: unknown[] = [];

      // Benefícios escolhidos: DOIS da lista (perícia e/ou poder). O poder
      // exclusivo é uma das opções, não um brinde automático (LB cap. 2).
      const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [];
      for (const slug of validarBeneficios(origem.id, escolhidos).poderes) {
        const match = resolverPoder(slug, classeSlug, allPoderes)?.item;
        if (match) {
          const doc = await resolveItem(match.id);
          if (doc) origemItems.push(doc);
          else console.warn(`${MODULE_ID} | ActorWriter: origem poder "${slug}" resolved null`);
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: origem poder "${slug}" not found`);
        }
      }

      // Physical initial items from origem (look up by name in compendium)
      for (const it of origem.itens_iniciais ?? []) {
        if (!it.item?.trim()) continue;
        const itemName = it.item.trim();
        const match = allEquip.find(e => e.name.toLowerCase() === itemName.toLowerCase());
        if (match) {
          const doc = await resolveItem(match.id);
          if (doc) origemItems.push(doc);
        } else {
          console.warn(`${MODULE_ID} | ActorWriter: origem item "${itemName}" not found in compendium`);
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
    const DIVINE_CLASSES_LOCAL = new Set(["clerigo", "paladino", "druida"]);
    const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;
    if (divindade) {
      const allPoderes = CompendiumIndex.getAll("poder");
      const isDivineClass = DIVINE_CLASSES_LOCAL.has(toNomeSlug(state.classeNome ?? ""));

      // Divine classes get all conceded powers; others get only the chosen one
      const poderesParaAdd: string[] = isDivineClass
        ? divindade.poderes_concedidos
        : [(state.escolhasPorItem["divindade_poder"] as string | undefined)].filter(
            (s): s is string => !!s
          );

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

    // Set trained perícias after full actor initialization (system schema = correct attributes)
    const trainedCodes = getTrainedPericaCodes(state);
    if (Object.keys(trainedCodes).length > 0) {
      const pericasUpdate: Record<string, unknown> = {};
      for (const code of Object.keys(trainedCodes)) {
        pericasUpdate[`system.pericias.${code}.treinado`] = true;
      }
      try {
        await actor.update(pericasUpdate);
        console.log(`${MODULE_ID} | ActorWriter: trained ${Object.keys(trainedCodes).length} perícias`);
      } catch (err) {
        console.warn(`${MODULE_ID} | ActorWriter: failed to update pericias:`, err);
      }
    }

    actor.sheet?.render(true);
    console.log(`${MODULE_ID} | ActorWriter: created actor "${actor.name}" (${actor.id})`);
  }
}
