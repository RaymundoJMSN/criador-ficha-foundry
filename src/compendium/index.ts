import { ITEM_TYPES, type ItemType } from "../constants.js";
import type { AnyIndexed, TypeToIndexed } from "./types.js";

const RELEVANT_TYPES = new Set<string>(Object.values(ITEM_TYPES));

/** Fields requested from getIndex — avoids loading full documents. */
const INDEX_FIELDS = [
  "system.tipo",
  "system.subtipo",
  "system.description",
  "system.circulo",
  "system.escola",
  "system.atributos",
  "system.pericias",
  "system.pvPorNivel",
  "system.pmPorNivel",
  "system.niveis",
  "system.preco",
  "system.peso",
  // Arma: categoria de proficiência e alcance (kit inicial e "arma simples" da origem).
  "system.proficiencia",
  "system.alcance",
  // Raça: texto, tamanho, deslocamento e os poderes que o item concede.
  "system.description",
  "system.tamanho",
  "system.movement",
  "system.grants",
  "system.atributosDinamicos",
];

/**
 * Entidades HTML do compêndio. Apagá-las comia letra acentuada no meio da
 * palavra — "Voc&ecirc; &eacute; uma criatura" virava "Voc uma criatura".
 */
const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  ordm: "º",
  ordf: "ª",
  deg: "°",
  times: "×",
  frac12: "½",
};

/** `&ecirc;` → `ê`, `&Aacute;` → `Á`: letra + acento, montados com NFC. */
const ACENTOS: Record<string, string> = {
  acute: "́",
  grave: "̀",
  circ: "̂",
  tilde: "̃",
  uml: "̈",
  cedil: "̧",
  ring: "̊",
};

function decodificar(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (inteiro, nome: string) => {
      const simples = ENTIDADES[nome.toLowerCase()];
      if (simples !== undefined) return simples;
      const m = /^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil|ring)$/.exec(nome);
      if (m) return (m[1] + ACENTOS[m[2]!]).normalize("NFC");
      return inteiro;
    });
}

/** Texto puro a partir do HTML do compêndio. */
function semHtml(html: string): string {
  return decodificar(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

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

        const system = (entry["system"] as Record<string, unknown>) ?? {};
        // O sistema guarda o texto em `system.description.value`, com HTML.
        // O código lia `system.descricao`, que NÃO existe — por isso nenhuma
        // descrição aparecia em lugar nenhum do wizard.
        const bruto = (system["description"] as { value?: string } | undefined)?.value ?? "";
        this._store.get(itemType)!.push({
          id: entry["_id"] as string,
          name: entry["name"] as string,
          img: (entry["img"] as string) ?? "",
          packId: pack.collection,
          type: itemType,
          system: { ...system, descricao: semHtml(bruto) },
        } as AnyIndexed);
      }
    }

    this._built = true;
  }

  getAll<T extends ItemType>(type: T): TypeToIndexed[T][] {
    return (this._store.get(type) ?? []) as TypeToIndexed[T][];
  }

  /** Tudo que pode ir para a mochila (Mochila e Saco de dormir são `tesouro` no sistema). */
  equipamentos(): TypeToIndexed["equipamento"][] {
    return [
      ...this.getAll("equipamento"),
      ...this.getAll("arma"),
      ...this.getAll("consumivel"),
      ...this.getAll("tesouro"),
    ] as TypeToIndexed["equipamento"][];
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
