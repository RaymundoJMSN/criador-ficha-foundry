/**
 * "Foundry de mentira" para o site: dá ao módulo exatamente o que ele usa do
 * Foundry — e nada mais. Assim o mesmo `src/` (regras, passos, template, writer)
 * roda no navegador sem cópia: o que muda no módulo muda no site.
 *
 *  - `game.packs`  → despejo dos compêndios (`data/compendio.json`)
 *  - `Actor.create` → ator em memória; no fim vira o JSON de importação
 *  - `game.settings` / `game.user` flags → localStorage
 *  - `ApplicationV2` + `HandlebarsApplicationMixin` → Handlebars no navegador
 *  - `DialogV2.confirm`, `ui.notifications`, `fromUuid`, `ChatMessage`, `Hooks`
 */
import Handlebars from "handlebars/dist/handlebars.min.js";

type Dict = Record<string, unknown>;

export interface PackDump {
  collection: string;
  documentName: string;
  folders: Array<{ _id: string; name: string; folder: string | null }>;
  items: Dict[];
}

export interface ShimOpcoes {
  /** URL base (com barra no fim) de onde vêm templates, CSS, lang e dados. */
  base: string;
  dados: { packs: PackDump[] };
  lang: Record<string, string>;
  /** Chamado quando o writer termina (o módulo faz `actor.sheet.render(true)`). */
  onFichaPronta(actor: ActorShim): void;
  /** Abre o "item do compêndio" (botão 📖). */
  onAbrirItem(doc: Dict): void;
  /** O wizard gravou (valor) ou apagou (null) o rascunho — o site espelha no servidor. */
  onRascunho?(valor: { estado?: string; passo?: string } | null): void;
  /** Responder "sim" ao próximo DialogV2.confirm (retomar personagem aberto pelo painel). */
  autoConfirmar?: boolean;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const novoId = (): string => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

function setPath(obj: Dict, path: string, valor: unknown): void {
  const partes = path.split(".");
  let atual: Dict = obj;
  for (const p of partes.slice(0, -1)) {
    if (typeof atual[p] !== "object" || atual[p] === null) atual[p] = {};
    atual = atual[p] as Dict;
  }
  atual[partes[partes.length - 1]!] = valor;
}
function aplicarUpdate(obj: Dict, data: Dict): void {
  for (const [k, v] of Object.entries(data)) {
    if (k.includes(".")) setPath(obj, k, v);
    else if (v && typeof v === "object" && !Array.isArray(v) && typeof obj[k] === "object" && obj[k]) {
      aplicarUpdate(obj[k] as Dict, v as Dict);
    } else obj[k] = v;
  }
}
const semHtml = (h: string): string => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* ── Compêndios ─────────────────────────────────────────────────────────── */

class Lista<T> extends Array<T> {
  get contents(): T[] {
    return [...this];
  }
}

class DocShim {
  constructor(
    public readonly dados: Dict,
    public readonly pack: PackShim
  ) {}
  get id(): string {
    return String(this.dados["_id"]);
  }
  get name(): string {
    return String(this.dados["name"]);
  }
  get uuid(): string {
    return `Compendium.${this.pack.collection}.Item.${this.id}`;
  }
  get sheet(): { render(force: boolean): void } {
    return { render: () => opcoes.onAbrirItem(this.dados) };
  }
  toObject(): Dict {
    return clone(this.dados);
  }
}

class PackShim {
  readonly documentName = "Item";
  readonly index: Lista<Dict>;
  readonly folders: { get(id: string): { name: string; folder: { id: string } | null } | undefined };
  readonly #porId: Map<string, Dict>;
  constructor(readonly dump: PackDump) {
    this.#porId = new Map(dump.items.map((i) => [String(i["_id"]), i]));
    this.index = new Lista(...dump.items.map((i) => ({ _id: i["_id"], name: i["name"], img: i["img"], type: i["type"], folder: i["folder"], uuid: `Compendium.${dump.collection}.Item.${i["_id"]}` })));
    const pastas = new Map(dump.folders.map((f) => [f._id, f]));
    this.folders = {
      get: (id) => {
        const f = pastas.get(id);
        return f ? { name: f.name, folder: f.folder ? { id: f.folder } : null } : undefined;
      },
    };
  }
  get collection(): string {
    return this.dump.collection;
  }
  get metadata(): { label: string } {
    return { label: this.dump.collection.split(".").pop() ?? "" };
  }
  /** Como o `getIndex({fields})` do Foundry: devolve os campos pedidos (aqui, o doc inteiro basta). */
  async getIndex(): Promise<Lista<Dict>> {
    return new Lista(...this.dump.items.map((i) => ({ ...i, uuid: `Compendium.${this.dump.collection}.Item.${i["_id"]}` })));
  }
  async getDocument(id: string): Promise<DocShim | null> {
    const d = this.#porId.get(id);
    return d ? new DocShim(d, this) : null;
  }
  docPorId(id: string): DocShim | null {
    const d = this.#porId.get(id);
    return d ? new DocShim(d, this) : null;
  }
}

/* ── Ator em memória ────────────────────────────────────────────────────── */

class ItemShim {
  constructor(
    public dados: Dict,
    private readonly ator: ActorShim
  ) {}
  get id(): string {
    return String(this.dados["_id"]);
  }
  get name(): string {
    return String(this.dados["name"]);
  }
  get type(): string {
    return String(this.dados["type"]);
  }
  get system(): Dict {
    return (this.dados["system"] ??= {}) as Dict;
  }
  get flags(): Dict {
    return (this.dados["flags"] ??= {}) as Dict;
  }
  get effects(): Dict[] {
    return (this.dados["effects"] ??= []) as Dict[];
  }
  get uuid(): string {
    return `Actor.${this.ator.id}.Item.${this.id}`;
  }
  getFlag(scope: string, key: string): unknown {
    return ((this.flags[scope] as Dict | undefined) ?? {})[key];
  }
  async update(data: Dict): Promise<this> {
    aplicarUpdate(this.dados, data);
    return this;
  }
  toObject(): Dict {
    return clone(this.dados);
  }
}

class Itens extends Lista<ItemShim> {
  getName(nome: string): ItemShim | undefined {
    return this.find((i) => i.name === nome);
  }
  get(id: string): ItemShim | undefined {
    return this.find((i) => i.id === id);
  }
}

export class ActorShim {
  readonly id = novoId();
  readonly dados: Dict;
  readonly items = new Itens();
  readonly sheet: { render(force: boolean): void };
  constructor(data: Dict, private readonly aoFinalizar: (a: ActorShim) => void) {
    const { items, effects, ...resto } = data;
    this.dados = clone({ ...resto, _id: this.id, effects: [] });
    this.sheet = { render: () => this.aoFinalizar(this) };
    void this.createEmbeddedDocuments("Item", (items as Dict[] | undefined) ?? []);
    for (const e of (effects as Dict[] | undefined) ?? []) this.effects.push({ ...clone(e), _id: novoId() });
  }
  get name(): string {
    return String(this.dados["name"]);
  }
  get uuid(): string {
    return `Actor.${this.id}`;
  }
  get system(): Dict {
    return (this.dados["system"] ??= {}) as Dict;
  }
  get effects(): Dict[] {
    return (this.dados["effects"] ??= []) as Dict[];
  }
  /** O sistema deriva o nível da soma dos itens de classe. */
  get nivel(): number {
    return this.items.filter((i) => i.type === "classe").reduce((n, i) => n + Number(i.system["niveis"] ?? 0), 0);
  }
  async createEmbeddedDocuments(tipo: string, docs: Dict[]): Promise<unknown[]> {
    const criados: unknown[] = [];
    if (tipo === "ActiveEffect") {
      for (const e of docs) {
        const novo = { ...clone(e), _id: novoId() };
        this.effects.push(novo);
        criados.push(novo);
      }
      return criados;
    }
    for (const d of docs) {
      const doc = clone(d);
      doc["_id"] = novoId();
      // Efeito transferível do item vale para o ator (o Foundry faz isso ao carregar).
      const item = new ItemShim(doc, this);
      this.items.push(item);
      criados.push(item);
      if (item.type === "race") await this.#aplicarRaca(item);
    }
    return criados;
  }
  /** O que o hook `_onCreateOwnedRace` do sistema faz: atributos raciais e poderes concedidos. */
  async #aplicarRaca(raca: ItemShim): Promise<void> {
    const atributos = (raca.system["atributos"] as Record<string, number> | undefined) ?? {};
    for (const [k, v] of Object.entries(atributos)) setPath(this.system, `atributos.${k}.racial`, Number(v) || 0);
    const grants = (raca.system["grants"] as Array<{ choices?: Array<{ uuid?: string }> }> | undefined) ?? [];
    const concedidos: Dict[] = [];
    for (const g of grants) {
      for (const c of g.choices ?? []) {
        const doc = await fromUuidShim(String(c.uuid ?? ""));
        if (doc) concedidos.push(doc.toObject());
      }
    }
    if (concedidos.length) await this.createEmbeddedDocuments("Item", concedidos);
  }
  async update(data: Dict): Promise<this> {
    aplicarUpdate(this.dados, data);
    return this;
  }
  async updateEmbeddedDocuments(tipo: string, updates: Dict[]): Promise<void> {
    if (tipo !== "Item") return;
    for (const u of updates) {
      const item = this.items.get(String(u["_id"]));
      if (!item) continue;
      const { _id, ...resto } = u;
      void _id;
      aplicarUpdate(item.dados, resto);
    }
  }
  /** JSON que o Foundry importa (menu do ator → Importar dados, ou o botão do módulo). */
  toObject(): Dict {
    return { ...clone(this.dados), items: this.items.map((i) => i.toObject()) };
  }
}

/* ── Aplicações (ApplicationV2 + Handlebars) ────────────────────────────── */

// Helpers que o Foundry registra e os templates usam em subexpressão ({{#if (gt a b)}}).
const H = Handlebars as unknown as { registerHelper(nome: string, fn: (...a: unknown[]) => unknown): void };
H.registerHelper("eq", (a, b) => a === b);
H.registerHelper("ne", (a, b) => a !== b);
H.registerHelper("gt", (a, b) => Number(a) > Number(b));
H.registerHelper("gte", (a, b) => Number(a) >= Number(b));
H.registerHelper("lt", (a, b) => Number(a) < Number(b));
H.registerHelper("lte", (a, b) => Number(a) <= Number(b));
H.registerHelper("not", (a) => !a);
H.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
H.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
H.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
H.registerHelper("localize", (k) => opcoes?.lang[String(k)] ?? String(k));

const templatesCompilados = new Map<string, HandlebarsTemplateDelegate>();
async function template(caminho: string): Promise<HandlebarsTemplateDelegate> {
  let t = templatesCompilados.get(caminho);
  if (!t) {
    const r = await fetch(new URL(caminho, opcoes.base));
    if (!r.ok) throw new Error(`template ${caminho}: ${r.status}`);
    t = Handlebars.compile(await r.text());
    templatesCompilados.set(caminho, t);
  }
  return t;
}

class ApplicationV2 {
  static DEFAULT_OPTIONS: Dict = {};
  static PARTS: Record<string, { template: string; scrollable?: string[] }> = {};
  options: Dict;
  element: HTMLElement;
  rendered = false;
  constructor(options: Dict = {}) {
    const padrao = (this.constructor as typeof ApplicationV2).DEFAULT_OPTIONS;
    this.options = { ...padrao, ...options, window: { ...(padrao["window"] as Dict), ...((options["window"] as Dict) ?? {}) } };
    this.element = document.createElement("div");
    this.element.className = "application t20w-site-app";
    this.element.id = String(this.options["id"] ?? "");
  }
  get id(): string {
    return String(this.options["id"] ?? "");
  }
  get title(): string {
    return String((this.options["window"] as Dict | undefined)?.["title"] ?? "");
  }
  get position(): Dict {
    return {};
  }
  setPosition(): void {}
  async _prepareContext(_o: unknown): Promise<unknown> {
    return {};
  }
  async _onRender(_c: unknown, _o: unknown): Promise<void> {}
  async _renderHTML(_ctx: unknown): Promise<void> {}
  async _onClickAction(_e: MouseEvent, _t: HTMLElement): Promise<void> {}
  #cliques = false;
  async render(_force?: unknown): Promise<this> {
    const ctx = await this._prepareContext({});
    await this._renderHTML(ctx);
    this.rendered = true;
    aplicacoes.set(this.id, this);
    // Como no Foundry: clique em [data-action] vai para _onClickAction(event, target).
    if (!this.#cliques) {
      this.#cliques = true;
      this.element.addEventListener("click", (e) => {
        const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
        if (alvo && this.element.contains(alvo)) void this._onClickAction(e, alvo);
      });
    }
    await this._onRender(ctx, {});
    return this;
  }
  async close(): Promise<void> {
    this.element.remove();
    this.rendered = false;
    aplicacoes.delete(this.id);
  }
}

function HandlebarsApplicationMixin<T extends typeof ApplicationV2>(Base: T): T {
  return class extends Base {
    async _renderHTML(ctx: unknown): Promise<void> {
      const parts = (this.constructor as typeof ApplicationV2).PARTS;
      const rolos = new Map<string, number>();
      for (const p of Object.values(parts)) {
        for (const sel of p.scrollable ?? []) {
          this.element.querySelectorAll<HTMLElement>(sel).forEach((el, i) => rolos.set(`${sel}#${i}`, el.scrollTop));
        }
      }
      let html = "";
      for (const p of Object.values(parts)) html += (await template(p.template))(ctx);
      let content = this.element.querySelector<HTMLElement>(".window-content");
      if (!content) {
        const header = document.createElement("header");
        header.className = "window-header";
        header.innerHTML = `<h1 class="window-title"></h1><button type="button" class="header-control fa-solid fa-xmark" data-action="close" title="Fechar">✕</button>`;
        header.querySelector("button")!.addEventListener("click", () => void this.close());
        content = document.createElement("div");
        content.className = "window-content";
        this.element.append(header, content);
      }
      this.element.querySelector(".window-title")!.textContent = this.title;
      content.innerHTML = html;
      if (!this.element.isConnected) document.getElementById("t20w-site-app")!.appendChild(this.element);
      for (const p of Object.values(parts)) {
        for (const sel of p.scrollable ?? []) {
          this.element.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
            const v = rolos.get(`${sel}#${i}`);
            if (v) el.scrollTop = v;
          });
        }
      }
    }
  };
}

const aplicacoes = new Map<string, ApplicationV2>();

/* ── Hooks, settings, user, notificações ────────────────────────────────── */

const hooks = new Map<string, Array<(...a: unknown[]) => unknown>>();
const Hooks = {
  on(nome: string, fn: (...a: unknown[]) => unknown): void {
    hooks.set(nome, [...(hooks.get(nome) ?? []), fn]);
  },
  once(nome: string, fn: (...a: unknown[]) => unknown): void {
    Hooks.on(nome, fn);
  },
  async call(nome: string, ...args: unknown[]): Promise<void> {
    for (const fn of hooks.get(nome) ?? []) await fn(...args);
  },
};

const settingsPadrao = new Map<string, unknown>();
const chaveLS = (ns: string, k: string): string => `t20w-site.${ns}.${k}`;
const settings = {
  register(ns: string, key: string, cfg: { default?: unknown }): void {
    settingsPadrao.set(`${ns}.${key}`, cfg.default);
  },
  registerMenu(): void {},
  get(ns: string, key: string): unknown {
    try {
      const v = localStorage.getItem(chaveLS(ns, key));
      if (v !== null) return JSON.parse(v);
    } catch {
      /* sem storage */
    }
    return settingsPadrao.has(`${ns}.${key}`) ? settingsPadrao.get(`${ns}.${key}`) : false;
  },
  async set(ns: string, key: string, valor: unknown): Promise<void> {
    try {
      localStorage.setItem(chaveLS(ns, key), JSON.stringify(valor));
    } catch {
      /* sem storage */
    }
  },
};

const user = {
  id: "site",
  name: "Jogador",
  isGM: true,
  can: () => true,
  getFlag(scope: string, key: string): unknown {
    try {
      const v = localStorage.getItem(chaveLS(`flag.${scope}`, key));
      return v === null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  },
  async setFlag(scope: string, key: string, valor: unknown): Promise<void> {
    try {
      localStorage.setItem(chaveLS(`flag.${scope}`, key), JSON.stringify(valor));
    } catch {
      /* sem storage */
    }
    if (key === "rascunho") opcoes.onRascunho?.(valor as { estado?: string; passo?: string });
  },
  async unsetFlag(scope: string, key: string): Promise<void> {
    localStorage.removeItem(chaveLS(`flag.${scope}`, key));
    if (key === "rascunho") opcoes.onRascunho?.(null);
  },
};

export function toast(texto: string, tipo: "info" | "warn" | "error" = "info"): void {
  const el = document.createElement("div");
  el.className = `t20w-toast t20w-toast-${tipo}`;
  el.textContent = texto;
  document.getElementById("t20w-toasts")?.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

let packs: Lista<PackShim>;
let opcoes: ShimOpcoes;

async function fromUuidShim(uuid: string): Promise<DocShim | null> {
  const m = /^Compendium\.(.+)\.Item\.([A-Za-z0-9]+)$/.exec(uuid);
  if (!m) return null;
  const pack = packs.find((p) => p.collection === m[1]) ?? packs.find((p) => p.collection.endsWith(`.${m[1]!.split(".").pop()}`));
  return pack?.docPorId(m[2]!) ?? null;
}

/** Instala os globais e devolve o que o site precisa para fechar o ciclo. */
export function instalarShim(o: ShimOpcoes): void {
  opcoes = o;
  packs = new Lista(...o.dados.packs.map((p) => new PackShim(p)));
  const packsColecao = Object.assign(packs, { get: (c: string) => packs.find((p) => p.collection === c) });

  const g = globalThis as unknown as Dict;
  g["Hooks"] = Hooks;
  g["game"] = {
    ready: true,
    user,
    settings,
    packs: packsColecao,
    i18n: { localize: (k: string) => o.lang[k] ?? k },
    modules: { get: () => undefined },
    actors: { getName: () => undefined, contents: [] as unknown[] },
    world: { title: "Criador de Ficha" },
  };
  g["foundry"] = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin,
        DialogV2: {
          async confirm(cfg: { content?: string }): Promise<boolean> {
            if (opcoes.autoConfirmar) {
              opcoes.autoConfirmar = false;
              return true;
            }
            return window.confirm(semHtml(cfg.content ?? "Confirmar?"));
          },
        },
      },
    },
  };
  g["ui"] = {
    notifications: {
      info: (t: string) => toast(t, "info"),
      warn: (t: string) => toast(t, "warn"),
      error: (t: string) => toast(t, "error"),
    },
  };
  g["Actor"] = { create: async (data: Dict) => new ActorShim(data, o.onFichaPronta) };
  g["ChatMessage"] = { create: async () => undefined };
  g["fromUuid"] = fromUuidShim;
  // Para depuração/teste no navegador: as aplicações abertas.
  g["t20wSite"] = { aplicacoes };
}

const MODULE_ID = "t20-ficha-wizard";
/** Rascunho do wizard (a flag que `restaurarRascunho` lê ao abrir). */
export function gravarRascunho(valor: { estado: string; passo?: string }): void {
  localStorage.setItem(chaveLS(`flag.${MODULE_ID}`, "rascunho"), JSON.stringify(valor));
}
export function limparRascunho(): void {
  localStorage.removeItem(chaveLS(`flag.${MODULE_ID}`, "rascunho"));
}

export { Hooks as HooksShim, aplicacoes };
