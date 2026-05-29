# T20 Ficha Wizard — Plan 4: Steps 7–11 + ActorWriter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement wizard steps 7–11 (Divindade, Poderes, Magias, Equipamento, Revisão) with Handlebars templates, wire them into `WizardApp`, and implement `ActorWriter` which translates `WizardState` into a `tormenta20` actor via `Actor.create()`. At the end, the full wizard runs end-to-end: clicking "Criar Personagem" on the Revisão step creates a playable Foundry actor.

**Architecture:** Steps 7–11 follow the same pattern as 1–6 — context helpers in `src/wizard/steps/` + Handlebars in `templates/wizard/`. `ActorWriter` lives in `src/actor/` and calls `pack.getDocument(id)` for full item data, then calls `Actor.create()`. `mapper.ts` converts `WizardState` to the `tormenta20` schema. `WizardApp` is extended to handle the remaining steps and the final "create" action.

**Tech Stack:** TypeScript strict, Vite 5, vitest 1.x, Foundry v13 ApplicationV2, Handlebars, fvtt-types pinned.

**Key Foundry facts (tormenta20 v1.5.015):**

- Actor type: `"character"`
- Atributos: write only `system.atributos.{attr}.base` (system derives `.value`)
- Nível: `system.attributes.nivel.value`
- Detalhes: `system.detalhes.{raca,origem,divindade}`
- Dinheiro: `system.dinheiro.{tc,tl,to,tp}` — dinheiro inicial goes to `tl` (T$)
- Items array: `.toObject()` from pack.getDocument

---

## File Map

| File                               | Created/Modified | Responsibility                                              |
| ---------------------------------- | ---------------- | ----------------------------------------------------------- |
| `src/wizard/steps/divindade.ts`    | Create           | Step 7 render data (listDivindadesParaPersonagem)           |
| `src/wizard/steps/poderes.ts`      | Create           | Step 8 render data (isEligible + power list)                |
| `src/wizard/steps/magias.ts`       | Create           | Step 9 render data (filterMagias)                           |
| `src/wizard/steps/equipamento.ts`  | Create           | Step 10 render data (equipamento list + carrinho)           |
| `src/wizard/steps/revisao.ts`      | Create           | Step 11 render data (full summary)                          |
| `templates/wizard/divindade.hbs`   | Create           | Step 7 template                                             |
| `templates/wizard/poderes.hbs`     | Create           | Step 8 template                                             |
| `templates/wizard/magias.hbs`      | Create           | Step 9 template                                             |
| `templates/wizard/equipamento.hbs` | Create           | Step 10 template                                            |
| `templates/wizard/revisao.hbs`     | Create           | Step 11 template                                            |
| `src/actor/mapper.ts`              | Create           | WizardState → tormenta20 ActorCreateData                    |
| `src/actor/writer.ts`              | Create           | ActorWriter.create(state) → Actor.create()                  |
| `src/wizard/app.ts`                | Modify           | Add steps 7–11 to \_prepareContext + handle "create" action |

---

### Task 1: Step Context Helpers — Steps 7–11

**Files:**

- Create: `src/wizard/steps/divindade.ts`
- Create: `src/wizard/steps/poderes.ts`
- Create: `src/wizard/steps/magias.ts`
- Create: `src/wizard/steps/equipamento.ts`
- Create: `src/wizard/steps/revisao.ts`

- [ ] **Step 1: Create `src/wizard/steps/divindade.ts`**

```ts
import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  type Divindade,
} from "../../rules/divindade.js";
import type { WizardState } from "../state.js";

export interface DivindadeContext {
  stepTitle: string;
  obrigatoria: boolean;
  divindades: Array<{
    id: string;
    nome: string;
    poderesCount: number;
    selected: boolean;
  }>;
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = []
): DivindadeContext {
  const divindades = listDivindadesParaPersonagem(state.racaId, state.classeId);
  return {
    stepTitle: "Divindade",
    obrigatoria: isDivindadeObrigatoria(state.classeId),
    divindades: divindades.map((d: Divindade) => ({
      id: d.id,
      nome: d.nome,
      poderesCount: d.poderes_concedidos.length,
      selected: d.id === state.divindadeId,
    })),
    errors,
  };
}
```

- [ ] **Step 2: Create `src/wizard/steps/poderes.ts`**

```ts
import { isEligible } from "../../rules/poderes.js";
import type { WizardState } from "../state.js";
import type { IndexedPoder } from "../../compendium/types.js";

export interface PoderEntry {
  id: string;
  name: string;
  img: string;
  eligible: boolean;
  selected: boolean;
}

export interface PoderesContext {
  stepTitle: string;
  poderes: PoderEntry[];
  selectedCount: number;
  errors: string[];
}

export function preparePoderesContext(
  state: WizardState,
  poderes: IndexedPoder[],
  errors: string[] = []
): PoderesContext {
  const stateForEligibility = {
    nivel: state.nivel,
    atributosBase: state.atributosBase,
    classeId: state.classeId,
    racaId: state.racaId,
    periciasTreinadas: state.periciasTreinadas,
    poderes: state.poderes,
  };

  const entries: PoderEntry[] = poderes.map((p) => ({
    id: p.id,
    name: p.name,
    img: p.img,
    eligible: isEligible(p.name.toLowerCase().replace(/\s+/g, "_"), stateForEligibility),
    selected: state.poderes.includes(p.id),
  }));

  return {
    stepTitle: "Poderes",
    poderes: entries,
    selectedCount: state.poderes.length,
    errors,
  };
}
```

- [ ] **Step 3: Create `src/wizard/steps/magias.ts`**

```ts
import { filterMagias, isConjurador } from "../../rules/magias.js";
import type { WizardState } from "../state.js";
import type { IndexedMagia } from "../../compendium/types.js";

export interface MagiaEntry {
  id: string;
  name: string;
  img: string;
  circulo: number;
  escola: string;
  tipo: string;
  selected: boolean;
}

export interface MagiasContext {
  stepTitle: string;
  isConjurador: boolean;
  magias: MagiaEntry[];
  selectedCount: number;
  errors: string[];
}

export function prepareMagiasContext(
  state: WizardState,
  allMagias: IndexedMagia[],
  errors: string[] = []
): MagiasContext {
  const conjurador = isConjurador(state.classeId);
  const filtered = conjurador ? filterMagias(allMagias, state.classeId, state.nivel) : [];

  return {
    stepTitle: "Magias",
    isConjurador: conjurador,
    magias: filtered.map((m) => ({
      id: m.id,
      name: m.name,
      img: m.img,
      circulo: m.system.circulo ?? 0,
      escola: m.system.escola ?? "",
      tipo: m.system.tipo ?? "",
      selected: state.magias.includes(m.id),
    })),
    selectedCount: state.magias.length,
    errors,
  };
}
```

- [ ] **Step 4: Create `src/wizard/steps/equipamento.ts`**

```ts
import type { WizardState } from "../state.js";
import type { AnyIndexed } from "../../compendium/types.js";

export interface EquipamentoEntry {
  id: string;
  name: string;
  img: string;
  preco: number;
  qty: number;
  inCart: boolean;
  affordable: boolean;
}

export interface EquipamentoContext {
  stepTitle: string;
  saldo: number;
  itens: EquipamentoEntry[];
  carrinho: Array<{ id: string; name: string; qty: number; subtotal: number }>;
  totalCarrinho: number;
  errors: string[];
}

export function prepareEquipamentoContext(
  state: WizardState,
  allEquipamento: AnyIndexed[],
  errors: string[] = []
): EquipamentoContext {
  const cartMap = new Map(state.equipamento.map((e) => [e.itemId, e.qty]));

  const itens: EquipamentoEntry[] = allEquipamento
    .filter((i) => ["equipamento", "arma", "consumivel", "tesouro"].includes(i.type))
    .map((i) => {
      const preco = (i as { system: { preco?: number } }).system?.preco ?? 0;
      const qty = cartMap.get(i.id) ?? 0;
      return {
        id: i.id,
        name: i.name,
        img: i.img,
        preco,
        qty,
        inCart: qty > 0,
        affordable: preco <= state.dinheiroRestante,
      };
    });

  const carrinho = state.equipamento.map((e) => {
    const item = allEquipamento.find((i) => i.id === e.itemId);
    const preco = (item as { system: { preco?: number } } | undefined)?.system?.preco ?? 0;
    return {
      id: e.itemId,
      name: item?.name ?? e.itemId,
      qty: e.qty,
      subtotal: preco * e.qty,
    };
  });

  const totalCarrinho = carrinho.reduce((sum, e) => sum + e.subtotal, 0);

  return {
    stepTitle: "Equipamento",
    saldo: state.dinheiroRestante,
    itens,
    carrinho,
    totalCarrinho,
    errors,
  };
}
```

- [ ] **Step 5: Create `src/wizard/steps/revisao.ts`**

```ts
import { getOrigem } from "../../rules/origem.js";
import { getDivindade } from "../../rules/divindade.js";
import type { WizardState } from "../state.js";

export interface RevisaoContext {
  stepTitle: string;
  nome: string;
  nivel: number;
  racaNome: string;
  origemNome: string;
  classeNome: string;
  divindadeNome: string;
  atributos: Array<{ label: string; value: number }>;
  poderesSelecionados: number;
  magiasSelecionadas: number;
  equipamentoSelecionado: number;
  dinheiroRestante: number;
  isComplete: boolean;
  errors: string[];
}

const ATTR_LABELS: Record<string, string> = {
  for: "For",
  des: "Des",
  con: "Con",
  int: "Int",
  sab: "Sab",
  car: "Car",
};

export function prepareRevisaoContext(
  state: WizardState,
  racaNome: string,
  classeNome: string,
  errors: string[] = []
): RevisaoContext {
  const origem = getOrigem(state.origemId);
  const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;

  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => ({
    label: ATTR_LABELS[id],
    value: state.atributosBase[id] ?? 0,
  }));

  return {
    stepTitle: "Revisão",
    nome: state.nome,
    nivel: state.nivel,
    racaNome,
    origemNome: origem?.nome ?? state.origemId,
    classeNome,
    divindadeNome: divindade?.nome ?? "—",
    atributos,
    poderesSelecionados: state.poderes.length,
    magiasSelecionadas: state.magias.length,
    equipamentoSelecionado: state.equipamento.length,
    dinheiroRestante: state.dinheiroRestante,
    isComplete: state.isComplete(),
    errors,
  };
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 7: Commit + push**

```bash
git add src/wizard/steps/
git commit -m "feat: wizard step context helpers (steps 7–11)"
git push origin master
```

---

### Task 2: Handlebars Templates — Steps 7–11

**Files:**

- Create: `templates/wizard/divindade.hbs`
- Create: `templates/wizard/poderes.hbs`
- Create: `templates/wizard/magias.hbs`
- Create: `templates/wizard/equipamento.hbs`
- Create: `templates/wizard/revisao.hbs`

- [ ] **Step 1: Create `templates/wizard/divindade.hbs`**

```hbs
<section class="t20w-step t20w-step-divindade">
  <h2>{{stepTitle}}</h2>

  {{#if obrigatoria}}
    <p class="t20w-hint t20w-required">⚠ Esta classe exige uma divindade.</p>
  {{else}}
    <p class="t20w-hint">Opcional — pule se não quiser ser devoto.</p>
  {{/if}}

  <div class="t20w-list">
    {{#each divindades}}
      <label class="t20w-list-item {{#if this.selected}}selected{{/if}}">
        <input type="radio" name="divindadeId" value="{{this.id}}"
               {{#if this.selected}}checked{{/if}} />
        <strong>{{this.nome}}</strong>
        <small>{{this.poderesCount}} poder(es) concedido(s)</small>
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 2: Create `templates/wizard/poderes.hbs`**

```hbs
<section class="t20w-step t20w-step-poderes">
  <h2>{{stepTitle}}</h2>

  <p class="t20w-hint">Selecionados: <strong>{{selectedCount}}</strong></p>

  <div class="t20w-item-grid">
    {{#each poderes}}
      <label class="t20w-item-card {{#if this.selected}}selected{{/if}} {{#unless this.eligible}}ineligible{{/unless}}">
        <input type="checkbox" name="poder-{{this.id}}" value="{{this.id}}"
               {{#if this.selected}}checked{{/if}} />
        <img src="{{this.img}}" alt="{{this.name}}" />
        <span>{{this.name}}</span>
        {{#unless this.eligible}}
          <small class="t20w-ineligible">Pré-requisito não atendido</small>
        {{/unless}}
      </label>
    {{/each}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 3: Create `templates/wizard/magias.hbs`**

```hbs
<section class="t20w-step t20w-step-magias">
  <h2>{{stepTitle}}</h2>

  {{#if isConjurador}}
    <p class="t20w-hint">Selecionadas: <strong>{{selectedCount}}</strong></p>

    <div class="t20w-list">
      {{#each magias}}
        <label class="t20w-list-item {{#if this.selected}}selected{{/if}}">
          <input type="checkbox" name="magia-{{this.id}}" value="{{this.id}}"
                 {{#if this.selected}}checked{{/if}} />
          <strong>{{this.name}}</strong>
          <small>Círculo {{this.circulo}} · {{this.escola}} · {{this.tipo}}</small>
        </label>
      {{/each}}
    </div>
  {{else}}
    <p class="t20w-hint">Sua classe não conjura magias. Clique em Próximo.</p>
  {{/if}}

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 4: Create `templates/wizard/equipamento.hbs`**

```hbs
<section class="t20w-step t20w-step-equipamento">
  <h2>{{stepTitle}}</h2>

  <p class="t20w-hint">Saldo: <strong>T$ {{saldo}}</strong></p>

  <div class="t20w-equipment-layout">
    <div class="t20w-shop">
      {{#each itens}}
        <label class="t20w-shop-item {{#unless this.affordable}}t20w-disabled{{/unless}}">
          <input type="checkbox" name="equip-{{this.id}}" value="{{this.id}}"
                 {{#if this.inCart}}checked{{/if}}
                 {{#unless this.affordable}}disabled{{/unless}} />
          <img src="{{this.img}}" alt="{{this.name}}" />
          <span>{{this.name}}</span>
          <small>T$ {{this.preco}}</small>
        </label>
      {{/each}}
    </div>

    {{#if carrinho.length}}
      <aside class="t20w-cart">
        <h3>Carrinho</h3>
        <ul>
          {{#each carrinho}}
            <li>{{this.name}} ×{{this.qty}} — T$ {{this.subtotal}}</li>
          {{/each}}
        </ul>
        <strong>Total: T$ {{totalCarrinho}}</strong>
      </aside>
    {{/if}}
  </div>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 5: Create `templates/wizard/revisao.hbs`**

```hbs
<section class="t20w-step t20w-step-revisao">
  <h2>{{stepTitle}}</h2>

  <dl class="t20w-summary">
    <dt>Nome</dt><dd>{{nome}}</dd>
    <dt>Nível</dt><dd>{{nivel}}</dd>
    <dt>Raça</dt><dd>{{racaNome}}</dd>
    <dt>Origem</dt><dd>{{origemNome}}</dd>
    <dt>Classe</dt><dd>{{classeNome}}</dd>
    {{#if divindadeNome}}
      <dt>Divindade</dt><dd>{{divindadeNome}}</dd>
    {{/if}}
  </dl>

  <table class="t20w-attrs-summary">
    <tbody>
      {{#each atributos}}
        <tr><th>{{this.label}}</th><td>{{this.value}}</td></tr>
      {{/each}}
    </tbody>
  </table>

  <ul class="t20w-summary-counts">
    <li>Poderes: {{poderesSelecionados}}</li>
    <li>Magias: {{magiasSelecionadas}}</li>
    <li>Equipamento: {{equipamentoSelecionado}} item(s)</li>
    <li>Dinheiro restante: T$ {{dinheiroRestante}}</li>
  </ul>

  {{#if errors.length}}
    <ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>
  {{/if}}
</section>
```

- [ ] **Step 6: Commit + push**

```bash
git add templates/wizard/
git commit -m "feat: wizard Handlebars templates (steps 7–11)"
git push origin master
```

---

### Task 3: `src/actor/mapper.ts` + `src/actor/writer.ts`

**Files:**

- Create: `src/actor/mapper.ts`
- Create: `src/actor/writer.ts`

`mapper.ts` is pure TypeScript (testable). `writer.ts` calls Foundry APIs.

- [ ] **Step 1: Create `src/actor/mapper.ts`**

```ts
import { CHARACTER_TYPE } from "../constants.js";
import type { WizardState } from "../wizard/state.js";

/** Output shape consumed by Actor.create() for tormenta20 system. */
export interface ActorCreateData {
  name: string;
  type: "character";
  system: {
    atributos: Record<"for" | "des" | "con" | "int" | "sab" | "car", { base: number }>;
    attributes: {
      nivel: { value: number };
    };
    detalhes: {
      raca: string;
      origem: string;
      divindade: string;
    };
    dinheiro: {
      tc: number;
      tl: number;
      to: number;
      tp: number;
    };
  };
  items: unknown[]; // Item.toObject() results
}

/**
 * Converts WizardState into the data shape expected by tormenta20 Actor.create().
 * Items array is injected separately by writer.ts after resolving from packs.
 */
export function mapStateToActorData(state: WizardState, items: unknown[] = []): ActorCreateData {
  const atributos = {} as ActorCreateData["system"]["atributos"];
  for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
    atributos[attr] = { base: state.atributosBase[attr] ?? 0 };
  }

  return {
    name: state.nome || "Novo Personagem",
    type: CHARACTER_TYPE,
    system: {
      atributos,
      attributes: {
        nivel: { value: state.nivel },
      },
      detalhes: {
        raca: state.racaId,
        origem: state.origemId,
        divindade: state.divindadeId ?? "",
      },
      dinheiro: {
        tc: 0,
        tl: state.dinheiroRestante,
        to: 0,
        tp: 0,
      },
    },
    items,
  };
}
```

- [ ] **Step 2: Create `src/actor/writer.ts`**

```ts
import { MODULE_ID } from "../constants.js";
import { mapStateToActorData } from "./mapper.js";
import type { WizardState } from "../wizard/state.js";

/**
 * Resolves a compendium item id to its full document object.
 * Returns null if the pack or document is not found.
 */
async function resolveItem(itemId: string): Promise<unknown | null> {
  // itemId format: just the document _id — search all Item packs
  // @ts-expect-error fvtt-types game.packs incomplete for v13
  for (const pack of game.packs as Collection<CompendiumCollection<Item>>) {
    if (pack.documentName !== "Item") continue;
    try {
      // @ts-expect-error fvtt-types getDocument not typed for v13
      const doc = await pack.getDocument(itemId);
      if (doc) return doc.toObject();
    } catch {
      // not in this pack
    }
  }
  return null;
}

/**
 * Creates a tormenta20 character actor from the given wizard state.
 * Resolves all item ids from compendium packs before calling Actor.create().
 */
export class ActorWriter {
  static async create(state: WizardState): Promise<void> {
    const missingItems: string[] = [];

    // IDs to resolve: race, class, powers, spells, equipment
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
      // @ts-expect-error fvtt-types ui.notifications incomplete for v13
      ui.notifications!.warn(
        `T20W: ${missingItems.length} item(s) não encontrado(s). Actor criado sem eles.`
      );
    }

    const data = mapStateToActorData(state, resolvedItems);

    // @ts-expect-error fvtt-types Actor.create signature not typed for v13
    const actor = await Actor.create(data);

    if (actor) {
      // @ts-expect-error fvtt-types actor.sheet not typed for v13
      actor.sheet?.render(true);
      console.log(`${MODULE_ID} | ActorWriter: created actor "${actor.name}" (${actor.id})`);
    }
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean (only pre-existing node_modules + intentional `@ts-expect-error`).

- [ ] **Step 4: Commit + push**

```bash
git add src/actor/mapper.ts src/actor/writer.ts
git commit -m "feat: ActorWriter + mapper — WizardState → Actor.create()"
git push origin master
```

---

### Task 4: Extend `WizardApp` for Steps 7–11 + Create Action

**Files:**

- Modify: `src/wizard/app.ts`

Read current `src/wizard/app.ts` and extend it to handle steps 7–11 in `_prepareContext` and handle the "create" action.

- [ ] **Step 1: Read current `src/wizard/app.ts`**

Read the file to understand current structure before editing.

- [ ] **Step 2: Add imports to `src/wizard/app.ts`**

Add these imports after existing ones:

```ts
import { prepareDivindadeContext } from "./steps/divindade.js";
import { preparePoderesContext } from "./steps/poderes.js";
import { prepareMagiasContext } from "./steps/magias.js";
import { prepareEquipamentoContext } from "./steps/equipamento.js";
import { prepareRevisaoContext } from "./steps/revisao.js";
import { ActorWriter } from "../actor/writer.js";
import type { IndexedPoder, IndexedMagia } from "../compendium/types.js";
```

Also update the TPL PARTS static to include the 5 new templates:

```ts
static override PARTS = {
  shell:       { template: TPL("shell") },
  nivel:       { template: TPL("nivel") },
  atributos:   { template: TPL("atributos") },
  raca:        { template: TPL("raca") },
  origem:      { template: TPL("origem") },
  classe:      { template: TPL("classe") },
  pericias:    { template: TPL("pericias") },
  divindade:   { template: TPL("divindade") },
  poderes:     { template: TPL("poderes") },
  magias:      { template: TPL("magias") },
  equipamento: { template: TPL("equipamento") },
  revisao:     { template: TPL("revisao") },
};
```

- [ ] **Step 3: Extend `_prepareContext` switch with steps 7–11**

In the existing `_prepareContext` method, add cases after `WizardStep.Pericias`:

```ts
case WizardStep.Divindade:
  stepCtx = prepareDivindadeContext(state, errors);
  break;

case WizardStep.Poderes: {
  const poderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
  stepCtx = preparePoderesContext(state, poderes, errors);
  break;
}

case WizardStep.Magias: {
  const magias = CompendiumIndex.getAll("magia") as IndexedMagia[];
  stepCtx = prepareMagiasContext(state, magias, errors);
  break;
}

case WizardStep.Equipamento: {
  const allEquip = [
    ...CompendiumIndex.getAll("equipamento"),
    ...CompendiumIndex.getAll("arma"),
    ...CompendiumIndex.getAll("consumivel"),
  ];
  stepCtx = prepareEquipamentoContext(state, allEquip, errors);
  break;
}

case WizardStep.Revisao: {
  const racaItem = CompendiumIndex.getAll("race").find((r) => r.id === state.racaId);
  const classeItem = CompendiumIndex.getAll("classe").find((c) => c.id === state.classeId);
  stepCtx = prepareRevisaoContext(
    state,
    racaItem?.name ?? state.racaId,
    classeItem?.name ?? state.classeId,
    errors
  );
  break;
}
```

- [ ] **Step 4: Add "create" action to `_onClickAction`**

In the existing `_onClickAction` method, add:

```ts
else if (action === "create") {
  if (!state.isComplete()) {
    this._errors = ["Preencha todos os campos obrigatórios antes de criar o personagem."];
    this.render();
    return;
  }
  void ActorWriter.create(this._state).then(() => this.close());
}
```

Also handle form data for steps 7–11 in `applyFormData`:

```ts
// Divindade
const divindadeId = (formData.get("divindadeId") as string) ?? this._state.divindadeId;
if (formData.has("divindadeId")) this._state.apply({ divindadeId });

// Poderes
const poderes: string[] = [];
for (const [key] of formData.entries()) {
  if (key.startsWith("poder-")) poderes.push(key.replace("poder-", ""));
}
if (poderes.length > 0) this._state.apply({ poderes });

// Magias
const magias: string[] = [];
for (const [key] of formData.entries()) {
  if (key.startsWith("magia-")) magias.push(key.replace("magia-", ""));
}
if (magias.length > 0) this._state.apply({ magias });
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Fix any errors. Expected: clean src/ (only node_modules + intentional suppressors).

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: dist/module.js rebuilt.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

All 77 tests must still pass.

- [ ] **Step 8: Commit + push**

```bash
git add src/wizard/app.ts
git commit -m "feat: WizardApp extended with steps 7–11 + create action"
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

Expected: only pre-existing node_modules errors.

- [ ] **Step 3: Format**

```bash
npm run format
```

Commit if changed: `git add -A && git commit -m "chore: format" && git push origin master`

- [ ] **Step 4: Final tag**

```bash
git tag v0.4.0-plan4
git push origin --tags
```

---

## Spec Coverage Check

| Spec requirement                                                             | Task  |
| ---------------------------------------------------------------------------- | ----- |
| Step 7: Divindade (filtro devotos, obrigatória para clerigo/paladino/druida) | T1+T2 |
| Step 8: Poderes (pré-requisitos, inelegível marcado não bloqueado)           | T1+T2 |
| Step 9: Magias (só se conjuradora, filtro círculo/tipo)                      | T1+T2 |
| Step 10: Equipamento (loja por categoria, carrinho, saldo)                   | T1+T2 |
| Step 11: Revisão (resumo, botão "Criar Personagem")                          | T1+T2 |
| `mapper.ts` — atributos.base, nivel, detalhes.\*, dinheiro.tl                | T3    |
| `writer.ts` — resolveItem, Actor.create(), sheet render                      | T3    |
| WizardApp handles all 11 steps + create action                               | T4    |

**Out of scope (post-MVP):**

- `subescolhas.ts` full implementation (especialista, familiar, etc.)
- `game.modules.get(MODULE_ID).api` exposure
- Resume via `game.user.setFlag`
- Multipath subclasse selection
