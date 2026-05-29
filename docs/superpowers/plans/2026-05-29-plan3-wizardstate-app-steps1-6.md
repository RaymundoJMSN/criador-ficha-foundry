# T20 Ficha Wizard — Plan 3: WizardState + WizardApp + Steps 1–6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `WizardState` (in-memory state + serialize/deserialize), `WizardApp` (ApplicationV2 multi-step shell), and the first 6 wizard steps (Nível, Atributos, Raça, Origem, Classe, Perícias) with Handlebars templates. At the end, clicking the sidebar button opens a working multi-step wizard that navigates steps 1–6 and persists state.

**Architecture:** `WizardState` is pure TypeScript (no Foundry, tested in vitest where possible). `WizardApp` extends `ApplicationV2` with `HandlebarsApplicationMixin` — one Handlebars PART per step. Steps 1–6 are implemented as render-data helpers in `src/wizard/steps/`. `RuleEngine.getOptions()` and `RuleEngine.validate()` (from Plan 2) wire into each step. `CompendiumIndex` (from Plan 1) supplies item lists.

**Tech Stack:** TypeScript strict, Vite 5, vitest 1.x, Foundry v13 ApplicationV2, Handlebars templates, fvtt-types pinned.

**Foundry ApplicationV2 pattern:**

```ts
class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = { partId: { template: "modules/t20-ficha-wizard/templates/part.hbs" } };
  async _prepareContext(_options) {
    return {
      /* data */
    };
  }
}
```

---

## File Map

| File                             | Created/Modified | Responsibility                                                               |
| -------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `src/wizard/state.ts`            | Create           | WizardState class: apply(), undo(), isComplete(), serialize(), deserialize() |
| `src/wizard/app.ts`              | Create           | WizardApp extends ApplicationV2 — shell, navigation, PARTS                   |
| `src/wizard/steps/nivel.ts`      | Create           | Step 1 render data + submit handler                                          |
| `src/wizard/steps/atributos.ts`  | Create           | Step 2 render data + point buy UI data                                       |
| `src/wizard/steps/raca.ts`       | Create           | Step 3 render data (CompendiumIndex races)                                   |
| `src/wizard/steps/origem.ts`     | Create           | Step 4 render data (RuleEngine listOrigens)                                  |
| `src/wizard/steps/classe.ts`     | Create           | Step 5 render data (CompendiumIndex classes)                                 |
| `src/wizard/steps/pericias.ts`   | Create           | Step 6 render data (countTreinaveis + buildPericiaSet)                       |
| `templates/wizard/shell.hbs`     | Create           | Outer wizard shell: step nav + content slot                                  |
| `templates/wizard/nivel.hbs`     | Create           | Step 1 template                                                              |
| `templates/wizard/atributos.hbs` | Create           | Step 2 template                                                              |
| `templates/wizard/raca.hbs`      | Create           | Step 3 template                                                              |
| `templates/wizard/origem.hbs`    | Create           | Step 4 template                                                              |
| `templates/wizard/classe.hbs`    | Create           | Step 5 template                                                              |
| `templates/wizard/pericias.hbs`  | Create           | Step 6 template                                                              |
| `src/module.ts`                  | Modify           | Wire WizardApp to launcher button click                                      |
| `src/ui/launcher.ts`             | Modify           | On click: open WizardApp instead of notification                             |
| `lang/pt-BR.json`                | Modify           | Add any missing strings                                                      |
| `test/wizard/state.test.ts`      | Create           | Vitest: WizardState apply/undo/serialize (pure TS parts)                     |

---

### Task 1: `WizardState` + Tests (TDD)

**Files:**

- Create: `src/wizard/state.ts`
- Create: `test/wizard/state.test.ts`

`WizardState` is pure TypeScript — no Foundry imports — fully testable in vitest.

- [ ] **Step 1: Create `test/wizard/state.test.ts`** (write BEFORE impl)

```ts
import { describe, it, expect } from "vitest";
import { WizardState } from "../../src/wizard/state.js";

describe("WizardState", () => {
  it("starts with defaults", () => {
    const s = new WizardState();
    expect(s.nivel).toBe(1);
    expect(s.nome).toBe("");
    expect(s.classeId).toBe("");
    expect(s.racaId).toBe("");
  });

  it("apply sets a field", () => {
    const s = new WizardState();
    s.apply({ nivel: 5, nome: "Aragorn" });
    expect(s.nivel).toBe(5);
    expect(s.nome).toBe("Aragorn");
  });

  it("apply does not reset other fields", () => {
    const s = new WizardState();
    s.apply({ racaId: "humano" });
    s.apply({ classeId: "guerreiro" });
    expect(s.racaId).toBe("humano");
    expect(s.classeId).toBe("guerreiro");
  });

  it("serialize → JSON string", () => {
    const s = new WizardState();
    s.apply({ nome: "Test", nivel: 3 });
    const json = s.serialize();
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.nome).toBe("Test");
    expect(parsed.nivel).toBe(3);
  });

  it("deserialize restores state", () => {
    const s = new WizardState();
    s.apply({ nome: "Gandalf", classeId: "arcanista", nivel: 10 });
    const json = s.serialize();
    const s2 = WizardState.deserialize(json);
    expect(s2.nome).toBe("Gandalf");
    expect(s2.classeId).toBe("arcanista");
    expect(s2.nivel).toBe(10);
  });

  it("isComplete false when required fields empty", () => {
    const s = new WizardState();
    expect(s.isComplete()).toBe(false);
  });

  it("isComplete true when all required fields set", () => {
    const s = new WizardState();
    s.apply({
      nome: "Hero",
      nivel: 1,
      racaId: "humano",
      origemId: "acolito",
      classeId: "guerreiro",
      metodoAtributos: "compra_pontos",
      atributosBase: { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 },
    });
    expect(s.isComplete()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- test/wizard/state.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Create `src/wizard/state.ts`**

Create directory `src/wizard/` first.

```ts
export interface WizardStateData {
  nivel: number;
  nome: string;
  metodoAtributos: string;
  atributosBase: Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;
  racaId: string;
  origemId: string;
  classeId: string;
  subclasseId: string;
  divindadeId: string;
  periciasTreinadas: string[];
  poderes: string[];
  poderesAutoGrant: string[];
  magias: string[];
  equipamento: { itemId: string; qty: number }[];
  dinheiroRestante: number;
  escolhasPorItem: Record<string, unknown>;
  detalhes: Record<string, string>;
}

const DEFAULT_STATE: WizardStateData = {
  nivel: 1,
  nome: "",
  metodoAtributos: "compra_pontos",
  atributosBase: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
  racaId: "",
  origemId: "",
  classeId: "",
  subclasseId: "",
  divindadeId: "",
  periciasTreinadas: [],
  poderes: [],
  poderesAutoGrant: [],
  magias: [],
  equipamento: [],
  dinheiroRestante: 0,
  escolhasPorItem: {},
  detalhes: {},
};

/** Required fields that must be non-empty for isComplete(). */
const REQUIRED_FIELDS: (keyof WizardStateData)[] = ["nome", "racaId", "origemId", "classeId"];

export class WizardState implements WizardStateData {
  nivel!: number;
  nome!: string;
  metodoAtributos!: string;
  atributosBase!: Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;
  racaId!: string;
  origemId!: string;
  classeId!: string;
  subclasseId!: string;
  divindadeId!: string;
  periciasTreinadas!: string[];
  poderes!: string[];
  poderesAutoGrant!: string[];
  magias!: string[];
  equipamento!: { itemId: string; qty: number }[];
  dinheiroRestante!: number;
  escolhasPorItem!: Record<string, unknown>;
  detalhes!: Record<string, string>;

  constructor(initial?: Partial<WizardStateData>) {
    Object.assign(this, structuredClone(DEFAULT_STATE));
    if (initial) Object.assign(this, initial);
  }

  /** Merge partial data into state. */
  apply(patch: Partial<WizardStateData>): void {
    Object.assign(this, patch);
  }

  /** Returns true when all required fields are filled. */
  isComplete(): boolean {
    return REQUIRED_FIELDS.every((f) => {
      const val = this[f];
      return typeof val === "string" ? val.trim().length > 0 : true;
    });
  }

  /** Serialize state to JSON string for flag persistence. */
  serialize(): string {
    const data: WizardStateData = {
      nivel: this.nivel,
      nome: this.nome,
      metodoAtributos: this.metodoAtributos,
      atributosBase: { ...this.atributosBase },
      racaId: this.racaId,
      origemId: this.origemId,
      classeId: this.classeId,
      subclasseId: this.subclasseId,
      divindadeId: this.divindadeId,
      periciasTreinadas: [...this.periciasTreinadas],
      poderes: [...this.poderes],
      poderesAutoGrant: [...this.poderesAutoGrant],
      magias: [...this.magias],
      equipamento: this.equipamento.map((e) => ({ ...e })),
      dinheiroRestante: this.dinheiroRestante,
      escolhasPorItem: { ...this.escolhasPorItem },
      detalhes: { ...this.detalhes },
    };
    return JSON.stringify(data);
  }

  /** Restore state from serialized JSON string. */
  static deserialize(json: string): WizardState {
    const data = JSON.parse(json) as Partial<WizardStateData>;
    return new WizardState(data);
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- test/wizard/state.test.ts
```

All 7 tests must pass.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

All 70 previous tests + 7 new = 77 must pass.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit + push**

```bash
git add src/wizard/state.ts test/wizard/state.test.ts
git commit -m "feat: WizardState class + serialize/deserialize tests (TDD)"
git push origin master
```

---

### Task 2: Handlebars Templates — Shell + Steps 1–6

**Files:**

- Create: `templates/wizard/shell.hbs`
- Create: `templates/wizard/nivel.hbs`
- Create: `templates/wizard/atributos.hbs`
- Create: `templates/wizard/raca.hbs`
- Create: `templates/wizard/origem.hbs`
- Create: `templates/wizard/classe.hbs`
- Create: `templates/wizard/pericias.hbs`

Templates live at repo root `templates/` (served directly by Foundry via junction, not bundled). Foundry path prefix: `modules/t20-ficha-wizard/templates/`.

- [ ] **Step 1: Create `templates/wizard/` directory**

```bash
mkdir -p templates/wizard
```

- [ ] **Step 2: Create `templates/wizard/shell.hbs`**

```hbs
<div class="t20w-wizard" data-step="{{currentStep}}">
  <nav class="t20w-steps">
    {{#each steps}}
      <button
        type="button"
        class="t20w-step-btn {{#if this.active}}active{{/if}} {{#if this.done}}done{{/if}}"
        data-step="{{this.id}}"
        {{#unless this.reachable}}disabled{{/unless}}
      >
        {{this.label}}
      </button>
    {{/each}}
  </nav>

  <div class="t20w-content">
    {{> @partial-block}}
  </div>

  <footer class="t20w-footer">
    {{#if showBack}}
      <button type="button" class="t20w-back">← Voltar</button>
    {{/if}}
    {{#if showNext}}
      <button type="button" class="t20w-next">Próximo →</button>
    {{/if}}
    {{#if showCreate}}
      <button type="button" class="t20w-create">✦ Criar Personagem</button>
    {{/if}}
  </footer>
</div>
```

- [ ] **Step 3: Create `templates/wizard/nivel.hbs`**

```hbs
<section class="t20w-step t20w-step-nivel">
  <h2>{{stepTitle}}</h2>

  <div class="form-group">
    <label for="t20w-nivel">Nível</label>
    <input
      id="t20w-nivel"
      type="number"
      name="nivel"
      min="1"
      max="20"
      value="{{state.nivel}}"
      class="t20w-input"
    />
  </div>

  <div class="form-group">
    <label for="t20w-nome">Nome do Personagem</label>
    <input
      id="t20w-nome"
      type="text"
      name="nome"
      value="{{state.nome}}"
      placeholder="Nome..."
      class="t20w-input"
    />
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">
      {{#each errors}}<li>{{this}}</li>{{/each}}
    </ul>
  {{/if}}
</section>
```

- [ ] **Step 4: Create `templates/wizard/atributos.hbs`**

```hbs
<section class="t20w-step t20w-step-atributos">
  <h2>{{stepTitle}}</h2>

  <div class="form-group">
    <label>Método</label>
    <select name="metodoAtributos" class="t20w-select">
      {{#each metodos}}
        <option value="{{this.id}}" {{#if this.selected}}selected{{/if}}>
          {{this.nome}} ({{this.categoria}})
        </option>
      {{/each}}
    </select>
  </div>

  {{#if isCompra}}
    <table class="t20w-attrs">
      <thead><tr><th>Atributo</th><th>Valor</th><th>Custo</th></tr></thead>
      <tbody>
        {{#each atributos}}
          <tr>
            <td>{{this.label}}</td>
            <td>
              <input type="number" name="attr-{{this.id}}" min="-1" max="4"
                     value="{{this.value}}" class="t20w-attr-input" />
            </td>
            <td>{{this.custo}}</td>
          </tr>
        {{/each}}
      </tbody>
      <tfoot>
        <tr><td colspan="2">Pontos restantes</td><td class="{{#if pontosNegativo}}t20w-over{{/if}}">{{pontosRestantes}}</td></tr>
      </tfoot>
    </table>
  {{else}}
    <p class="t20w-hint">{{metodoDescricao}}</p>
  {{/if}}

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 5: Create `templates/wizard/raca.hbs`**

```hbs
<section class="t20w-step t20w-step-raca">
  <h2>{{stepTitle}}</h2>

  <div class="t20w-item-grid">
    {{#each racas}}
      <label class="t20w-item-card {{#if this.selected}}selected{{/if}}">
        <input type="radio" name="racaId" value="{{this.id}}"
               {{#if this.selected}}checked{{/if}} />
        <img src="{{this.img}}" alt="{{this.name}}" />
        <span>{{this.name}}</span>
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 6: Create `templates/wizard/origem.hbs`**

```hbs
<section class="t20w-step t20w-step-origem">
  <h2>{{stepTitle}}</h2>

  <div class="t20w-list">
    {{#each origens}}
      <label class="t20w-list-item {{#if this.selected}}selected{{/if}}">
        <input type="radio" name="origemId" value="{{this.id}}"
               {{#if this.selected}}checked{{/if}} />
        <strong>{{this.nome}}</strong>
        <small>Perícias: {{this.periciasList}}</small>
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 7: Create `templates/wizard/classe.hbs`**

```hbs
<section class="t20w-step t20w-step-classe">
  <h2>{{stepTitle}}</h2>

  <div class="t20w-item-grid">
    {{#each classes}}
      <label class="t20w-item-card {{#if this.selected}}selected{{/if}}">
        <input type="radio" name="classeId" value="{{this.id}}"
               {{#if this.selected}}checked{{/if}} />
        <img src="{{this.img}}" alt="{{this.name}}" />
        <div>
          <span>{{this.name}}</span>
          <small>PV +{{this.pvPorNivel}} | PM +{{this.pmPorNivel}}</small>
        </div>
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 8: Create `templates/wizard/pericias.hbs`**

```hbs
<section class="t20w-step t20w-step-pericias">
  <h2>{{stepTitle}}</h2>

  <p class="t20w-hint">
    Escolhas restantes: <strong>{{choicesRemaining}}</strong>
  </p>

  <div class="t20w-pericias-list">
    {{#each pericias}}
      <label class="t20w-pericia {{#if this.locked}}locked{{/if}}">
        <input
          type="checkbox"
          name="pericia-{{this.id}}"
          value="{{this.id}}"
          {{#if this.checked}}checked{{/if}}
          {{#if this.locked}}disabled{{/if}}
        />
        {{this.nome}}
        {{#if this.inata}}<span class="t20w-badge">Inata</span>{{/if}}
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 9: Commit + push**

```bash
git add templates/
git commit -m "feat: wizard Handlebars templates (shell + steps 1–6)"
git push origin master
```

---

### Task 3: Step Data Helpers — Steps 1–6

**Files:**

- Create: `src/wizard/steps/nivel.ts`
- Create: `src/wizard/steps/atributos.ts`
- Create: `src/wizard/steps/raca.ts`
- Create: `src/wizard/steps/origem.ts`
- Create: `src/wizard/steps/classe.ts`
- Create: `src/wizard/steps/pericias.ts`

Each file exports a `prepareContext(state, compendiumItems?)` function that returns render data for the corresponding Handlebars template. Pure TypeScript — no Foundry globals — except for passing `CompendiumIndex` results as a parameter.

- [ ] **Step 1: Create `src/wizard/steps/` directory**

```bash
mkdir -p src/wizard/steps
```

- [ ] **Step 2: Create `src/wizard/steps/nivel.ts`**

```ts
import type { WizardState } from "../state.js";

export interface NivelContext {
  stepTitle: string;
  state: { nivel: number; nome: string };
  errors: string[];
}

export function prepareNivelContext(state: WizardState, errors: string[] = []): NivelContext {
  return {
    stepTitle: "Nível & Nome",
    state: { nivel: state.nivel, nome: state.nome },
    errors,
  };
}
```

- [ ] **Step 3: Create `src/wizard/steps/atributos.ts`**

```ts
import { listMetodos, validatePointBuy, pointBuyCost } from "../../rules/atributos.js";
import type { WizardState } from "../state.js";

const ATTR_LABELS: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

export interface AtributosContext {
  stepTitle: string;
  metodos: Array<{ id: string; nome: string; categoria: string; selected: boolean }>;
  isCompra: boolean;
  atributos: Array<{ id: string; label: string; value: number; custo: number }>;
  pontosRestantes: number;
  pontosNegativo: boolean;
  metodoDescricao: string;
  errors: string[];
}

export function prepareAtributosContext(
  state: WizardState,
  errors: string[] = []
): AtributosContext {
  const metodos = listMetodos().map((m) => ({
    id: m.id,
    nome: m.nome,
    categoria: m.categoria,
    selected: m.id === state.metodoAtributos,
  }));

  const isCompra = state.metodoAtributos === "compra_pontos";

  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => {
    const value = state.atributosBase[id] ?? 0;
    let custo = 0;
    try {
      custo = pointBuyCost(value);
    } catch {
      /* invalid value */
    }
    return { id, label: ATTR_LABELS[id], value, custo };
  });

  const pbResult = validatePointBuy(state.atributosBase);

  return {
    stepTitle: "Atributos",
    metodos,
    isCompra,
    atributos,
    pontosRestantes: pbResult.remaining,
    pontosNegativo: pbResult.remaining < 0,
    metodoDescricao: metodos.find((m) => m.selected)?.nome ?? "",
    errors,
  };
}
```

- [ ] **Step 4: Create `src/wizard/steps/raca.ts`**

```ts
import type { WizardState } from "../state.js";
import type { IndexedRace } from "../../compendium/types.js";

export interface RacaContext {
  stepTitle: string;
  racas: Array<{ id: string; name: string; img: string; selected: boolean }>;
  errors: string[];
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = []
): RacaContext {
  return {
    stepTitle: "Raça",
    racas: racas.map((r) => ({
      id: r.id,
      name: r.name,
      img: r.img,
      selected: r.id === state.racaId,
    })),
    errors,
  };
}
```

- [ ] **Step 5: Create `src/wizard/steps/origem.ts`**

```ts
import { listOrigens } from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemContext {
  stepTitle: string;
  origens: Array<{
    id: string;
    nome: string;
    periciasList: string;
    selected: boolean;
  }>;
  errors: string[];
}

export function prepareOrigemContext(state: WizardState, errors: string[] = []): OrigemContext {
  return {
    stepTitle: "Origem",
    origens: listOrigens().map((o) => ({
      id: o.id,
      nome: o.nome,
      periciasList: o.beneficios.pericias.join(", "),
      selected: o.id === state.origemId,
    })),
    errors,
  };
}
```

- [ ] **Step 6: Create `src/wizard/steps/classe.ts`**

```ts
import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface ClasseContext {
  stepTitle: string;
  classes: Array<{
    id: string;
    name: string;
    img: string;
    pvPorNivel: number;
    pmPorNivel: number;
    selected: boolean;
  }>;
  errors: string[];
}

export function prepareClasseContext(
  state: WizardState,
  classes: IndexedClasse[],
  errors: string[] = []
): ClasseContext {
  return {
    stepTitle: "Classe",
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      img: c.img,
      pvPorNivel: c.system.pvPorNivel ?? 0,
      pmPorNivel: c.system.pmPorNivel ?? 0,
      selected: c.id === state.classeId,
    })),
    errors,
  };
}
```

- [ ] **Step 7: Create `src/wizard/steps/pericias.ts`**

```ts
import { countTreinaveis, buildPericiaSet } from "../../rules/pericias.js";
import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface PericiaEntry {
  id: string;
  nome: string;
  checked: boolean;
  locked: boolean;
  inata: boolean;
}

export interface PericiaContext {
  stepTitle: string;
  choicesRemaining: number;
  pericias: PericiaEntry[];
  errors: string[];
}

/** Minimal pericia metadata — display name by id. */
const PERICIA_NOMES: Record<string, string> = {
  acrobacia: "Acrobacia",
  adestramento: "Adestramento",
  atletismo: "Atletismo",
  atuacao: "Atuação",
  cavalgar: "Cavalgar",
  conhecimento: "Conhecimento",
  cura: "Cura",
  diplomacia: "Diplomacia",
  enganacao: "Enganação",
  fortitude: "Fortitude",
  furtividade: "Furtividade",
  guerra: "Guerra",
  iniciativa: "Iniciativa",
  intimidacao: "Intimidação",
  intuicao: "Intuição",
  investigacao: "Investigação",
  jogatina: "Jogatina",
  ladinagem: "Ladinagem",
  luta: "Luta",
  misticismo: "Misticismo",
  nobreza: "Nobreza",
  oficio: "Ofício",
  percepcao: "Percepção",
  pilotagem: "Pilotagem",
  pontaria: "Pontaria",
  reflexos: "Reflexos",
  religiao: "Religião",
  sobrevivencia: "Sobrevivência",
  vontade: "Vontade",
};

export function preparePericiaContext(
  state: WizardState,
  classe: IndexedClasse | undefined,
  intModifier: number,
  errors: string[] = []
): PericiaContext {
  if (!classe) {
    return { stepTitle: "Perícias", choicesRemaining: 0, pericias: [], errors };
  }

  const totalEscolhas = countTreinaveis(classe, intModifier, 0);
  const periciaSet = buildPericiaSet(classe, state.periciasTreinadas, []);
  const allPericias = Array.from(
    new Set([
      ...(classe.system.pericias?.inatas ?? []),
      ...(classe.system.pericias?.escolhas ?? []),
      ...state.periciasTreinadas,
    ])
  ).sort();

  const pericias: PericiaEntry[] = allPericias.map((id) => ({
    id,
    nome: PERICIA_NOMES[id] ?? id,
    checked: periciaSet.treinadas.includes(id),
    locked: periciaSet.inatas.includes(id),
    inata: periciaSet.inatas.includes(id),
  }));

  return {
    stepTitle: "Perícias",
    choicesRemaining: Math.max(0, totalEscolhas - state.periciasTreinadas.length),
    pericias,
    errors,
  };
}
```

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 9: Commit + push**

```bash
git add src/wizard/steps/
git commit -m "feat: wizard step context helpers (steps 1–6)"
git push origin master
```

---

### Task 4: `WizardApp` — ApplicationV2 Shell

**Files:**

- Create: `src/wizard/app.ts`
- Modify: `src/ui/launcher.ts`
- Modify: `src/module.ts`

`WizardApp` extends `ApplicationV2` (with `HandlebarsApplicationMixin`). It manages the current step, renders via PARTS, and handles form submissions.

- [ ] **Step 1: Create `src/wizard/app.ts`**

```ts
import { MODULE_ID } from "../constants.js";
import { WizardState } from "./state.js";
import { WizardStep, STEP_ORDER, STEP_META } from "../rules/steps.js";
import { CompendiumIndex } from "../compendium/index.js";
import { validate } from "../rules/engine.js";
import { prepareNivelContext } from "./steps/nivel.js";
import { prepareAtributosContext } from "./steps/atributos.js";
import { prepareRacaContext } from "./steps/raca.js";
import { prepareOrigemContext } from "./steps/origem.js";
import { prepareClasseContext } from "./steps/classe.js";
import { preparePericiaContext } from "./steps/pericias.js";
import type { IndexedClasse, IndexedRace } from "../compendium/types.js";

const TPL = (name: string) => `modules/${MODULE_ID}/templates/wizard/${name}.hbs`;

// @ts-expect-error fvtt-types ApplicationV2/HandlebarsApplicationMixin incomplete for v13
export class WizardApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    id: "t20w-wizard",
    window: { title: "T20W: Criar Personagem" },
    position: { width: 720, height: 600 },
  };

  static override PARTS = {
    shell: { template: TPL("shell") },
    nivel: { template: TPL("nivel") },
    atributos: { template: TPL("atributos") },
    raca: { template: TPL("raca") },
    origem: { template: TPL("origem") },
    classe: { template: TPL("classe") },
    pericias: { template: TPL("pericias") },
  };

  private _state = new WizardState();
  private _currentStep: WizardStep = WizardStep.Nivel;
  private _errors: string[] = [];

  /** Navigate to a specific step. */
  goToStep(step: WizardStep): void {
    this._currentStep = step;
    this._errors = [];
    this.render();
  }

  /** Advance to next step after validation. */
  async nextStep(): Promise<void> {
    const result = validate(this._currentStep, this._state as Parameters<typeof validate>[1]);
    if (!result.valid) {
      this._errors = result.errors;
      this.render();
      return;
    }
    const idx = STEP_ORDER.indexOf(this._currentStep);
    if (idx < STEP_ORDER.length - 1) {
      this._currentStep = STEP_ORDER[idx + 1];
      this._errors = [];
      this.render();
    }
  }

  /** Go back to previous step. */
  prevStep(): void {
    const idx = STEP_ORDER.indexOf(this._currentStep);
    if (idx > 0) {
      this._currentStep = STEP_ORDER[idx - 1];
      this._errors = [];
      this.render();
    }
  }

  /** Apply submitted form data to state. */
  applyFormData(formData: FormData): void {
    const nivel = parseInt((formData.get("nivel") as string) ?? "1", 10);
    const nome = ((formData.get("nome") as string) ?? "").trim();
    const metodoAtributos =
      (formData.get("metodoAtributos") as string) ?? this._state.metodoAtributos;
    const racaId = (formData.get("racaId") as string) ?? this._state.racaId;
    const origemId = (formData.get("origemId") as string) ?? this._state.origemId;
    const classeId = (formData.get("classeId") as string) ?? this._state.classeId;

    // Atributos
    const atributosBase = { ...this._state.atributosBase };
    for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
      const v = formData.get(`attr-${attr}`);
      if (v !== null) atributosBase[attr] = parseInt(v as string, 10);
    }

    // Péricias checkboxes
    const periciasTreinadas: string[] = [];
    for (const [key, val] of formData.entries()) {
      if (key.startsWith("pericia-") && val) {
        periciasTreinadas.push(key.replace("pericia-", ""));
      }
    }

    this._state.apply({
      ...(formData.has("nivel") && { nivel }),
      ...(formData.has("nome") && { nome }),
      ...(formData.has("metodoAtributos") && { metodoAtributos }),
      ...(formData.has("racaId") && { racaId }),
      ...(formData.has("origemId") && { origemId }),
      ...(formData.has("classeId") && { classeId }),
      atributosBase,
      ...(periciasTreinadas.length > 0 && { periciasTreinadas }),
    });
  }

  // @ts-expect-error fvtt-types _prepareContext signature not fully typed for v13
  override async _prepareContext(_options: unknown): Promise<unknown> {
    const step = this._currentStep;
    const state = this._state;
    const errors = this._errors;

    const stepIdx = STEP_ORDER.indexOf(step);
    const steps = STEP_ORDER.map((s, i) => ({
      id: s,
      label: STEP_META[s].labelKey,
      active: s === step,
      done: i < stepIdx,
      reachable: i <= stepIdx,
    }));

    // Step-specific context
    let stepCtx: unknown = {};
    switch (step) {
      case WizardStep.Nivel:
        stepCtx = prepareNivelContext(state, errors);
        break;
      case WizardStep.Atributos:
        stepCtx = prepareAtributosContext(state, errors);
        break;
      case WizardStep.Raca: {
        const racas = CompendiumIndex.getAll("race") as IndexedRace[];
        stepCtx = prepareRacaContext(state, racas, errors);
        break;
      }
      case WizardStep.Origem:
        stepCtx = prepareOrigemContext(state, errors);
        break;
      case WizardStep.Classe: {
        const classes = CompendiumIndex.getAll("classe") as IndexedClasse[];
        stepCtx = prepareClasseContext(state, classes, errors);
        break;
      }
      case WizardStep.Pericias: {
        const classe = CompendiumIndex.getAll("classe").find((c) => c.id === state.classeId) as
          | IndexedClasse
          | undefined;
        const intMod = state.atributosBase.int ?? 0;
        stepCtx = preparePericiaContext(state, classe, intMod, errors);
        break;
      }
    }

    return {
      currentStep: step,
      steps,
      showBack: stepIdx > 0,
      showNext: stepIdx < STEP_ORDER.length - 1,
      showCreate: stepIdx === STEP_ORDER.length - 1,
      ...stepCtx,
    };
  }

  // @ts-expect-error fvtt-types _onClickAction signature not typed for v13
  override _onClickAction(event: MouseEvent, target: HTMLElement): void {
    event.preventDefault();
    const action = target.dataset["action"];
    if (action === "next") void this.nextStep();
    else if (action === "back") this.prevStep();
    else if (action === "goStep") {
      const s = target.dataset["step"] as WizardStep;
      if (s) this.goToStep(s);
    }
  }
}

/** Singleton instance — one wizard at a time. */
let _instance: WizardApp | null = null;

export function openWizard(): void {
  if (!_instance || !_instance.rendered) {
    _instance = new WizardApp();
  }
  _instance.render(true);
}
```

- [ ] **Step 2: Update `src/ui/launcher.ts`** — replace notification with `openWizard()`

Read current launcher.ts. Replace the click handler body. The import changes from MODULE_ID-only to also import openWizard:

```ts
import { MODULE_ID } from "../constants.js";
import { openWizard } from "../wizard/app.js";

export function registerLauncher(): void {
  Hooks.on("renderActorDirectory", (_app: unknown, html: HTMLElement) => {
    if (html.querySelector(".t20w-launcher-footer")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t20w-open-wizard";
    btn.style.cssText = "width: 100%; margin-top: 4px;";
    btn.innerHTML = `<i class="fas fa-hat-wizard"></i> ${game.i18n!.localize("T20W.OpenWizard")}`;
    btn.addEventListener("click", () => {
      openWizard();
    });

    const footer = document.createElement("div");
    footer.className = "t20w-launcher-footer";
    footer.style.cssText = "padding: 8px 4px 4px;";
    footer.appendChild(btn);

    html.appendChild(footer);
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

If `HandlebarsApplicationMixin` or `ApplicationV2` cause errors beyond `@ts-expect-error`, add more suppressors as needed. The goal: no src/ errors except `@ts-expect-error` usage.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: dist/module.js rebuilds.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

All tests must still pass (77+).

- [ ] **Step 6: Commit + push**

```bash
git add src/wizard/app.ts src/ui/launcher.ts
git commit -m "feat: WizardApp ApplicationV2 shell + launcher wired"
git push origin master
```

---

### Task 5: Final Checks + Tag

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: only pre-existing node_modules errors + intentional `@ts-expect-error` suppressors.

- [ ] **Step 3: Format**

```bash
npm run format
```

Commit if changed: `git add -A && git commit -m "chore: format" && git push origin master`

- [ ] **Step 4: Tag**

```bash
git tag v0.3.0-plan3
git push origin --tags
```

---

## Spec Coverage Check

| Spec requirement                                   | Task   |
| -------------------------------------------------- | ------ |
| `WizardState` with all fields from spec            | Task 1 |
| `serialize()`/`deserialize()` for resume           | Task 1 |
| `isComplete()` validation                          | Task 1 |
| Handlebars templates for steps 1–6                 | Task 2 |
| Step context helpers (pure TS, no Foundry globals) | Task 3 |
| `WizardApp` extends `ApplicationV2` with PARTS     | Task 4 |
| Step navigation (next/back/goStep)                 | Task 4 |
| `validate()` called before advancing               | Task 4 |
| Launcher button opens wizard (not notification)    | Task 4 |
| CompendiumIndex supplies race/class lists          | Task 4 |

**Out of scope for Plan 3 (Plan 4):**

- Steps 7–11 (Divindade, Poderes, Magias, Equipamento, Revisão)
- `ActorWriter.create()` → Actor.create()
- `subescolhas.ts` full implementation
- `game.modules.get(MODULE_ID).api` exposure
- Resume via `game.user.setFlag`
