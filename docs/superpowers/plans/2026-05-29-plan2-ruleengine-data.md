# T20 Ficha Wizard — Plan 2: RuleEngine + Data Port

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port T20-DB data into `src/data/` JSON bundles and implement the complete headlessly-testable RuleEngine (`src/rules/`), with vitest coverage for every rule module.

**Architecture:** A Node.js ESM port script reads the sibling T20-DB project and emits consolidated JSON into `src/data/`. The RuleEngine is pure TypeScript — zero Foundry dependencies — so all logic is vitest-testable. Each rule module (`atributos.ts`, `pericias.ts`, `poderes.ts`, `magias.ts`, `origem.ts`, `divindade.ts`) is independent and imports only from `src/data/` and `src/compendium/types.ts`. `engine.ts` orchestrates them. `subescolhas.ts` is a typed stub for Plan 3.

**Tech Stack:** TypeScript strict, Vite 5, vitest 1.x, Node.js ESM (port script only)

**T20-DB path:** `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB` (relative to module: `../../Ideias e RPG/T20-DB`)

---

## File Map

| File                              | Created/Modified   | Responsibility                                                 |
| --------------------------------- | ------------------ | -------------------------------------------------------------- |
| `scripts/port-t20db.mjs`          | Create             | Node.js ESM — reads T20-DB, writes all `src/data/` files       |
| `src/data/atributos.json`         | Create (generated) | Point buy table + method list                                  |
| `src/data/dinheiro.json`          | Create (generated) | Dinheiro inicial por nível (T$)                                |
| `src/data/origens.json`           | Create (generated) | All origens (id, nome, pericias, poderes, itens_iniciais)      |
| `src/data/divindades.json`        | Create (generated) | All divindades (id, nome, devotos_aceitos, poderes_concedidos) |
| `src/data/prereqs.json`           | Create (generated) | Map slug→pre_requisitos[] extracted from poderes/\*_/_.json    |
| `src/data/poderes-por-nivel.json` | Create (generated) | Poder count per class per level (from progressao_classes.json) |
| `src/data/slug-map.json`          | Create (manual)    | T20-DB id → Foundry item name overrides (starts empty `{}`)    |
| `src/rules/steps.ts`              | Create             | WizardStep enum, STEP_ORDER, STEP_META                         |
| `src/rules/atributos.ts`          | Create             | pointBuyCost(), validatePointBuy(), listMetodos()              |
| `src/rules/pericias.ts`           | Create             | countTreinaveis(), isInata(), buildPericiaSet()                |
| `src/rules/poderes.ts`            | Create             | checkPrereqs(), countPoderesPorNivel(), isEligible()           |
| `src/rules/magias.ts`             | Create             | getCirculosDesbloqueados(), getLimiteMagias(), filterMagias()  |
| `src/rules/origem.ts`             | Create             | getOrigem(), getPick2Beneficios(), listOrigens()               |
| `src/rules/divindade.ts`          | Create             | listDivindadesParaPersonagem(), isDivindadeObrigatoria()       |
| `src/rules/subescolhas.ts`        | Create             | Typed stub — resolveSubescolhas() skeleton for Plan 3          |
| `src/rules/engine.ts`             | Create             | getOptions(step, state), validate(step, choice, state)         |
| `test/rules/atributos.test.ts`    | Create             | Point buy cost + validation tests                              |
| `test/rules/pericias.test.ts`     | Create             | Pericias count tests                                           |
| `test/rules/poderes.test.ts`      | Create             | Prereq checker tests (fixture data)                            |
| `test/rules/magias.test.ts`       | Create             | Círculos + limite tests                                        |
| `test/rules/origem.test.ts`       | Create             | Origem pick-2 + listOrigens tests                              |
| `test/rules/divindade.test.ts`    | Create             | Devotos filter tests                                           |
| `lang/pt-BR.json`                 | Modify             | Add strings for WizardStep labels                              |

---

### Task 1: Port Script → Generate `src/data/` Files

**Files:**

- Create: `scripts/port-t20db.mjs`
- Create (generated): `src/data/atributos.json`, `src/data/dinheiro.json`, `src/data/origens.json`, `src/data/divindades.json`, `src/data/prereqs.json`, `src/data/poderes-por-nivel.json`, `src/data/slug-map.json`

**T20-DB paths (absolute):**

- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\atributos\atributos.json`
- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\regras\equipamento_inicial.json`
- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\regras\progressao_classes.json`
- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\origens\` (131 files)
- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\divindades\` (22 files)
- `E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\poderes\` (recursive, 1297 files)

- [ ] **Step 1: Create `scripts/port-t20db.mjs`**

```js
// @ts-check
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const T20DB = resolve("E:/rayna/Documents/Claude/Projects/Ideias e RPG/T20-DB/data");
const OUT = resolve("src/data");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`✓ ${path}`);
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

// 1. atributos.json — point buy + method list
{
  const src = readJson(join(T20DB, "atributos/atributos.json"));
  const compra = src.metodos_definicao.find((m) => m.id === "compra_pontos");
  writeJson(join(OUT, "atributos.json"), {
    compra_pontos: compra.compra_pontos,
    metodos: src.metodos_definicao.map((m) => ({
      id: m.id,
      nome: m.nome,
      tipo: m.tipo,
      categoria: m.categoria,
    })),
    tabela_conversao_padrao: src.tabela_conversao_padrao,
  });
}

// 2. dinheiro.json — initial money per level
{
  const src = readJson(join(T20DB, "regras/equipamento_inicial.json"));
  writeJson(join(OUT, "dinheiro.json"), {
    por_nivel: src.dinheiro_inicial_por_nivel,
    nivel_1_dado: "4d6",
  });
}

// 3. origens.json — all origens consolidated
{
  const origemDir = join(T20DB, "origens");
  const origens = readdirSync(origemDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const o = readJson(join(origemDir, f));
      return {
        id: o.id,
        nome: o.nome,
        itens_iniciais: o.itens_iniciais ?? [],
        beneficios: {
          pericias: o.beneficios?.pericias ?? [],
          poderes: o.beneficios?.poderes ?? [],
          poder_unico_id: o.beneficios?.poder_unico_id ?? null,
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "origens.json"), origens);
}

// 4. divindades.json — all divindades consolidated
{
  const divDir = join(T20DB, "divindades");
  const divindades = readdirSync(divDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const d = readJson(join(divDir, f));
      return {
        id: d.id,
        nome: d.nome,
        devotos_aceitos: d.devotos_aceitos,
        poderes_concedidos: d.poderes_concedidos ?? [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "divindades.json"), divindades);
}

// 5. prereqs.json — slug → pre_requisitos[] from all poder files
{
  const poderFiles = walkDir(join(T20DB, "poderes"));
  const prereqs = {};
  for (const f of poderFiles) {
    try {
      const p = readJson(f);
      if (p.id && Array.isArray(p.pre_requisitos) && p.pre_requisitos.length > 0) {
        prereqs[p.id] = p.pre_requisitos;
      }
    } catch {
      // skip malformed
    }
  }
  writeJson(join(OUT, "prereqs.json"), prereqs);
}

// 6. poderes-por-nivel.json — poder count per class per level
{
  const src = readJson(join(T20DB, "regras/progressao_classes.json"));
  const result = {};
  for (const [classeId, classeData] of Object.entries(src.classes ?? {})) {
    const porNivel = {};
    const tabela = classeData.tabela_progressao ?? {};
    for (const [nivel, dados] of Object.entries(tabela)) {
      const escolhas = dados.escolhas ?? [];
      const poderesDaClasse = escolhas.filter(
        (e) => e.tipo === "poder_classe" || e.tipo === "poder_geral"
      ).length;
      if (poderesDaClasse > 0) porNivel[nivel] = poderesDaClasse;
    }
    result[classeId] = porNivel;
  }
  writeJson(join(OUT, "poderes-por-nivel.json"), result);
}

// 7. slug-map.json — empty override map (filled manually when slug mismatch found)
{
  writeJson(join(OUT, "slug-map.json"), {});
}

console.log("Done.");
```

- [ ] **Step 2: Create `src/data/` directory**

```bash
mkdir -p src/data
```

On Windows PowerShell: `New-Item -ItemType Directory -Force src\data`

- [ ] **Step 3: Run the port script**

```bash
node scripts/port-t20db.mjs
```

Expected output:

```
✓ src/data/atributos.json
✓ src/data/dinheiro.json
✓ src/data/origens.json
✓ src/data/divindades.json
✓ src/data/prereqs.json
✓ src/data/poderes-por-nivel.json
✓ src/data/slug-map.json
Done.
```

If any file fails: check the T20-DB path is correct. The script uses absolute paths.

- [ ] **Step 4: Verify output sanity**

```bash
node -e "
const o = JSON.parse(require('fs').readFileSync('src/data/origens.json','utf-8'));
const d = JSON.parse(require('fs').readFileSync('src/data/divindades.json','utf-8'));
const p = JSON.parse(require('fs').readFileSync('src/data/prereqs.json','utf-8'));
console.log('origens:', o.length, '(expect ~130)');
console.log('divindades:', d.length, '(expect ~21)');
console.log('prereqs keys:', Object.keys(p).length, '(expect >100)');
console.log('acolito ok:', !!o.find(x => x.id === 'acolito'));
console.log('allihanna ok:', !!d.find(x => x.id === 'allihanna'));
"
```

- [ ] **Step 5: Commit + push**

```bash
git add scripts/port-t20db.mjs src/data/
git commit -m "feat: port T20-DB data into src/data/ JSON bundles"
git push origin master
```

---

### Task 2: WizardStep Enum + `src/rules/steps.ts`

**Files:**

- Create: `src/rules/steps.ts`

- [ ] **Step 1: Create `src/rules/steps.ts`**

```ts
/** Wizard step identifiers — order matches STEP_ORDER array. */
export const enum WizardStep {
  Nivel = "nivel",
  Atributos = "atributos",
  Raca = "raca",
  Origem = "origem",
  Classe = "classe",
  Pericias = "pericias",
  Divindade = "divindade",
  Poderes = "poderes",
  Magias = "magias",
  Equipamento = "equipamento",
  Revisao = "revisao",
}

/** Canonical step execution order. */
export const STEP_ORDER: WizardStep[] = [
  WizardStep.Nivel,
  WizardStep.Atributos,
  WizardStep.Raca,
  WizardStep.Origem,
  WizardStep.Classe,
  WizardStep.Pericias,
  WizardStep.Divindade,
  WizardStep.Poderes,
  WizardStep.Magias,
  WizardStep.Equipamento,
  WizardStep.Revisao,
];

export interface StepMeta {
  /** Passo pode ser pulado segundo condições. */
  conditional: boolean;
  /** Passo é obrigatório para criar o actor. */
  required: boolean;
  /** i18n key for step label. */
  labelKey: string;
}

/** Metadata for each wizard step. */
export const STEP_META: Record<WizardStep, StepMeta> = {
  [WizardStep.Nivel]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Nivel" },
  [WizardStep.Atributos]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Atributos",
  },
  [WizardStep.Raca]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Raca" },
  [WizardStep.Origem]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Origem" },
  [WizardStep.Classe]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Classe" },
  [WizardStep.Pericias]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Pericias",
  },
  [WizardStep.Divindade]: {
    conditional: true,
    required: false,
    labelKey: "T20W.Wizard.Step.Divindade",
  },
  [WizardStep.Poderes]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Poderes",
  },
  [WizardStep.Magias]: { conditional: true, required: false, labelKey: "T20W.Wizard.Step.Magias" },
  [WizardStep.Equipamento]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Equipamento",
  },
  [WizardStep.Revisao]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Revisao",
  },
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean (only pre-existing node_modules errors).

- [ ] **Step 3: Commit + push**

```bash
git add src/rules/steps.ts
git commit -m "feat: WizardStep enum and step metadata"
git push origin master
```

---

### Task 3: `src/rules/atributos.ts` + Tests (TDD)

**Files:**

- Create: `src/rules/atributos.ts`
- Create: `test/rules/atributos.test.ts`

The point buy system: start with all attributes at 0, spend 10 points. Cost table: -1→-1pt, 0→0, 1→1, 2→2, 3→4, 4→7.

- [ ] **Step 1: Create `test/rules/atributos.test.ts`** (write test first)

```ts
import { describe, it, expect } from "vitest";
import {
  pointBuyCost,
  validatePointBuy,
  POINT_BUY_INITIAL_POINTS,
} from "../../src/rules/atributos.js";

describe("pointBuyCost", () => {
  it("returns cost for each valid value", () => {
    expect(pointBuyCost(-1)).toBe(-1);
    expect(pointBuyCost(0)).toBe(0);
    expect(pointBuyCost(1)).toBe(1);
    expect(pointBuyCost(2)).toBe(2);
    expect(pointBuyCost(3)).toBe(4);
    expect(pointBuyCost(4)).toBe(7);
  });

  it("throws for unavailable value -2", () => {
    expect(() => pointBuyCost(-2)).toThrow();
  });

  it("throws for value > 4", () => {
    expect(() => pointBuyCost(5)).toThrow();
  });
});

describe("validatePointBuy", () => {
  const zero = { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };

  it("valid: all zeros spends 0 points", () => {
    const result = validatePointBuy(zero);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.remaining).toBe(POINT_BUY_INITIAL_POINTS);
  });

  it("valid: 4+4+2+0+0+0 spends exactly 10 points", () => {
    const attrs = { for: 4, des: 4, con: 2, int: 0, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(7 + 7 + 2);
    expect(result.remaining).toBe(10 - 16);
  });

  it("invalid: spending more than 10 points", () => {
    const attrs = { for: 4, des: 4, con: 4, int: 4, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(false);
    expect(result.spent).toBe(7 + 7 + 7 + 7);
  });

  it("valid: -1 reduces a stat and reclaims 1 point", () => {
    // spend 1 on for, -1 on des = net 0 spent from base 10 = 10 remaining...
    // Actually: spent = cost(1) + cost(-1) = 1 + (-1) = 0. remaining = 10.
    const attrs = { for: 1, des: -1, con: 0, int: 0, sab: 0, car: 0 };
    const result = validatePointBuy(attrs);
    expect(result.valid).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.remaining).toBe(10);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- test/rules/atributos.test.ts
```

Expected: FAIL with `Cannot find module '../../src/rules/atributos.js'`

- [ ] **Step 3: Create `src/rules/atributos.ts`**

```ts
import atributosData from "../data/atributos.json" assert { type: "json" };

/** Point buy cost table: attribute value → point cost. */
const COST_TABLE: Record<number, number> = {};
for (const entry of atributosData.compra_pontos.tabela_custo) {
  if (entry.custo !== null) {
    COST_TABLE[entry.valor] = entry.custo;
  }
}

export const POINT_BUY_INITIAL_POINTS = atributosData.compra_pontos.pontos_iniciais;

/**
 * Returns the point cost for a single attribute value in the point buy system.
 * Throws if the value is not purchasable (e.g. -2, or > 4).
 */
export function pointBuyCost(value: number): number {
  if (!(value in COST_TABLE)) {
    throw new RangeError(`Valor de atributo ${value} não disponível no ponto de compra`);
  }
  return COST_TABLE[value];
}

export type AtributosBase = Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;

export interface PointBuyResult {
  valid: boolean;
  spent: number;
  remaining: number;
  errors: string[];
}

/**
 * Validates a full set of 6 attribute values against the point buy rules.
 */
export function validatePointBuy(attrs: AtributosBase): PointBuyResult {
  const errors: string[] = [];
  let spent = 0;

  for (const [key, value] of Object.entries(attrs)) {
    try {
      spent += pointBuyCost(value);
    } catch {
      errors.push(`${key}: valor ${value} inválido para ponto de compra`);
    }
  }

  const remaining = POINT_BUY_INITIAL_POINTS - spent;
  const valid = errors.length === 0 && remaining >= 0;

  return { valid, spent, remaining, errors };
}

export type MetodoAtributos =
  | "compra_pontos"
  | "rolagem_padrao"
  | "classica"
  | "epica"
  | "valkaria"
  | "khalmyr"
  | "nimb";

export interface MetodoInfo {
  id: MetodoAtributos;
  nome: string;
  tipo: string;
  categoria: string;
}

/** Returns all available attribute generation methods. */
export function listMetodos(): MetodoInfo[] {
  return atributosData.metodos as MetodoInfo[];
}
```

- [ ] **Step 4: Update `tsconfig.json`** to allow JSON imports

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "types": ["@league-of-foundry-developers/foundry-vtt-types"],
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 5: Update `vite.config.ts`** to handle JSON import assertions

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

(No change needed — Vite handles JSON imports natively in ESM mode.)

- [ ] **Step 6: Run test — expect PASS**

```bash
npm test -- test/rules/atributos.test.ts
```

Expected: all tests pass. If JSON import assertion fails in vitest, update `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

Vitest supports JSON imports natively; no additional config needed.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 8: Commit + push**

```bash
git add src/rules/atributos.ts test/rules/atributos.test.ts tsconfig.json
git commit -m "feat: atributos rule module + point buy tests (TDD)"
git push origin master
```

---

### Task 4: `src/rules/pericias.ts` + Tests (TDD)

**Files:**

- Create: `src/rules/pericias.ts`
- Create: `test/rules/pericias.test.ts`

Rule: treináveis = `classe.pericias.numero + max(0, Int_modifier) + racial_bonus`. `inatas` are pre-marked and locked. Choice pool = `classe.pericias.escolhas`.

- [ ] **Step 1: Create `test/rules/pericias.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { countTreinaveis, buildPericiaSet } from "../../src/rules/pericias.js";
import type { IndexedClasse } from "../../src/compendium/types.js";

// Minimal fixture for a classe item
function mockClasse(overrides: Partial<IndexedClasse["system"]> = {}): IndexedClasse {
  return {
    id: "guerreiro",
    name: "Guerreiro",
    img: "",
    packId: "tormenta20.classes",
    type: "classe",
    system: {
      pvPorNivel: 5,
      pmPorNivel: 3,
      pericias: {
        inatas: ["luta", "fortitude"],
        escolhas: ["atletismo", "cavalgar", "iniciativa", "intimidacao", "percepcao"],
        numero: 2,
        value: [],
      },
      ...overrides,
    },
  } as IndexedClasse;
}

describe("countTreinaveis", () => {
  it("base count = classe.numero when Int = 0", () => {
    const classe = mockClasse();
    expect(countTreinaveis(classe, 0, 0)).toBe(2);
  });

  it("adds Int modifier when positive", () => {
    expect(countTreinaveis(mockClasse(), 2, 0)).toBe(4);
  });

  it("does NOT subtract when Int is negative", () => {
    expect(countTreinaveis(mockClasse(), -1, 0)).toBe(2); // max(0, -1) = 0
  });

  it("adds racial bonus", () => {
    expect(countTreinaveis(mockClasse(), 0, 1)).toBe(3);
  });

  it("combines Int + racial", () => {
    expect(countTreinaveis(mockClasse(), 1, 2)).toBe(5);
  });
});

describe("buildPericiaSet", () => {
  it("inatas are always included and locked", () => {
    const classe = mockClasse();
    const result = buildPericiaSet(classe, [], []);
    expect(result.inatas).toContain("luta");
    expect(result.inatas).toContain("fortitude");
    expect(result.inatas).toHaveLength(2);
  });

  it("escolhidas are combined with inatas", () => {
    const classe = mockClasse();
    const result = buildPericiaSet(classe, ["atletismo"], []);
    expect(result.treinadas).toContain("atletismo");
    expect(result.treinadas).toContain("luta");
  });

  it("extra from Int/racial are included", () => {
    const result = buildPericiaSet(mockClasse(), [], ["misticismo"]);
    expect(result.treinadas).toContain("misticismo");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- test/rules/pericias.test.ts
```

Expected: FAIL with `Cannot find module '../../src/rules/pericias.js'`

- [ ] **Step 3: Create `src/rules/pericias.ts`**

```ts
import type { IndexedClasse } from "../compendium/types.js";

/**
 * Counts the number of treinável (trainable) skills for a character.
 *
 * @param classe - Indexed classe item (carries pericias.numero from system)
 * @param intModifier - Int attribute modifier (positive value grants extra skills)
 * @param racialBonus - Extra skills granted by race (0 for most races)
 */
export function countTreinaveis(
  classe: IndexedClasse,
  intModifier: number,
  racialBonus: number
): number {
  const base = classe.system.pericias?.numero ?? 0;
  const fromInt = Math.max(0, intModifier);
  return base + fromInt + racialBonus;
}

export interface PericiaSet {
  /** Always trained — cannot be un-trained. Granted by class. */
  inatas: string[];
  /** All trained skills (inatas + chosen + extras). */
  treinadas: string[];
  /** Remaining choices the user still needs to pick. */
  choicesRemaining: number;
}

/**
 * Builds the full skill set for a character given class + choices + extras.
 *
 * @param classe - Indexed classe item
 * @param escolhidas - Skills chosen from classe.pericias.escolhas
 * @param extras - Extra skills from Int modifier or racial bonus (any skill, not restricted to escolhas)
 */
export function buildPericiaSet(
  classe: IndexedClasse,
  escolhidas: string[],
  extras: string[]
): PericiaSet {
  const inatas = classe.system.pericias?.inatas ?? [];
  const treinadas = Array.from(new Set([...inatas, ...escolhidas, ...extras]));
  const needed = classe.system.pericias?.numero ?? 0;
  const choicesRemaining = Math.max(0, needed - escolhidas.length);

  return { inatas, treinadas, choicesRemaining };
}

/**
 * Returns whether a skill is an inata (auto-trained) for a given classe.
 */
export function isInata(classe: IndexedClasse, periciaId: string): boolean {
  return (classe.system.pericias?.inatas ?? []).includes(periciaId);
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- test/rules/pericias.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 6: Commit + push**

```bash
git add src/rules/pericias.ts test/rules/pericias.test.ts
git commit -m "feat: pericias rule module + skill count tests (TDD)"
git push origin master
```

---

### Task 5: `src/rules/poderes.ts` + Tests (TDD)

**Files:**

- Create: `src/rules/poderes.ts`
- Create: `test/rules/poderes.test.ts`

Prereq types from T20-DB: `atributo` (attr >= valor), `poder` (slug in state.poderes), `classe` (classeId matches), `raca` (racaId matches), `nivel` (nivel >= valor), `bab` (ignored in wizard — always eligible), `pericias` (periciaId in treinadas).

- [ ] **Step 1: Create `test/rules/poderes.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { checkPrereqs, isEligible } from "../../src/rules/poderes.js";

// Minimal wizard state fixture
const baseState = {
  nivel: 1,
  atributosBase: { for: 0, des: 2, con: 0, int: 0, sab: 0, car: 0 },
  classeId: "guerreiro",
  racaId: "humano",
  periciasTreinadas: ["luta", "atletismo"],
  poderes: [] as string[],
};

describe("checkPrereqs", () => {
  it("no prereqs → eligible", () => {
    const result = checkPrereqs([], baseState);
    expect(result.eligible).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it("atributo prereq met", () => {
    const prereqs = [{ tipo: "atributo", atributo: "des", valor: 2 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("atributo prereq NOT met", () => {
    const prereqs = [{ tipo: "atributo", atributo: "for", valor: 1 }];
    const result = checkPrereqs(prereqs, {
      ...baseState,
      atributosBase: { ...baseState.atributosBase, for: 0 },
    });
    expect(result.eligible).toBe(false);
    expect(result.unmet[0].tipo).toBe("atributo");
  });

  it("nivel prereq met", () => {
    const prereqs = [{ tipo: "nivel", valor: 1 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("nivel prereq NOT met", () => {
    const prereqs = [{ tipo: "nivel", valor: 5 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("poder prereq met (slug in state.poderes)", () => {
    const prereqs = [{ tipo: "poder", poder: "ambidestria" }];
    const state = { ...baseState, poderes: ["ambidestria"] };
    expect(checkPrereqs(prereqs, state).eligible).toBe(true);
  });

  it("poder prereq NOT met", () => {
    const prereqs = [{ tipo: "poder", poder: "ambidestria" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("pericias prereq met", () => {
    const prereqs = [{ tipo: "pericias", pericia: "luta" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("pericias prereq NOT met", () => {
    const prereqs = [{ tipo: "pericias", pericia: "misticismo" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("bab prereq is always eligible (not tracked in wizard)", () => {
    const prereqs = [{ tipo: "bab", valor: 5 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });
});

describe("isEligible", () => {
  it("returns true for unknown poder slug (fallback)", () => {
    // slug not in prereqs.json → fallback eligible
    expect(isEligible("poder_inexistente_xyzzy", baseState)).toBe(true);
  });

  it("ambidestria requires Des 2 — eligible when Des = 2", () => {
    expect(isEligible("ambidestria", baseState)).toBe(true);
  });

  it("ambidestria requires Des 2 — NOT eligible when Des = 0", () => {
    const state = { ...baseState, atributosBase: { ...baseState.atributosBase, des: 0 } };
    expect(isEligible("ambidestria", state)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- test/rules/poderes.test.ts
```

- [ ] **Step 3: Create `src/rules/poderes.ts`**

```ts
import prereqsData from "../data/prereqs.json" assert { type: "json" };

type Prereq = Record<string, unknown>;

export interface PrereqCheckResult {
  eligible: boolean;
  unmet: Prereq[];
}

export interface PartialWizardState {
  nivel: number;
  atributosBase: Record<string, number>;
  classeId: string;
  racaId: string;
  periciasTreinadas: string[];
  poderes: string[];
}

/**
 * Checks a list of pre_requisitos against the current wizard state.
 * Unrecognized prereq types (e.g. "bab") default to eligible.
 */
export function checkPrereqs(prereqs: Prereq[], state: PartialWizardState): PrereqCheckResult {
  const unmet: Prereq[] = [];

  for (const req of prereqs) {
    let met = true;

    switch (req["tipo"]) {
      case "atributo": {
        const attr = req["atributo"] as string;
        const needed = req["valor"] as number;
        const have = state.atributosBase[attr] ?? 0;
        met = have >= needed;
        break;
      }
      case "nivel": {
        met = state.nivel >= (req["valor"] as number);
        break;
      }
      case "poder": {
        const poderSlug = req["poder"] as string;
        met = state.poderes.includes(poderSlug);
        break;
      }
      case "classe": {
        met = state.classeId === (req["classe"] as string);
        break;
      }
      case "raca": {
        met = state.racaId === (req["raca"] as string);
        break;
      }
      case "pericias": {
        const pericia = req["pericia"] as string;
        met = state.periciasTreinadas.includes(pericia);
        break;
      }
      case "bab":
      default:
        // bab not tracked; unknown types default to eligible
        met = true;
        break;
    }

    if (!met) unmet.push(req);
  }

  return { eligible: unmet.length === 0, unmet };
}

/**
 * Checks whether a poder (by T20-DB slug) is eligible given the current state.
 * Falls back to eligible=true if the slug is not in prereqs.json.
 */
export function isEligible(poderSlug: string, state: PartialWizardState): boolean {
  const prereqs = (prereqsData as Record<string, Prereq[]>)[poderSlug];
  if (!prereqs) return true; // no prereqs recorded → show without restriction
  return checkPrereqs(prereqs, state).eligible;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- test/rules/poderes.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck + commit + push**

```bash
npm run typecheck
git add src/rules/poderes.ts test/rules/poderes.test.ts
git commit -m "feat: poderes prereq checker + tests (TDD)"
git push origin master
```

---

### Task 6: `src/rules/magias.ts` + Tests (TDD)

**Files:**

- Create: `src/rules/magias.ts`
- Create: `test/rules/magias.test.ts`

Circles unlocked and spell limits come from `progressao_classes.json`. For the MVP, we embed a simplified table derived from the T20-DB data. Arcanista: círculos 1–5 (1 per 4 levels: 1@1, 2@5, 3@9, 4@13, 5@17). Clérigo/Druida: same. Non-casters: no spells.

- [ ] **Step 1: Create `test/rules/magias.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getCirculosDesbloqueados, isConjurador, filterMagias } from "../../src/rules/magias.js";
import type { IndexedMagia } from "../../src/compendium/types.js";

function mockMagia(overrides: Partial<IndexedMagia["system"]> = {}): IndexedMagia {
  return {
    id: "bola-de-fogo",
    name: "Bola de Fogo",
    img: "",
    packId: "tormenta20.magias",
    type: "magia",
    system: { circulo: 3, escola: "evo", tipo: "arc", ...overrides },
  } as IndexedMagia;
}

describe("isConjurador", () => {
  it("arcanista é conjurador", () => expect(isConjurador("arcanista")).toBe(true));
  it("clerigo é conjurador", () => expect(isConjurador("clerigo")).toBe(true));
  it("druida é conjurador", () => expect(isConjurador("druida")).toBe(true));
  it("guerreiro NÃO é conjurador", () => expect(isConjurador("guerreiro")).toBe(false));
  it("ladino NÃO é conjurador", () => expect(isConjurador("ladino")).toBe(false));
});

describe("getCirculosDesbloqueados", () => {
  it("nível 1 arcanista → círculo 1", () => {
    expect(getCirculosDesbloqueados("arcanista", 1)).toEqual([1]);
  });

  it("nível 5 arcanista → círculos 1–2", () => {
    const circs = getCirculosDesbloqueados("arcanista", 5);
    expect(circs).toContain(1);
    expect(circs).toContain(2);
  });

  it("nível 9 → círculos 1–3", () => {
    expect(getCirculosDesbloqueados("arcanista", 9)).toHaveLength(3);
  });

  it("não conjurador → círculos vazios", () => {
    expect(getCirculosDesbloqueados("guerreiro", 10)).toHaveLength(0);
  });
});

describe("filterMagias", () => {
  it("filtra por círculo desbloqueado", () => {
    const magias = [mockMagia({ circulo: 1 }), mockMagia({ circulo: 3 })];
    const result = filterMagias(magias, "arcanista", 1);
    expect(result).toHaveLength(1);
    expect(result[0].system.circulo).toBe(1);
  });

  it("filtra por tipo: arcanista só recebe arc", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "arc" }), mockMagia({ circulo: 1, tipo: "div" })];
    expect(filterMagias(magias, "arcanista", 1)).toHaveLength(1);
  });

  it("druida só recebe div", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "div" }), mockMagia({ circulo: 1, tipo: "arc" })];
    expect(filterMagias(magias, "druida", 1)).toHaveLength(1);
    expect(filterMagias(magias, "druida", 1)[0].system.tipo).toBe("div");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- test/rules/magias.test.ts
```

- [ ] **Step 3: Create `src/rules/magias.ts`**

```ts
import type { IndexedMagia } from "../compendium/types.js";

/** Classes that can cast spells. */
const CONJURADORES = new Set(["arcanista", "bardo", "clerigo", "druida", "paladino", "xama"]);

/** Spell type(s) accessible per class. */
const CLASSE_TIPO_MAGIA: Record<string, ("arc" | "div")[]> = {
  arcanista: ["arc"],
  bardo: ["arc"],
  clerigo: ["div"],
  druida: ["div"],
  paladino: ["div"],
  xama: ["div"],
};

/** Level thresholds that unlock each circle (index 0 = circle 1). */
const CIRCLE_UNLOCK_LEVELS = [1, 5, 9, 13, 17];

export function isConjurador(classeId: string): boolean {
  return CONJURADORES.has(classeId);
}

/**
 * Returns the list of spell circles unlocked for a class at a given level.
 */
export function getCirculosDesbloqueados(classeId: string, nivel: number): number[] {
  if (!isConjurador(classeId)) return [];
  return CIRCLE_UNLOCK_LEVELS.map((threshold, i) => ({ circle: i + 1, threshold }))
    .filter(({ threshold }) => nivel >= threshold)
    .map(({ circle }) => circle);
}

/**
 * Filters a list of indexed magias to those available for a class at a given level.
 * Applies: circle unlock + spell type (arc/div).
 */
export function filterMagias(
  magias: IndexedMagia[],
  classeId: string,
  nivel: number
): IndexedMagia[] {
  const circles = new Set(getCirculosDesbloqueados(classeId, nivel));
  const tipos = new Set<string>(CLASSE_TIPO_MAGIA[classeId] ?? []);

  return magias.filter(
    (m) =>
      m.system.circulo !== undefined &&
      circles.has(m.system.circulo) &&
      (!m.system.tipo || tipos.has(m.system.tipo))
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- test/rules/magias.test.ts
```

- [ ] **Step 5: Typecheck + commit + push**

```bash
npm run typecheck
git add src/rules/magias.ts test/rules/magias.test.ts
git commit -m "feat: magias rule module + spell filter tests (TDD)"
git push origin master
```

---

### Task 7: `src/rules/origem.ts` + `src/rules/divindade.ts` + Tests (TDD)

**Files:**

- Create: `src/rules/origem.ts`
- Create: `src/rules/divindade.ts`
- Create: `test/rules/origem.test.ts`
- Create: `test/rules/divindade.test.ts`

- [ ] **Step 1: Create `test/rules/origem.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { listOrigens, getOrigem, getPick2Candidates } from "../../src/rules/origem.js";

describe("listOrigens", () => {
  it("returns non-empty array", () => {
    const list = listOrigens();
    expect(list.length).toBeGreaterThan(0);
  });

  it("each origem has id and nome", () => {
    for (const o of listOrigens()) {
      expect(typeof o.id).toBe("string");
      expect(typeof o.nome).toBe("string");
    }
  });
});

describe("getOrigem", () => {
  it("returns acolito", () => {
    const o = getOrigem("acolito");
    expect(o).not.toBeNull();
    expect(o!.nome).toBe("Acólito");
    expect(o!.beneficios.pericias).toContain("Cura");
  });

  it("returns null for unknown id", () => {
    expect(getOrigem("origem_inexistente_xyzzy")).toBeNull();
  });
});

describe("getPick2Candidates", () => {
  it("acolito has 3 poderes to pick 1 from", () => {
    const cands = getPick2Candidates("acolito");
    // acolito has poder_unico_id = "membro_da_igreja" (auto-granted),
    // remaining 2 are the pick candidates
    expect(cands.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Create `test/rules/divindade.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  listDivindades,
  isDivindadeAcessa,
  isDivindadeObrigatoria,
} from "../../src/rules/divindade.js";

describe("listDivindades", () => {
  it("returns all divindades", () => {
    expect(listDivindades().length).toBeGreaterThan(0);
  });
});

describe("isDivindadeAcessa", () => {
  it("aharadak aceita qualquer devoto", () => {
    expect(isDivindadeAcessa("aharadak", "qualquer_raca", "qualquer_classe")).toBe(true);
  });

  it("allihanna não aceita guerreiro", () => {
    expect(isDivindadeAcessa("allihanna", "humano", "guerreiro")).toBe(false);
  });

  it("allihanna aceita druida", () => {
    expect(isDivindadeAcessa("allihanna", "humano", "druida")).toBe(true);
  });

  it("returns false for unknown divindade", () => {
    expect(isDivindadeAcessa("divindade_xyzzy", "humano", "guerreiro")).toBe(false);
  });
});

describe("isDivindadeObrigatoria", () => {
  it("clerigo precisa de divindade", () => {
    expect(isDivindadeObrigatoria("clerigo")).toBe(true);
  });

  it("paladino precisa de divindade", () => {
    expect(isDivindadeObrigatoria("paladino")).toBe(true);
  });

  it("druida precisa de divindade", () => {
    expect(isDivindadeObrigatoria("druida")).toBe(true);
  });

  it("guerreiro NÃO precisa", () => {
    expect(isDivindadeObrigatoria("guerreiro")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm test -- test/rules/origem.test.ts test/rules/divindade.test.ts
```

- [ ] **Step 4: Create `src/rules/origem.ts`**

```ts
import origensData from "../data/origens.json" assert { type: "json" };

export interface OrigensBeneficio {
  pericias: string[];
  poderes: string[];
  poder_unico_id: string | null;
}

export interface Origem {
  id: string;
  nome: string;
  itens_iniciais: string[];
  beneficios: OrigensBeneficio;
}

const ORIGENS: Origem[] = origensData as Origem[];

export function listOrigens(): Origem[] {
  return ORIGENS;
}

export function getOrigem(id: string): Origem | null {
  return ORIGENS.find((o) => o.id === id) ?? null;
}

/**
 * Returns the "pick-2" poder candidates for an origem.
 * Poder com poder_unico_id is auto-granted; the rest are the pick pool.
 */
export function getPick2Candidates(origemId: string): string[] {
  const origem = getOrigem(origemId);
  if (!origem) return [];
  const autoId = origem.beneficios.poder_unico_id;
  if (!autoId) return origem.beneficios.poderes;
  return origem.beneficios.poderes.filter((p) => p !== autoId);
}
```

- [ ] **Step 5: Create `src/rules/divindade.ts`**

```ts
import divindadesData from "../data/divindades.json" assert { type: "json" };

export interface DevotosAceitos {
  regra: "qualquer" | "lista_restrita" | "druida" | string;
  racas_aceitas?: string[] | "todas";
  classes_aceitas?: string[] | "todas";
}

export interface Divindade {
  id: string;
  nome: string;
  devotos_aceitos: DevotosAceitos;
  poderes_concedidos: string[];
}

const DIVINDADES: Divindade[] = divindadesData as Divindade[];

/** Classes that must choose a divindade. */
const CLASSES_OBRIGATORIAS = new Set(["clerigo", "paladino", "druida"]);

export function listDivindades(): Divindade[] {
  return DIVINDADES;
}

export function getDivindade(id: string): Divindade | null {
  return DIVINDADES.find((d) => d.id === id) ?? null;
}

/**
 * Returns whether a character (by racaId + classeId) can worship a given divindade.
 */
export function isDivindadeAcessa(divindadeId: string, racaId: string, classeId: string): boolean {
  const div = getDivindade(divindadeId);
  if (!div) return false;

  const { devotos_aceitos } = div;

  if (devotos_aceitos.regra === "qualquer") return true;

  const racas = devotos_aceitos.racas_aceitas;
  const classes = devotos_aceitos.classes_aceitas;

  const racaOk = !racas || racas === "todas" || (Array.isArray(racas) && racas.includes(racaId));

  const classeOk =
    !classes || classes === "todas" || (Array.isArray(classes) && classes.includes(classeId));

  // A devoto is accepted if their race OR class is on the list
  return racaOk || classeOk;
}

/**
 * Returns accessible divindades for a character.
 */
export function listDivindadesParaPersonagem(racaId: string, classeId: string): Divindade[] {
  return DIVINDADES.filter((d) => isDivindadeAcessa(d.id, racaId, classeId));
}

/**
 * Whether a class MUST choose a divindade (mandatory step).
 */
export function isDivindadeObrigatoria(classeId: string): boolean {
  return CLASSES_OBRIGATORIAS.has(classeId);
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npm test -- test/rules/origem.test.ts test/rules/divindade.test.ts
```

- [ ] **Step 7: Typecheck + commit + push**

```bash
npm run typecheck
git add src/rules/origem.ts src/rules/divindade.ts test/rules/origem.test.ts test/rules/divindade.test.ts
git commit -m "feat: origem + divindade rule modules + tests (TDD)"
git push origin master
```

---

### Task 8: `src/rules/engine.ts` + `src/rules/subescolhas.ts` Stub

**Files:**

- Create: `src/rules/engine.ts`
- Create: `src/rules/subescolhas.ts`

No new tests for engine.ts (integration of existing modules). Subescolhas is a typed stub.

- [ ] **Step 1: Create `src/rules/subescolhas.ts`** (typed stub for Plan 3)

```ts
/**
 * Sub-choice resolver — stub for Plan 3.
 * Handles: specialist school, familiar, choosable modifiers,
 * sorcerer lineage, duende constructor, origin pick-2.
 */
export interface SubescolhaContext {
  itemId: string; // poder/race/classe id
  classeId: string;
  racaId: string;
  nivel: number;
}

export type SubescolhaValue = string | number | string[];

/**
 * Resolves sub-choices for a given item (race, class, power, origin).
 * Returns the required sub-choice prompts for the wizard to present.
 * Stub: returns empty array until Plan 3 implements full resolution.
 */
export function resolveSubescolhas(
  _context: SubescolhaContext
): Array<{ key: string; label: string; options: string[] }> {
  // TODO (Plan 3): implement specialist, familiar, modifier choices, lineage, etc.
  return [];
}
```

- [ ] **Step 2: Create `src/rules/engine.ts`**

```ts
import { WizardStep } from "./steps.js";
import { validatePointBuy, listMetodos } from "./atributos.js";
import { countTreinaveis, buildPericiaSet } from "./pericias.js";
import { isEligible } from "./poderes.js";
import { isConjurador, filterMagias, getCirculosDesbloqueados } from "./magias.js";
import { listOrigens, getOrigem } from "./origem.js";
import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  isDivindadeAcessa,
} from "./divindade.js";
import type { IndexedClasse, IndexedMagia, AnyIndexed } from "../compendium/types.js";
import type { AtributosBase } from "./atributos.js";

/** Minimal wizard state shape consumed by the engine (subset of full WizardState). */
export interface EngineState {
  nivel: number;
  nome: string;
  metodoAtributos: string;
  atributosBase: AtributosBase;
  racaId: string;
  origemId: string;
  classeId: string;
  subclasseId?: string;
  divindadeId?: string;
  periciasTreinadas: string[];
  poderes: string[];
  poderesAutoGrant: string[];
  magias: string[];
  equipamento: { itemId: string; qty: number }[];
  dinheiroRestante: number;
  escolhasPorItem: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates state for a given step. Returns errors if the step's data is incomplete or invalid.
 */
export function validate(step: WizardStep, state: EngineState): ValidationResult {
  const errors: string[] = [];

  switch (step) {
    case WizardStep.Nivel:
      if (state.nivel < 1 || state.nivel > 20) errors.push("Nível deve ser entre 1 e 20.");
      if (!state.nome.trim()) errors.push("Nome é obrigatório.");
      break;

    case WizardStep.Atributos:
      if (state.metodoAtributos === "compra_pontos") {
        const result = validatePointBuy(state.atributosBase);
        if (!result.valid) errors.push(...result.errors);
        if (result.remaining < 0) errors.push(`Pontos excedidos em ${-result.remaining}.`);
      }
      break;

    case WizardStep.Raca:
      if (!state.racaId) errors.push("Raça é obrigatória.");
      break;

    case WizardStep.Origem:
      if (!state.origemId) errors.push("Origem é obrigatória.");
      break;

    case WizardStep.Classe:
      if (!state.classeId) errors.push("Classe é obrigatória.");
      break;

    case WizardStep.Divindade:
      if (isDivindadeObrigatoria(state.classeId) && !state.divindadeId) {
        errors.push("Divindade é obrigatória para esta classe.");
      }
      if (
        state.divindadeId &&
        !isDivindadeAcessa(state.divindadeId, state.racaId, state.classeId)
      ) {
        errors.push("Esta divindade não aceita personagens com esta raça/classe.");
      }
      break;

    case WizardStep.Revisao:
      if (!state.nome.trim()) errors.push("Nome é obrigatório.");
      if (!state.classeId) errors.push("Classe é obrigatória.");
      if (!state.racaId) errors.push("Raça é obrigatória.");
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns filtered options for a given step + state.
 * CompendiumIndex items are passed in where needed (lazy: avoid coupling to Foundry globals).
 */
export function getOptions(
  step: WizardStep,
  state: EngineState,
  compendiumItems?: AnyIndexed[]
): unknown {
  switch (step) {
    case WizardStep.Atributos:
      return listMetodos();

    case WizardStep.Origem:
      return listOrigens();

    case WizardStep.Divindade:
      return listDivindadesParaPersonagem(state.racaId, state.classeId);

    case WizardStep.Magias: {
      const magias = (compendiumItems ?? []).filter((i): i is IndexedMagia => i.type === "magia");
      return filterMagias(magias, state.classeId, state.nivel);
    }

    default:
      return compendiumItems ?? [];
  }
}
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

Expected: `dist/module.js` rebuilds.

- [ ] **Step 5: Commit + push**

```bash
git add src/rules/engine.ts src/rules/subescolhas.ts
git commit -m "feat: RuleEngine orchestrator + subescolhas stub"
git push origin master
```

---

### Task 9: Final Checks + Tag

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass (slug × 7 + atributos × 6 + pericias × 5 + poderes × 8 + magias × 8 + origem × 3 + divindade × 6 = ~43 tests).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: only pre-existing node_modules errors.

- [ ] **Step 3: Format**

```bash
npm run format
```

If changes: `git add -A && git commit -m "chore: format" && git push origin master`

- [ ] **Step 4: Final tag**

```bash
git add -A
git status
git commit -m "feat: Plan 2 complete — RuleEngine + data port" 2>/dev/null || true
git tag v0.2.0-plan2
git push origin master --tags
```

---

## Spec Coverage Check

| Spec requirement                                           | Task   |
| ---------------------------------------------------------- | ------ |
| `src/data/prereqs.json` — slug→prereqs from T20-DB poderes | Task 1 |
| `src/data/origens.json` — all origens consolidated         | Task 1 |
| `src/data/divindades.json` — all divindades                | Task 1 |
| `src/data/atributos.json` — point buy table                | Task 1 |
| `src/data/dinheiro.json` — money per level                 | Task 1 |
| WizardStep enum + STEP_ORDER + STEP_META                   | Task 2 |
| Point buy validation + method list                         | Task 3 |
| `countTreinaveis` (classe.numero + Int + racial)           | Task 4 |
| Prereq checker (atributo/nivel/poder/classe/raca/pericias) | Task 5 |
| `isEligible` fallback for unknown slug                     | Task 5 |
| Círculos desbloqueados by class/level                      | Task 6 |
| `filterMagias` by circle + tipo                            | Task 6 |
| `listOrigens`, `getOrigem`, `getPick2Candidates`           | Task 7 |
| `isDivindadeAcessa` (qualquer/lista_restrita)              | Task 7 |
| `isDivindadeObrigatoria` (clerigo/paladino/druida)         | Task 7 |
| `engine.ts` orchestrates all rules                         | Task 8 |
| `subescolhas.ts` typed stub                                | Task 8 |

**Out of scope for Plan 2 (Plans 3–4):**

- WizardState, WizardApp, step components → Plan 3
- ActorWriter, mapper → Plan 4
- `subescolhas.ts` full implementation → Plan 3
- Foundry-coupled code (CompendiumIndex, launcher) — already done in Plan 1
