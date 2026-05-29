# T20 Ficha Wizard — Plan 1: Foundation + CompendiumIndex

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project scaffolding, CompendiumIndex that indexes all Foundry item packs, and a sidebar button that proves the module loads cleanly in Foundry v13 with `tormenta20`.

**Architecture:** Vite lib-mode bundle outputs `dist/module.js`. `lang/`, `templates/`, `assets/` sit at repo root and are served directly by Foundry via the Windows junction (same pattern as the sibling `t20-pdf-exporter` module). CompendiumIndex is a singleton built on `ready`, uses `pack.getIndex({fields})` to avoid loading full documents, and caches results in a `Map<ItemType, AnyIndexed[]>`. No wizard UI in this plan — just the foundation and proof the index works.

**Tech Stack:** TypeScript strict, Vite 5, vitest 1.x, fvtt-types (pinned to GitHub SHA), prettier 3

---

## File Map

| File                           | Created/Modified | Responsibility                                                                  |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------- |
| `module.json`                  | Create           | Foundry manifest: id, compat v13, requires tormenta20, esmodules, languages     |
| `package.json`                 | Create           | npm scripts + devDeps (vite, ts, fvtt-types pinned, vitest, prettier)           |
| `tsconfig.json`                | Create           | strict, ES2022, fvtt-types, noEmit                                              |
| `vite.config.ts`               | Create           | lib build → dist/module.js                                                      |
| `vitest.config.ts`             | Create           | headless node tests in test/                                                    |
| `.gitignore`                   | Create           | node_modules, dist, .env\*                                                      |
| `.prettierrc.json`             | Create           | consistent formatting                                                           |
| `src/constants.ts`             | Create           | MODULE_ID, SYSTEM_ID, CHARACTER_TYPE, ITEM_TYPES, EXTRA_MODULE_IDS              |
| `src/module.ts`                | Create           | Entry: init hook → registerLauncher; ready hook → CompendiumIndex.build()       |
| `lang/pt-BR.json`              | Create           | All user-facing strings (pt-BR first, always)                                   |
| `src/compendium/types.ts`      | Create           | IndexedRace, IndexedClasse, IndexedPoder, IndexedMagia, IndexedItem, AnyIndexed |
| `src/compendium/slug.ts`       | Create           | toSlug(), namesMatch() — mirrors T20-DB slug scripts                            |
| `src/compendium/index.ts`      | Create           | CompendiumIndex singleton: build(), getAll(), getById(), rebuild()              |
| `src/ui/launcher.ts`           | Create           | Sidebar button registration via renderActorDirectory hook                       |
| `test/compendium/slug.test.ts` | Create           | Vitest unit tests for toSlug/namesMatch                                         |

---

### Task 1: Scaffold + Install

**Files:**

- Create: `module.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.prettierrc.json`

- [ ] **Step 1: Pin fvtt-types commit**

Go to: `https://github.com/League-of-Foundry-Developers/foundry-vtt-types/commits/main`

Copy the full 40-char SHA of the latest commit. Paste it as `<COMMIT_SHA>` in the package.json below. This prevents fvtt-types from auto-updating and breaking types mid-project.

- [ ] **Step 2: Create `module.json`**

```json
{
  "id": "t20-ficha-wizard",
  "title": "T20 Ficha Wizard",
  "description": "Wizard de criação de personagem para Tormenta 20",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "13",
    "verified": "13",
    "maximum": "13"
  },
  "relationships": {
    "requires": [{ "id": "tormenta20", "type": "system" }]
  },
  "esmodules": ["dist/module.js"],
  "languages": [
    {
      "lang": "pt-BR",
      "name": "Português (Brasil)",
      "path": "lang/pt-BR.json"
    }
  ],
  "authors": [{ "name": "RaymundoJMSN", "email": "yuri@lupalina.com.br" }],
  "license": "MIT"
}
```

- [ ] **Step 3: Create `package.json`** (replace `<COMMIT_SHA>` with hash from Step 1)

```json
{
  "name": "t20-ficha-wizard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run"
  },
  "devDependencies": {
    "@league-of-foundry-developers/foundry-vtt-types": "github:League-of-Foundry-Developers/foundry-vtt-types#<COMMIT_SHA>",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@league-of-foundry-developers/foundry-vtt-types"],
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/module.ts"),
      formats: ["es"],
      fileName: () => "module.js",
    },
    outDir: "dist",
    sourcemap: true,
    minify: false,
  },
});
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
.env*
*.local
.claude/
```

- [ ] **Step 8: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 9: Init git repo + create directories**

```bash
git init
mkdir -p lang templates assets test/compendium
```

- [ ] **Step 10: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors. If the fvtt-types SHA 404s, verify the commit exists on the `main` branch and retry.

- [ ] **Step 11: Commit scaffold**

```bash
git add module.json package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .gitignore .prettierrc.json
git commit -m "chore: project scaffold — vite+ts+vitest+fvtt-types"
```

---

### Task 2: Constants + Entry Point

**Files:**

- Create: `src/constants.ts`
- Create: `src/module.ts`

- [ ] **Step 1: Create `src/constants.ts`**

```ts
export const MODULE_ID = "t20-ficha-wizard";
export const SYSTEM_ID = "tormenta20";
export const CHARACTER_TYPE = "character";

export const ITEM_TYPES = {
  RACE: "race",
  CLASSE: "classe",
  PODER: "poder",
  MAGIA: "magia",
  EQUIPAMENTO: "equipamento",
  ARMA: "arma",
  CONSUMIVEL: "consumivel",
  TESOURO: "tesouro",
} as const;

export type ItemType = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];

/**
 * Additional module ids for index prioritization when same-name items exist.
 * Never used as an exclusive filter — all packs are indexed regardless.
 */
export const EXTRA_MODULE_IDS: string[] = [];
```

- [ ] **Step 2: Create `src/module.ts`** (skeleton wires nothing yet)

```ts
import { MODULE_ID } from "./constants.js";

// @ts-expect-error fvtt-types missing Hooks.once overload for "init" in v13
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
});

// @ts-expect-error fvtt-types missing Hooks.once overload for "ready" in v13
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | ready`);
});
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean. If Hooks.once is actually typed for these keys, remove the `@ts-expect-error` lines — they'd fail if the error no longer exists.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: `dist/module.js` created, ~a few KB.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts src/module.ts
git commit -m "feat: constants and entry point skeleton"
```

---

### Task 3: Language File + Placeholder Directories

**Files:**

- Create: `lang/pt-BR.json`

Note: `lang/`, `templates/`, `assets/` live at repo root. Foundry reads them directly via the junction — no build step needed. `templates/` and `assets/` stay empty until Plan 3.

- [ ] **Step 1: Create `lang/pt-BR.json`**

```json
{
  "T20W.Title": "T20 Ficha Wizard",
  "T20W.OpenWizard": "Criar Personagem (Wizard)",
  "T20W.Wizard.Step.Nivel": "Nível & Nome",
  "T20W.Wizard.Step.Atributos": "Atributos",
  "T20W.Wizard.Step.Raca": "Raça",
  "T20W.Wizard.Step.Origem": "Origem",
  "T20W.Wizard.Step.Classe": "Classe",
  "T20W.Wizard.Step.Pericias": "Perícias",
  "T20W.Wizard.Step.Divindade": "Divindade",
  "T20W.Wizard.Step.Poderes": "Poderes",
  "T20W.Wizard.Step.Magias": "Magias",
  "T20W.Wizard.Step.Equipamento": "Equipamento",
  "T20W.Wizard.Step.Revisao": "Revisão",
  "T20W.Index.Building": "T20W: indexando compêndios…",
  "T20W.Index.Done": "T20W: índice pronto ({count} itens)",
  "T20W.Launcher.WIP": "T20W: Wizard em construção…"
}
```

- [ ] **Step 2: Commit**

```bash
git add lang/pt-BR.json
git commit -m "feat: pt-BR language skeleton"
```

---

### Task 4: CompendiumIndex Types

**Files:**

- Create: `src/compendium/types.ts`

- [ ] **Step 1: Create `src/compendium/types.ts`**

```ts
import type { ItemType } from "../constants.js";

export interface IndexedBase {
  id: string;
  name: string;
  img: string;
  packId: string; // e.g. "tormenta20.racas"
  type: ItemType;
}

export interface IndexedRace extends IndexedBase {
  type: "race";
  system: {
    atributos?: Record<string, unknown>;
  };
}

export interface IndexedClasse extends IndexedBase {
  type: "classe";
  system: {
    pvPorNivel?: number;
    pmPorNivel?: number;
    niveis?: unknown;
    pericias?: {
      inatas?: string[];
      escolhas?: string[];
      numero?: number;
      value?: string[];
    };
  };
}

export interface IndexedPoder extends IndexedBase {
  type: "poder";
  system: {
    tipo?: string;
    subtipo?: string;
  };
}

export interface IndexedMagia extends IndexedBase {
  type: "magia";
  system: {
    circulo?: number; // 1–5
    escola?: string; // "abj"|"adv"|"con"|"enc"|"evo"|"ilu"|"nec"|"tra"
    tipo?: string; // "arc" | "div"
  };
}

export interface IndexedEquipamento extends IndexedBase {
  type: "equipamento" | "arma" | "consumivel" | "tesouro";
  system: {
    preco?: number;
    peso?: number;
    tipo?: string;
  };
}

export type AnyIndexed =
  | IndexedRace
  | IndexedClasse
  | IndexedPoder
  | IndexedMagia
  | IndexedEquipamento;

/** Maps ItemType keys to their corresponding IndexedX type. */
export type TypeToIndexed = {
  race: IndexedRace;
  classe: IndexedClasse;
  poder: IndexedPoder;
  magia: IndexedMagia;
  equipamento: IndexedEquipamento;
  arma: IndexedEquipamento;
  consumivel: IndexedEquipamento;
  tesouro: IndexedEquipamento;
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/compendium/types.ts
git commit -m "feat: compendium indexed types"
```

---

### Task 5: Slug Normalization + First Vitest Test

**Files:**

- Create: `src/compendium/slug.ts`
- Create: `test/compendium/slug.test.ts`

The slug normalizer mirrors the T20-DB sync scripts so that prereq IDs (e.g. `"poder-de-batalha"`) from `data/prereqs.json` match item names fetched from Foundry packs (e.g. `"Poder de Batalha"`).

- [ ] **Step 1: Write the failing test first**

Create `test/compendium/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toSlug, namesMatch } from "../../src/compendium/slug.js";

describe("toSlug", () => {
  it("lowercases", () => {
    expect(toSlug("Magia")).toBe("magia");
  });

  it("removes diacritics", () => {
    expect(toSlug("Conjuração")).toBe("conjuracao");
    expect(toSlug("Ação")).toBe("acao");
  });

  it("replaces spaces and special chars with hyphens", () => {
    expect(toSlug("Poder de Batalha")).toBe("poder-de-batalha");
  });

  it("collapses multiple non-alphanum into one hyphen", () => {
    expect(toSlug("Força +2")).toBe("forca-2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(toSlug("  Ataque  ")).toBe("ataque");
  });
});

describe("namesMatch", () => {
  it("matches display name from Foundry pack to slug from T20-DB data", () => {
    expect(namesMatch("Conjuração", "conjuracao")).toBe(true);
    expect(namesMatch("Poder de Batalha", "poder-de-batalha")).toBe(true);
  });

  it("returns false for different names", () => {
    expect(namesMatch("Ataque", "Defesa")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```

Expected: FAIL with `Cannot find module '../../src/compendium/slug.js'`

- [ ] **Step 3: Create `src/compendium/slug.ts`**

```ts
/**
 * Mirrors the slug normalization in T20-DB/scripts/sync_*_foundry.py.
 * Used to match prereq IDs in data/prereqs.json against item names from packs.
 */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanum → hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens
}

export function namesMatch(a: string, b: string): boolean {
  return toSlug(a) === toSlug(b);
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```

Expected:

```
✓ test/compendium/slug.test.ts (7 tests)
Test Files  1 passed
Tests       7 passed
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/compendium/slug.ts test/compendium/slug.test.ts
git commit -m "feat: slug normalization + vitest setup"
```

---

### Task 6: CompendiumIndex Singleton

**Files:**

- Create: `src/compendium/index.ts`

This class uses Foundry APIs (`game.packs`, `pack.getIndex`) so it cannot be unit tested headlessly. Verification happens manually in Foundry (see Task 8).

- [ ] **Step 1: Create `src/compendium/index.ts`**

```ts
import { ITEM_TYPES, type ItemType } from "../constants.js";
import type { AnyIndexed, TypeToIndexed } from "./types.js";

const RELEVANT_TYPES = new Set<string>(Object.values(ITEM_TYPES));

/** Fields requested from getIndex — avoids loading full documents. */
const INDEX_FIELDS = [
  "system.tipo",
  "system.subtipo",
  "system.circulo",
  "system.escola",
  "system.atributos",
  "system.pericias",
  "system.pvPorNivel",
  "system.pmPorNivel",
  "system.niveis",
  "system.preco",
  "system.peso",
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
      if (pack.documentName !== "Item") continue;

      // @ts-expect-error fvtt-types pack.getIndex fields param not typed
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
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean. The two `@ts-expect-error` annotations handle known fvtt-types gaps for v13.

- [ ] **Step 3: Commit**

```bash
git add src/compendium/index.ts
git commit -m "feat: CompendiumIndex singleton"
```

---

### Task 7: Sidebar Launcher Button

**Files:**

- Create: `src/ui/launcher.ts`
- Modify: `src/module.ts`

- [ ] **Step 1: Create `src/ui/launcher.ts`**

```ts
import { MODULE_ID } from "../constants.js";

export function registerLauncher(): void {
  // renderActorDirectory fires each time the Actors tab renders in v13.
  // The button is injected into .header-actions before the default Create button.
  // @ts-expect-error fvtt-types renderActorDirectory callback param types incomplete
  Hooks.on("renderActorDirectory", (_app: unknown, html: HTMLElement) => {
    // Avoid injecting twice on hot-reload
    if (html.querySelector(".t20w-open-wizard")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t20w-open-wizard";
    btn.innerHTML = `<i class="fas fa-hat-wizard"></i> ${game.i18n!.localize("T20W.OpenWizard")}`;
    btn.addEventListener("click", () => {
      ui.notifications!.info(game.i18n!.localize("T20W.Launcher.WIP"));
    });

    const actions = html.querySelector(".header-actions");
    if (actions) {
      actions.prepend(btn);
    } else {
      // Fallback: Foundry may use different structure in future builds
      console.warn(
        `${MODULE_ID} | .header-actions not found in ActorDirectory — cannot inject button`
      );
    }
  });
}
```

- [ ] **Step 2: Update `src/module.ts`** to wire in both the launcher and the index build

```ts
import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registerLauncher } from "./ui/launcher.js";

// @ts-expect-error fvtt-types missing Hooks.once overload for "init" in v13
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerLauncher();
});

// @ts-expect-error fvtt-types missing Hooks.once overload for "ready" in v13
Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | ready — building compendium index`);
  await CompendiumIndex.build();
  console.log(`${MODULE_ID} | index built — ${CompendiumIndex.totalCount} items across all packs`);
});
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: `dist/module.js` rebuilt successfully.

- [ ] **Step 5: Commit**

```bash
git add src/ui/launcher.ts src/module.ts
git commit -m "feat: sidebar launcher button + CompendiumIndex wired to ready"
```

---

### Task 8: Install Junction + Verify in Foundry

**No code changes — manual verification only.**

The module is served to Foundry via a Windows junction. Create it if it doesn't exist yet:

- [ ] **Step 1: Create junction** (run as non-admin in PowerShell)

```powershell
New-Item -ItemType Junction `
  -Path   "X:\FoundryVTT\Data\modules\t20-ficha-wizard" `
  -Target "E:\rayna\Documents\Claude\Projects\Modulo Foundry Ficha"
```

Replace `X:\FoundryVTT\Data` with your actual Foundry user data directory if different.

- [ ] **Step 2: Full quit and relaunch Foundry** (F5 is not enough after a new module junction)

- [ ] **Step 3: Enable the module in a world running `tormenta20`**

Game Settings → Manage Modules → enable "T20 Ficha Wizard" → Save.

- [ ] **Step 4: Check browser console (F12)**

Expected lines on world load:

```
t20-ficha-wizard | init
t20-ficha-wizard | ready — building compendium index
t20-ficha-wizard | index built — NNN items across all packs
```

`NNN` should be several hundred if the tormenta20 system packs are present. If zero, check that `game.packs` has Item collections and that `pack.documentName === "Item"` is matching.

- [ ] **Step 5: Verify sidebar button**

Open the Actors tab. A "Criar Personagem (Wizard)" button should appear in the header. Clicking it shows the "em construção" notification.

If the button does not appear: open DevTools, type `Hooks._hooks["renderActorDirectory"]` and verify the hook registered. If the `.header-actions` selector doesn't exist in v13, inspect the ActorDirectory DOM and update the selector in `launcher.ts`.

- [ ] **Step 6: Smoke-check index via console**

```js
// In F12 console:
const idx = game.modules.get("t20-ficha-wizard");
// CompendiumIndex is not exposed on the API yet — check via import map
// Quick check: count types
const races = [...game.packs].filter((p) => p.documentName === "Item");
console.log(
  "Item packs:",
  races.map((p) => p.collection)
);
```

The index is internal — a full API exposure comes in Plan 3 when we wire `game.modules.get(MODULE_ID).api`.

---

### Task 9: Final Checks + Tag

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 7 slug tests pass, 0 failures.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Format check**

```bash
npm run format
```

Commit any formatting changes:

```bash
git add -A
git commit -m "chore: format"
```

- [ ] **Step 4: Final commit + tag**

```bash
git add -A
git status  # verify nothing untracked
git commit -m "feat: Plan 1 complete — foundation + CompendiumIndex"
git tag v0.1.0-plan1
```

---

## Spec Coverage Check

| Spec requirement                                                      | Task covering it |
| --------------------------------------------------------------------- | ---------------- |
| TypeScript strict, Vite lib mode, fvtt-types pinned                   | Task 1           |
| `MODULE_ID`, `SYSTEM_ID`, `CHARACTER_TYPE`, `ITEM_TYPES` in constants | Task 2           |
| `CompendiumIndex.build()` — scans ALL Item packs, no allowlist filter | Task 6           |
| `getIndex({fields})` explicit field list                              | Task 6           |
| `getAll(type)`, `getById(type, id)`, `rebuild()` API                  | Task 6           |
| slug mirrors T20-DB normalization                                     | Task 5           |
| `lang/pt-BR.json` primary, all user-facing strings                    | Task 3           |
| Module loads in Foundry v13 + tormenta20, console logs on init/ready  | Task 8           |
| Sidebar button entry point registered                                 | Task 7           |

**Out of scope for Plan 1 (covered in Plans 2–4):**

- `data/` JSON files (prereqs, origens, divindades, atributos, dinheiro, slug-map) → Plan 2
- RuleEngine + vitest tests → Plan 2
- WizardState + WizardApp + all 11 steps → Plans 3–4
- ActorWriter + mapper → Plan 4
- `game.modules.get(MODULE_ID).api` exposure → Plan 4
- `resume` serialization via user flags → Plan 4

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-05-29-plan1-foundation-compendium-index.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
