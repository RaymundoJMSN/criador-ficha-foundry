import { ITEM_TYPES, type ItemType } from "../constants.js";
import type { AnyIndexed, TypeToIndexed } from "./types.js";

const RELEVANT_TYPES = new Set<string>(Object.values(ITEM_TYPES));

/** Fields requested from getIndex — avoids loading full documents. */
const INDEX_FIELDS = [
  "system.tipo",
  "system.subtipo",
  "system.descricao",
  "system.circulo",
  "system.escola",
  "system.atributos",
  "system.pericias",
  "system.pvPorNivel",
  "system.pmPorNivel",
  "system.niveis",
  "system.preco",
  "system.peso",
  // Raça: texto, tamanho, deslocamento e os poderes que o item concede.
  "system.description",
  "system.tamanho",
  "system.movement",
  "system.grants",
  "system.atributosDinamicos",
];

class CompendiumIndexClass {
  private _store = new Map<ItemType, AnyIndexed[]>();
  private _built = false;

  async build(): Promise<void> {
    this._store.clear();
    this._built = false;

    // game.packs is a Collection<CompendiumCollection> at runtime
    // @ts-expect-error fvtt-types game.packs typing incomplete for v13
    const packs = game.packs as Collection<CompendiumCollection<Item>>;

    for (const pack of packs) {
      // @ts-expect-error fvtt-types documentName typed as document type not string in v13
      if (pack.documentName !== "Item") continue;

      const index: Collection<Record<string, unknown>> = await pack.getIndex({
        fields: INDEX_FIELDS,
      });

      for (const entry of index) {
        const type = entry["type"] as string | undefined;
        if (!type || !RELEVANT_TYPES.has(type)) continue;

        const itemType = type as ItemType;
        if (!this._store.has(itemType)) this._store.set(itemType, []);

        this._store.get(itemType)!.push({
          id: entry["_id"] as string,
          name: entry["name"] as string,
          img: (entry["img"] as string) ?? "",
          packId: pack.collection,
          type: itemType,
          system: (entry["system"] as Record<string, unknown>) ?? {},
        } as AnyIndexed);
      }
    }

    this._built = true;
  }

  getAll<T extends ItemType>(type: T): TypeToIndexed[T][] {
    return (this._store.get(type) ?? []) as TypeToIndexed[T][];
  }

  getById<T extends ItemType>(type: T, id: string): TypeToIndexed[T] | undefined {
    return this.getAll(type).find((x) => x.id === id);
  }

  async rebuild(): Promise<void> {
    await this.build();
  }

  get isBuilt(): boolean {
    return this._built;
  }

  /** Total indexed item count across all types. */
  get totalCount(): number {
    let n = 0;
    for (const arr of this._store.values()) n += arr.length;
    return n;
  }
}

export const CompendiumIndex = new CompendiumIndexClass();
