# T20 Ficha Wizard — Plan 5: Bug Fixes + UX Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken wizard screens and replace unusable UIs with select+detail pattern. After this plan, all 11 steps are navigable and functional.

**Root causes:**

1. `pericias.inatas` in tormenta20 items is a comma/space string, not array — spread character-by-character
2. Raça/Origem/Classe/Divindade rendered as radio grids with 100+ items — unusable
3. Poderes renders image-only grid, no names, no eligibility text
4. Sub-choices (raça free attribute, origem pick-2 powers) not implemented
5. CompendiumIndex `system.pericias` field may need deeper path spec

**Rule:** After every commit → `git push origin master`

---

## File Map

| File                               | Action   | Change                                                           |
| ---------------------------------- | -------- | ---------------------------------------------------------------- |
| `scripts/port-t20db.mjs`           | Modify   | Add `racas.json` export (raça sub-choices)                       |
| `src/data/racas.json`              | Generate | Raça sub-choices from T20-DB                                     |
| `src/data/progressao_classes.json` | Generate | Full class progressão (perícias + levels)                        |
| `src/rules/pericias.ts`            | Modify   | Handle string/array inatas + use data fallback                   |
| `src/rules/origem.ts`              | Modify   | getPick2Options() — 2 of N powers to choose                      |
| `src/wizard/steps/pericias.ts`     | Modify   | Fix inatas/escolhas parsing                                      |
| `src/wizard/steps/raca.ts`         | Modify   | Add subescolhas (free atrib, variants)                           |
| `src/wizard/steps/origem.ts`       | Modify   | Add pick-2 UI data                                               |
| `templates/wizard/wizard.hbs`      | Modify   | All steps: select+detail instead of radio grid; list for poderes |
| `src/wizard/app.ts`                | Modify   | \_onRender listeners for select+detail + pick-2 interactions     |

---

### Task 1: Port additional T20-DB data (racas + progressao_classes)

**Files:**

- Modify: `scripts/port-t20db.mjs`
- Create (generated): `src/data/racas.json`, `src/data/progressao_classes.json`

- [ ] **Step 1: Check T20-DB raças structure**

```bash
ls "E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB\data\racas"
```

Read one sample file (e.g., `humano.json`) to understand sub-choice fields.

- [ ] **Step 2: Add racas export to `scripts/port-t20db.mjs`**

Add this block at the end of the script (before `console.log("Done.")`):

```js
// 8. racas.json — raça sub-choices (free attributes, variants)
{
  const racaDir = join(T20DB, "racas");
  const files = readdirSync(racaDir).filter((f) => f.endsWith(".json"));
  const racas = files
    .map((f) => {
      const r = readJson(join(racaDir, f));
      return {
        id: r.id,
        nome: r.nome,
        descricao: r.descricao ?? "",
        atributos: r.atributos ?? {}, // fixed bonuses {for:1, des:0, ...}
        atributos_escolha: r.atributos_escolha ?? null, // {quantidade: 1, opcoes: [...]} or null
        pericias_bonus: r.pericias_bonus ?? [],
        poderes_automaticos: r.poderes_automaticos ?? [],
        tamanho: r.tamanho ?? "medio",
        deslocamento: r.deslocamento ?? 9,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "racas.json"), racas);
}

// 9. progressao_classes.json — pericias + PV/PM + levels (full data)
{
  const src = readJson(join(T20DB, "regras/progressao_classes.json"));
  // Restructure: classeId → { pericias_inatas, pericias_escolha, pericias_numero, pv, pm }
  const result = {};
  for (const [id, data] of Object.entries(src.classes ?? {})) {
    result[id] = {
      pv_por_nivel: data.pv_por_nivel ?? 0,
      pm_por_nivel: data.pm_por_nivel ?? 0,
      pericias_inatas: data.pericias_inatas ?? [],
      pericias_escolha: (data.pericias_escolha ?? []).flatMap((g) => g.opcoes ?? []),
      pericias_numero: (data.pericias_escolha ?? []).reduce(
        (sum, g) => sum + (g.quantidade ?? 0),
        0
      ),
    };
  }
  writeJson(join(OUT, "progressao_classes.json"), result);
}
```

- [ ] **Step 3: Run port script**

```bash
node scripts/port-t20db.mjs
```

Verify: `src/data/racas.json` and `src/data/progressao_classes.json` created.

- [ ] **Step 4: Commit + push**

```bash
git add scripts/port-t20db.mjs src/data/racas.json src/data/progressao_classes.json
git commit -m "feat: port raças + progressao_classes data from T20-DB"
git push origin master
```

---

### Task 2: Fix Perícias — parse inatas/escolhas correctly

**Files:**

- Modify: `src/wizard/steps/pericias.ts`
- Modify: `src/rules/pericias.ts`

The tormenta20 system returns `pericias.inatas` and `pericias.escolhas` as strings or possibly arrays. We must handle both. Additionally, fall back to `src/data/progressao_classes.json` when the Foundry item data is empty.

- [ ] **Step 1: Read current `src/wizard/steps/pericias.ts`**

- [ ] **Step 2: Create `src/rules/progressao.ts`** — data accessor for class pericias

```ts
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const progressaoData = require("../data/progressao_classes.json") as Record<
  string,
  {
    pv_por_nivel: number;
    pm_por_nivel: number;
    pericias_inatas: string[];
    pericias_escolha: string[];
    pericias_numero: number;
  }
>;

/** Normalize a pericia field that may be string, array, or object. */
export function normalizePericias(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    // "misticismo, vontade" or "misticismo vontade"
    return value
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    // Some systems store {misticismo: true, vontade: true}
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v === true || v === 1)
      .map(([k]) => k);
  }
  return [];
}

export interface ClasseProgressao {
  pericias_inatas: string[];
  pericias_escolha: string[];
  pericias_numero: number;
  pv_por_nivel: number;
  pm_por_nivel: number;
}

/**
 * Get class pericias from T20-DB data (reliable fallback).
 * classeNome: the item's name from Foundry (e.g. "Guerreiro")
 */
export function getClasseProgressao(classeNome: string): ClasseProgressao | null {
  // Try direct slug match
  const slug = classeNome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  if (slug in progressaoData) return progressaoData[slug];
  // Try partial match
  for (const [key, val] of Object.entries(progressaoData)) {
    if (slug.includes(key) || key.includes(slug)) return val;
  }
  return null;
}
```

- [ ] **Step 3: Update `src/wizard/steps/pericias.ts`** to use `normalizePericias` and fallback

```ts
import { countTreinaveis, buildPericiaSet } from "../../rules/pericias.js";
import { normalizePericias, getClasseProgressao } from "../../rules/progressao.js";
import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface PericiaEntry {
  id: string;
  nome: string;
  checked: boolean;
  locked: boolean;
  inata: boolean;
  escolhivel: boolean;
}

export interface PericiaContext {
  stepTitle: string;
  choicesRemaining: number;
  pericias: PericiaEntry[];
  errors: string[];
}

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

  // Resolve inatas + escolhas — fallback to T20-DB data when Foundry item is sparse
  let inatas = normalizePericias(classe.system.pericias?.inatas);
  let escolhas = normalizePericias(classe.system.pericias?.escolhas);
  let numero = classe.system.pericias?.numero ?? 0;

  // If Foundry data seems empty/corrupt, fall back to T20-DB
  if (inatas.length === 0 || escolhas.length === 0) {
    const prog = getClasseProgressao(classe.name);
    if (prog) {
      if (inatas.length === 0) inatas = prog.pericias_inatas;
      if (escolhas.length === 0) escolhas = prog.pericias_escolha;
      if (numero === 0) numero = prog.pericias_numero;
    }
  }

  const totalEscolhas = numero + Math.max(0, intModifier);
  const treinadas = new Set([...inatas, ...state.periciasTreinadas]);
  const allPericias = Array.from(new Set([...inatas, ...escolhas])).sort();

  const pericias: PericiaEntry[] = allPericias.map((id) => {
    const isInata = inatas.includes(id);
    return {
      id,
      nome: PERICIA_NOMES[id] ?? id,
      checked: treinadas.has(id) || state.periciasTreinadas.includes(id),
      locked: isInata,
      inata: isInata,
      escolhivel: escolhas.includes(id) && !isInata,
    };
  });

  const escolhasFeitas = state.periciasTreinadas.filter((p) => !inatas.includes(p)).length;

  return {
    stepTitle: "Perícias",
    choicesRemaining: Math.max(0, totalEscolhas - escolhasFeitas),
    pericias,
    errors,
  };
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit + push**

```bash
git add src/rules/progressao.ts src/wizard/steps/pericias.ts
git commit -m "fix: pericias — normalize string/array inatas, fallback to T20-DB data"
git push origin master
```

---

### Task 3: UX — Select+Detail pattern for Raça, Origem, Classe, Divindade

Replace radio grids with `<select>` + detail card below. Much more usable for 100+ items.

**Files:**

- Modify: `templates/wizard/wizard.hbs` (sections: raca, origem, classe, divindade)
- Modify: `src/wizard/steps/raca.ts` (add descricao, atributos_escolha)
- Modify: `src/wizard/steps/origem.ts` (add pick-2 candidates)
- Modify: `src/wizard/steps/divindade.ts` (add descricao)
- Modify: `src/wizard/app.ts` (\_onRender: select change → update detail card)

- [ ] **Step 1: Update `src/wizard/steps/raca.ts`** — add full data for detail card

```ts
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const racasData = require("../../data/racas.json") as Array<{
  id: string;
  nome: string;
  descricao: string;
  atributos: Record<string, number>;
  atributos_escolha: { quantidade: number; opcoes: string[] } | null;
  pericias_bonus: string[];
  tamanho: string;
  deslocamento: number;
}>;

import type { WizardState } from "../state.js";
import type { IndexedRace } from "../../compendium/types.js";

export interface RacaOption {
  id: string;
  name: string;
  selected: boolean;
}

export interface RacaDetail {
  id: string;
  name: string;
  descricao: string;
  atributos: string; // "+1 For, +1 Des" or "Escolha +1 em qualquer atributo"
  atributos_escolha: { quantidade: number; opcoes: string[] } | null;
  pericias_bonus: string[];
  tamanho: string;
  deslocamento: number;
}

export interface RacaContext {
  stepTitle: string;
  racaOptions: RacaOption[];
  selectedDetail: RacaDetail | null;
  // Free attribute choices (if raça allows)
  atributosEscolhaAtual: Record<string, number>; // user's current choices
  errors: string[];
}

function formatAtributos(atrs: Record<string, number>): string {
  return (
    Object.entries(atrs)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
      .join(", ") || "Nenhum"
  );
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = []
): RacaContext {
  const racaOptions: RacaOption[] = racas.map((r) => ({
    id: r.id,
    name: r.name,
    selected: r.id === state.racaId,
  }));

  const selectedFoundryRaca = racas.find((r) => r.id === state.racaId);
  let selectedDetail: RacaDetail | null = null;

  if (selectedFoundryRaca) {
    // Match T20-DB data by name slug
    const slug = selectedFoundryRaca.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_");
    const dbRaca = racasData.find(
      (r) =>
        r.id === slug ||
        r.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_") === slug
    );

    selectedDetail = {
      id: selectedFoundryRaca.id,
      name: selectedFoundryRaca.name,
      descricao: dbRaca?.descricao ?? "",
      atributos: dbRaca ? formatAtributos(dbRaca.atributos) : "",
      atributos_escolha: dbRaca?.atributos_escolha ?? null,
      pericias_bonus: dbRaca?.pericias_bonus ?? [],
      tamanho: dbRaca?.tamanho ?? "médio",
      deslocamento: dbRaca?.deslocamento ?? 9,
    };
  }

  return {
    stepTitle: "Raça",
    racaOptions,
    selectedDetail,
    atributosEscolhaAtual:
      (state.escolhasPorItem["raca_atributos"] as Record<string, number>) ?? {},
    errors,
  };
}
```

- [ ] **Step 2: Update `src/wizard/steps/origem.ts`** — add pick-2 UI data

```ts
import { listOrigens, getOrigem, getPick2Candidates } from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemOption {
  id: string;
  nome: string;
  selected: boolean;
}

export interface OrigemDetail {
  id: string;
  nome: string;
  pericias: string[];
  itens_iniciais: string[];
  poder_auto: string | null; // auto-granted power id
  pick2_candidates: string[]; // choose 1 from these
  pick2_escolhido: string | null; // user's pick so far
}

export interface OrigemContext {
  stepTitle: string;
  origemOptions: OrigemOption[];
  selectedDetail: OrigemDetail | null;
  errors: string[];
}

export function prepareOrigemContext(state: WizardState, errors: string[] = []): OrigemContext {
  const origens = listOrigens();
  const origemOptions: OrigemOption[] = origens.map((o) => ({
    id: o.id,
    nome: o.nome,
    selected: o.id === state.origemId,
  }));

  const selected = state.origemId ? getOrigem(state.origemId) : null;
  let selectedDetail: OrigemDetail | null = null;

  if (selected) {
    const candidates = getPick2Candidates(selected.id);
    const pick2Escolhido = (state.escolhasPorItem["origem_poder"] as string) ?? null;
    selectedDetail = {
      id: selected.id,
      nome: selected.nome,
      pericias: selected.beneficios.pericias,
      itens_iniciais: selected.itens_iniciais,
      poder_auto: selected.beneficios.poder_unico_id,
      pick2_candidates: candidates,
      pick2_escolhido: pick2Escolhido,
    };
  }

  return {
    stepTitle: "Origem",
    origemOptions,
    selectedDetail,
    errors,
  };
}
```

- [ ] **Step 3: Update wizard.hbs — Raça section** (select + detail card)

Replace the `{{#if showRaca}}` section entirely with:

```hbs
{{#if showRaca}}
<section class="t20w-step">
  <h2>{{stepTitle}}</h2>

  <div class="form-group">
    <label for="t20w-raca-select">Raça</label>
    <select id="t20w-raca-select" name="racaId" class="t20w-select">
      <option value="">— escolha uma raça —</option>
      {{#each racaOptions}}
        <option value="{{this.id}}" {{#if this.selected}}selected{{/if}}>{{this.name}}</option>
      {{/each}}
    </select>
  </div>

  {{#if selectedDetail}}
  <div class="t20w-detail-card" style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:4px;">
    <h3 style="margin:0 0 6px;">{{selectedDetail.name}}</h3>
    {{#if selectedDetail.descricao}}<p style="font-size:0.85em;opacity:0.8;">{{selectedDetail.descricao}}</p>{{/if}}
    <dl style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:0.85em;">
      <dt>Atributos</dt><dd>{{selectedDetail.atributos}}</dd>
      <dt>Tamanho</dt><dd>{{selectedDetail.tamanho}}</dd>
      <dt>Deslocamento</dt><dd>{{selectedDetail.deslocamento}}m</dd>
      {{#if selectedDetail.pericias_bonus.length}}
      <dt>Perícias bônus</dt><dd>{{selectedDetail.pericias_bonus}}</dd>
      {{/if}}
    </dl>

    {{#if selectedDetail.atributos_escolha}}
    <div class="t20w-subescolha" style="margin-top:10px;">
      <strong>Escolha {{selectedDetail.atributos_escolha.quantidade}} atributo(s) para +1:</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
        {{#each selectedDetail.atributos_escolha.opcoes}}
        <label style="display:flex;align-items:center;gap:4px;">
          <input type="radio" name="raca_atrib_escolha" value="{{this}}" />
          {{this}}
        </label>
        {{/each}}
      </div>
    </div>
    {{/if}}
  </div>
  {{/if}}
</section>
{{/if}}
```

- [ ] **Step 4: Update wizard.hbs — Origem section** (select + detail + pick-2)

Replace `{{#if showOrigem}}` section:

```hbs
{{#if showOrigem}}
<section class="t20w-step">
  <h2>{{stepTitle}}</h2>

  <div class="form-group">
    <label for="t20w-origem-select">Origem</label>
    <select id="t20w-origem-select" name="origemId" class="t20w-select">
      <option value="">— escolha uma origem —</option>
      {{#each origemOptions}}
        <option value="{{this.id}}" {{#if this.selected}}selected{{/if}}>{{this.nome}}</option>
      {{/each}}
    </select>
  </div>

  {{#if selectedDetail}}
  <div class="t20w-detail-card" style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:4px;">
    <h3 style="margin:0 0 6px;">{{selectedDetail.nome}}</h3>

    {{#if selectedDetail.pericias.length}}
    <p style="font-size:0.85em;"><strong>Perícias:</strong> {{selectedDetail.pericias}}</p>
    {{/if}}

    {{#if selectedDetail.itens_iniciais.length}}
    <p style="font-size:0.85em;"><strong>Itens:</strong> {{selectedDetail.itens_iniciais}}</p>
    {{/if}}

    {{#if selectedDetail.poder_auto}}
    <p style="font-size:0.85em;"><strong>Poder automático:</strong> {{selectedDetail.poder_auto}}</p>
    {{/if}}

    {{#if selectedDetail.pick2_candidates.length}}
    <div class="t20w-subescolha" style="margin-top:8px;">
      <strong>Escolha 1 dos poderes adicionais:</strong>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
        {{#each selectedDetail.pick2_candidates}}
        <label style="display:flex;align-items:center;gap:6px;font-size:0.9em;">
          <input type="radio" name="origem_poder_escolha" value="{{this}}"
            {{#if (eq this ../selectedDetail.pick2_escolhido)}}checked{{/if}} />
          {{this}}
        </label>
        {{/each}}
      </div>
    </div>
    {{/if}}
  </div>
  {{/if}}
</section>
{{/if}}
```

- [ ] **Step 5: Update wizard.hbs — Classe section** (select + detail)

Replace `{{#if showClasse}}` section:

```hbs
{{#if showClasse}}
<section class="t20w-step">
  <h2>{{stepTitle}}</h2>

  <div class="form-group">
    <label for="t20w-classe-select">Classe</label>
    <select id="t20w-classe-select" name="classeId" class="t20w-select">
      <option value="">— escolha uma classe —</option>
      {{#each classes}}
        <option value="{{this.id}}" {{#if this.selected}}selected{{/if}}>{{this.name}}</option>
      {{/each}}
    </select>
  </div>

  {{#if selectedClasse}}
  <div class="t20w-detail-card" style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:4px;">
    <h3 style="margin:0 0 6px;">{{selectedClasse.name}}</h3>
    <dl style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:0.85em;">
      <dt>PV por nível</dt><dd>+{{selectedClasse.pvPorNivel}}</dd>
      <dt>PM por nível</dt><dd>+{{selectedClasse.pmPorNivel}}</dd>
    </dl>
  </div>
  {{/if}}
</section>
{{/if}}
```

- [ ] **Step 6: Update wizard.hbs — Divindade section** (select + detail)

Replace `{{#if showDivindade}}` section:

```hbs
{{#if showDivindade}}
<section class="t20w-step">
  <h2>{{stepTitle}}</h2>
  {{#if obrigatoria}}<p class="t20w-hint" style="color:#f90;">⚠ Esta classe exige uma divindade.</p>
  {{else}}<p class="t20w-hint">Opcional. Pule se não quiser ser devoto.</p>{{/if}}

  <div class="form-group">
    <label for="t20w-div-select">Divindade</label>
    <select id="t20w-div-select" name="divindadeId" class="t20w-select">
      <option value="">— nenhuma —</option>
      {{#each divindades}}
        <option value="{{this.id}}" {{#if this.selected}}selected{{/if}}>{{this.nome}}</option>
      {{/each}}
    </select>
  </div>

  {{#if selectedDivindade}}
  <div class="t20w-detail-card" style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:4px;">
    <h3 style="margin:0 0 6px;">{{selectedDivindade.nome}}</h3>
    {{#if selectedDivindade.poderesCount}}
    <p style="font-size:0.85em;">{{selectedDivindade.poderesCount}} poder(es) concedido(s)</p>
    {{/if}}
  </div>
  {{/if}}
</section>
{{/if}}
```

- [ ] **Step 7: Update `src/wizard/steps/classe.ts`** — add `selectedClasse` to context

Add to return object:

```ts
selectedClasse: classes.find(c => c.id === state.classeId) ?? null,
```

- [ ] **Step 8: Update `src/wizard/steps/divindade.ts`** — add `selectedDivindade`

Add to return object:

```ts
selectedDivindade: divindades.find(d => d.id === state.divindadeId) ?? null,
```

- [ ] **Step 9: Add `_onRender` listeners for select→re-render (Raça, Origem, Classe, Divindade)**

In `app.ts` `_onRender`, add after the method select listener:

```ts
// Select dropdowns → re-render to show detail card
for (const name of ["racaId", "origemId", "classeId", "divindadeId"]) {
  const sel = root.querySelector<HTMLSelectElement>(`[name="${name}"]`);
  if (sel) {
    sel.addEventListener("change", () => {
      this.applyFormData(this._gatherFormData());
      // @ts-expect-error render not typed
      this.render();
    });
  }
}

// Origem pick-2 radio → save to escolhasPorItem
root.querySelectorAll<HTMLInputElement>("[name='origem_poder_escolha']").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value;
    this._state.apply({
      escolhasPorItem: { ...this._state.escolhasPorItem, origem_poder: val },
    });
  });
});

// Raça attribute choice radio
root.querySelectorAll<HTMLInputElement>("[name='raca_atrib_escolha']").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value;
    this._state.apply({
      escolhasPorItem: { ...this._state.escolhasPorItem, raca_atributo_escolhido: val },
    });
  });
});
```

- [ ] **Step 10: Typecheck + build**

```bash
npm run typecheck
npm run build
```

- [ ] **Step 11: Commit + push**

```bash
git add src/wizard/steps/raca.ts src/wizard/steps/origem.ts src/wizard/steps/classe.ts \
        src/wizard/steps/divindade.ts src/wizard/app.ts templates/wizard/wizard.hbs
git commit -m "fix: select+detail UI for raça/origem/classe/divindade + sub-choices"
git push origin master
```

---

### Task 4: Fix Poderes — list view with eligibility

The poderes step currently shows image grid without names. Replace with filterable list.

**Files:**

- Modify: `templates/wizard/wizard.hbs` (poderes section)
- Modify: `src/wizard/steps/poderes.ts` (add tipo filter)

- [ ] **Step 1: Update poderes section in wizard.hbs**

Replace `{{#if showPoderes}}` section:

```hbs
{{#if showPoderes}}
<section class="t20w-step">
  <h2>{{stepTitle}}</h2>

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
    <span>Selecionados: <strong>{{selectedCount}}</strong></span>
    <input type="text" id="t20w-poder-search" placeholder="Filtrar poderes..." style="flex:1;padding:4px 8px;" />
  </div>

  <div class="t20w-poderes-list" style="display:flex;flex-direction:column;gap:4px;max-height:340px;overflow-y:auto;">
    {{#each poderes}}
    <label class="t20w-poder-item {{#unless this.eligible}}t20w-ineligible{{/unless}}"
           data-poder-name="{{this.name}}"
           style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:3px;cursor:pointer;{{#unless this.eligible}}opacity:0.5;{{/unless}}">
      <input type="checkbox" name="poder-{{this.id}}" value="{{this.id}}"
             {{#if this.selected}}checked{{/if}} />
      <img src="{{this.img}}" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;" />
      <span style="flex:1;">{{this.name}}</span>
      {{#if this.tipo}}<small style="opacity:0.6;">{{this.tipo}}</small>{{/if}}
      {{#unless this.eligible}}
        <small style="color:#f55;font-size:0.75em;">Pré-requisito não atendido</small>
      {{/unless}}
    </label>
    {{/each}}
  </div>
</section>
{{/if}}
```

- [ ] **Step 2: Add poder search listener in `_onRender`**

```ts
// Poder search filter
const poderSearch = root.querySelector<HTMLInputElement>("#t20w-poder-search");
if (poderSearch) {
  poderSearch.addEventListener("input", () => {
    const q = poderSearch.value.toLowerCase();
    root.querySelectorAll<HTMLElement>(".t20w-poder-item").forEach((item) => {
      const name = item.dataset["poderName"]?.toLowerCase() ?? "";
      item.style.display = name.includes(q) ? "" : "none";
    });
  });
}
```

- [ ] **Step 3: Update `src/wizard/steps/poderes.ts`** to add `tipo` field

In the `entries` map, add:

```ts
tipo: (p as { system?: { tipo?: string } }).system?.tipo ?? "",
```

And update `PoderEntry` interface to include `tipo: string`.

- [ ] **Step 4: Typecheck + build + commit + push**

```bash
npm run typecheck && npm run build
git add templates/wizard/wizard.hbs src/wizard/steps/poderes.ts src/wizard/app.ts
git commit -m "fix: poderes — list view with search filter and eligibility labels"
git push origin master
```

---

### Task 5: Final checks + tag

- [ ] **Step 1:** `npm test` — all 77 pass
- [ ] **Step 2:** `npm run typecheck` — src/ clean
- [ ] **Step 3:** `npm run format` — commit if changed
- [ ] **Step 4:**

```bash
git tag v0.5.0-plan5
git push origin --tags
```

---

## Spec Coverage

| Fix                                           | Task |
| --------------------------------------------- | ---- |
| perícias.inatas string→array normalization    | T2   |
| T20-DB fallback for class pericias data       | T2   |
| Select+detail for Raça (+ sub-choices)        | T3   |
| Select+detail for Origem (+ pick-2)           | T3   |
| Select+detail for Classe                      | T3   |
| Select+detail for Divindade                   | T3   |
| Poderes list view + search + eligibility text | T4   |
| raças.json + progressao_classes.json data     | T1   |

**Out of scope (post-MVP):**

- Full sub-choice resolver (subescolhas.ts — Plan 3 stub)
- Raça multiple free attribute choices
- Equipamento cart functionality
- Magias conhecidas count limit enforcement
