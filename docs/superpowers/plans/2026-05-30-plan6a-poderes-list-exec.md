# Poderes Legíveis + Descrição de Classe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o passo Poderes do wizard legível (descrição + motivo específico de inelegibilidade + filtro por categoria + contador de cota) e mostrar a descrição da classe no painel de detalhe.

**Architecture:** O wizard renderiza um único template `templates/wizard/wizard.hbs` (PART único). Os `.hbs` por-passo são legados mortos — NÃO editar. View-models puros em `src/wizard/steps/*.ts` (testáveis sem Foundry). Regras puras em `src/rules/*.ts`. Listeners de UI em `src/wizard/app.ts::_onRender` (padrão `data-action` / id-hooks). Dados de regra vêm de `src/data/*.json` portado do T20-DB; descrição vem do item do compêndio Foundry.

**Tech Stack:** TypeScript strict, Vite (lib mode → `dist/module.js`), Vitest, Handlebars (Foundry v13 ApplicationV2).

**Git (regra do projeto, sobrepõe skills):** commit direto em `master`, sem branch/PR/worktree. Após CADA task: `npx tsc --noEmit` e `npm test` verdes → `git commit` → `git push origin master`.

**Estado já existente (verificado — NÃO refazer):** painéis de detalhe de raça/origem/classe/divindade já existem em `wizard.hbs`; passo Poderes já é lista (não grid) com busca `#t20w-poder-search` (listener já em `app.ts`) e flag de elegibilidade. Falta o detalhado abaixo.

---

## Task 1: Formatter legível de pré-requisito

**Files:**
- Modify: `src/rules/poderes.ts`
- Test: `test/rules/poderes.test.ts`

- [ ] **Step 1: Write the failing test**

Adicionar ao fim de `test/rules/poderes.test.ts` (o import da linha 2 já traz `checkPrereqs, isEligible`; estender para incluir os novos exports):

```ts
import { formatPrereq, describeUnmet } from "../../src/rules/poderes";

describe("formatPrereq", () => {
  it("atributo → 'Força 3'", () => {
    expect(formatPrereq({ tipo: "atributo", atributo: "for", valor: 3 })).toBe("Força 3");
  });
  it("nivel → 'Nível 5'", () => {
    expect(formatPrereq({ tipo: "nivel", valor: 5 })).toBe("Nível 5");
  });
  it("poder → 'Poder: Ataque Poderoso'", () => {
    expect(formatPrereq({ tipo: "poder", poder: "ataque_poderoso" })).toBe("Poder: Ataque Poderoso");
  });
  it("pericias → 'Treinado em Luta'", () => {
    expect(formatPrereq({ tipo: "pericias", pericia: "luta" })).toBe("Treinado em Luta");
  });
  it("classe → 'Classe: Guerreiro'", () => {
    expect(formatPrereq({ tipo: "classe", classe: "guerreiro" })).toBe("Classe: Guerreiro");
  });
  it("raca → 'Raça: Anão'", () => {
    expect(formatPrereq({ tipo: "raca", raca: "anao" })).toBe("Raça: Anao");
  });
  it("tipo desconhecido → genérico", () => {
    expect(formatPrereq({ tipo: "qualquer_coisa" })).toBe("Pré-requisito especial");
  });
});

describe("describeUnmet", () => {
  it("slug sem pré-req → []", () => {
    expect(describeUnmet("__inexistente__", baseState)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/poderes.test.ts`
Expected: FAIL — `formatPrereq is not exported` / `describeUnmet is not exported`.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao fim de `src/rules/poderes.ts` (depois de `isEligible`):

```ts
const ATTR_LABEL: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable PT label for one structured prerequisite. */
export function formatPrereq(req: Prereq): string {
  switch (req["tipo"]) {
    case "atributo":
      return `${ATTR_LABEL[req["atributo"] as string] ?? req["atributo"]} ${req["valor"]}`;
    case "nivel":
      return `Nível ${req["valor"]}`;
    case "poder":
      return `Poder: ${titleCase(String(req["poder"]))}`;
    case "pericias":
      return `Treinado em ${titleCase(String(req["pericia"]))}`;
    case "classe":
      return `Classe: ${titleCase(String(req["classe"]))}`;
    case "raca":
      return `Raça: ${titleCase(String(req["raca"]))}`;
    default:
      return "Pré-requisito especial";
  }
}

/** List of unmet prerequisites for a power, as readable PT strings (empty if eligible). */
export function describeUnmet(poderSlug: string, state: PartialWizardState): string[] {
  const prereqs = prereqsData[poderSlug];
  if (!prereqs) return [];
  return checkPrereqs(prereqs, state).unmet.map(formatPrereq);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules/poderes.test.ts`
Expected: PASS (todos os casos novos + os antigos).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm test
git add src/rules/poderes.ts test/rules/poderes.test.ts
git commit -m "feat(poderes): formatPrereq + describeUnmet legíveis"
git push origin master
```

---

## Task 2: Indexar a descrição do item poder

**Files:**
- Modify: `src/compendium/types.ts:33-39`
- Modify: `src/compendium/index.ts:7-19`

> Sem teste unitário: leitura de índice Foundry só roda no mundo. A regressão é pega pelo `tsc` + pelos testes de VM da Task 3.

- [ ] **Step 1: Adicionar campo `descricao` ao tipo IndexedPoder**

Em `src/compendium/types.ts`, substituir o bloco `IndexedPoder` (linhas 33-39) por:

```ts
export interface IndexedPoder extends IndexedBase {
  type: "poder";
  system: {
    tipo?: string;
    subtipo?: string;
    descricao?: string;
  };
}
```

- [ ] **Step 2: Pedir a descrição ao getIndex**

Em `src/compendium/index.ts`, no array `INDEX_FIELDS` (linhas 7-19), adicionar a linha do campo de descrição do item poder do sistema `tormenta20` (`system.descricao`):

```ts
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
];
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: PASS (sem erros de tipo).

- [ ] **Step 4: Commit**

```bash
npm test
git add src/compendium/types.ts src/compendium/index.ts
git commit -m "feat(compendium): indexar system.descricao do poder"
git push origin master
```

> ⚠️ Se no mundo de teste a descrição vier vazia, o campo real do item pode não ser `system.descricao` (pode ser `system.description.value`). Verificar no mundo e ajustar o campo aqui + no map da Task 3. Anotar o fato no CLAUDE.md ("Fatos do sistema").

---

## Task 3: VM de poderes expõe descrição + motivos

**Files:**
- Modify: `src/wizard/steps/poderes.ts`
- Test: `test/wizard/poderes-vm.test.ts` (criar)

- [ ] **Step 1: Write the failing test**

Criar `test/wizard/poderes-vm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { preparePoderesContext } from "../../src/wizard/steps/poderes";
import { WizardState } from "../../src/wizard/state";
import type { IndexedPoder } from "../../src/compendium/types";

function poder(name: string, descricao = ""): IndexedPoder {
  return {
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    img: "",
    packId: "test.poderes",
    type: "poder",
    system: { tipo: "combate", descricao },
  };
}

describe("preparePoderesContext", () => {
  it("expõe descrição de cada poder", () => {
    const state = new WizardState();
    const ctx = preparePoderesContext(state, [poder("Foco em Arma", "Você ganha +2…")]);
    expect(ctx.poderes[0].descricao).toBe("Você ganha +2…");
  });

  it("invariante: eligible === (unmet.length === 0)", () => {
    const state = new WizardState();
    const ctx = preparePoderesContext(state, [poder("Ataque Poderoso"), poder("Foco em Arma")]);
    for (const p of ctx.poderes) {
      expect(p.eligible).toBe(p.unmet.length === 0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/wizard/poderes-vm.test.ts`
Expected: FAIL — `descricao`/`unmet` não existem em `PoderEntry`.

- [ ] **Step 3: Write minimal implementation**

Substituir o conteúdo de `src/wizard/steps/poderes.ts` por:

```ts
import { describeUnmet } from "../../rules/poderes.js";
import type { WizardState } from "../state.js";
import type { IndexedPoder } from "../../compendium/types.js";

export interface PoderEntry {
  id: string;
  name: string;
  img: string;
  eligible: boolean;
  unmet: string[];
  selected: boolean;
  tipo: string;
  subtipo: string;
  descricao: string;
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

  const entries: PoderEntry[] = poderes.map((p) => {
    const slug = p.name.toLowerCase().replace(/\s+/g, "_");
    const unmet = describeUnmet(slug, stateForEligibility);
    return {
      id: p.id,
      name: p.name,
      img: p.img,
      eligible: unmet.length === 0,
      unmet,
      selected: state.poderes.includes(p.id),
      tipo: (p.system as { tipo?: string }).tipo ?? "",
      subtipo: (p.system as { subtipo?: string }).subtipo ?? "",
      descricao: (p.system as { descricao?: string }).descricao ?? "",
    };
  });

  return {
    stepTitle: "Poderes",
    poderes: entries,
    selectedCount: state.poderes.length,
    errors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/wizard/poderes-vm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm test
git add src/wizard/steps/poderes.ts test/wizard/poderes-vm.test.ts
git commit -m "feat(poderes): VM expõe descrição + motivos de inelegibilidade"
git push origin master
```

---

## Task 4: Template — descrição, motivos específicos, filtro e cota

**Files:**
- Modify: `templates/wizard/wizard.hbs:260-289` (bloco `{{#if showPoderes}}`)

> Sem teste automatizado (Handlebars). Verificação = `tsc`/`npm test` verdes + render manual.

- [ ] **Step 1: Substituir o bloco showPoderes**

Trocar todo o bloco `{{#if showPoderes}} … {{/if}}` (linhas 260-289) por:

```hbs
    {{#if showPoderes}}
    <section class="t20w-step">
      <h2>{{stepTitle}}</h2>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:0.9em;">Selecionados: <strong>{{selectedCount}}</strong></span>
        <select id="t20w-poder-cat" style="padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid #555;color:inherit;border-radius:3px;">
          <option value="">Todas as categorias</option>
          {{#each categorias}}<option value="{{this}}">{{this}}</option>{{/each}}
        </select>
        <input type="text" id="t20w-poder-search" placeholder="Filtrar poderes..."
               style="flex:1;min-width:120px;padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid #555;color:inherit;border-radius:3px;" />
      </div>

      <div class="t20w-poderes-list" style="display:flex;flex-direction:column;gap:3px;max-height:360px;overflow-y:auto;">
        {{#each poderes}}
        <label class="t20w-poder-row"
               data-poder-name="{{this.name}}"
               data-poder-cat="{{this.tipo}}"
               style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:3px;cursor:pointer;{{#unless this.eligible}}opacity:0.55;{{/unless}}">
          <input type="checkbox" name="poder-{{this.id}}" value="{{this.id}}"
                 {{#if this.selected}}checked{{/if}} />
          <img src="{{this.img}}" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;border-radius:2px;" onerror="this.style.display='none'" />
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.9em;font-weight:600;">{{this.name}}</span>
              {{#if this.tipo}}<small style="opacity:0.55;font-size:0.72em;">{{this.tipo}}</small>{{/if}}
            </div>
            {{#if this.descricao}}<div style="font-size:0.78em;opacity:0.75;margin-top:2px;">{{this.descricao}}</div>{{/if}}
            {{#unless this.eligible}}
              <div style="color:#f77;font-size:0.72em;margin-top:2px;">Requer: {{#each this.unmet}}{{this}}{{#unless @last}}; {{/unless}}{{/each}}</div>
            {{/unless}}
          </div>
        </label>
        {{/each}}
      </div>

      {{#if errors.length}}<ul class="t20w-errors">{{#each errors}}<li>{{this}}</li>{{/each}}</ul>{{/if}}
    </section>
    {{/if}}
```

- [ ] **Step 2: Adicionar `categorias` ao VM**

Em `src/wizard/steps/poderes.ts`, dentro de `preparePoderesContext`, antes do `return`, computar categorias distintas e incluir no contexto. Adicionar ao `PoderesContext` o campo `categorias: string[]` e:

```ts
  const categorias = [...new Set(entries.map((e) => e.tipo).filter(Boolean))].sort();

  return {
    stepTitle: "Poderes",
    poderes: entries,
    categorias,
    selectedCount: state.poderes.length,
    errors,
  };
```

E na interface:

```ts
export interface PoderesContext {
  stepTitle: string;
  poderes: PoderEntry[];
  categorias: string[];
  selectedCount: number;
  errors: string[];
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (o teste da Task 3 continua válido; `categorias` é aditivo).

- [ ] **Step 4: Commit**

```bash
git add templates/wizard/wizard.hbs src/wizard/steps/poderes.ts
git commit -m "feat(poderes): lista com descrição, motivos específicos e filtro de categoria"
git push origin master
```

---

## Task 5: Listener do filtro de categoria

**Files:**
- Modify: `src/wizard/app.ts:384-394` (handler de busca de poder em `_onRender`)

- [ ] **Step 1: Substituir o handler de busca por busca + categoria**

Trocar o bloco `// ── Poder search filter ──` (linhas 384-394) por:

```ts
      // ── Poder search + category filter ──────────────────────────────────
      const poderSearch = root.querySelector<HTMLInputElement>("#t20w-poder-search");
      const poderCat = root.querySelector<HTMLSelectElement>("#t20w-poder-cat");
      const applyPoderFilter = () => {
        const q = (poderSearch?.value ?? "").toLowerCase();
        const cat = poderCat?.value ?? "";
        root.querySelectorAll<HTMLElement>(".t20w-poder-row").forEach((item) => {
          const name = (item.dataset["poderName"] ?? "").toLowerCase();
          const c = item.dataset["poderCat"] ?? "";
          const matchName = name.includes(q);
          const matchCat = !cat || c === cat;
          item.style.display = matchName && matchCat ? "" : "none";
        });
      };
      if (poderSearch) poderSearch.addEventListener("input", applyPoderFilter);
      if (poderCat) poderCat.addEventListener("change", applyPoderFilter);
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/wizard/app.ts
git commit -m "feat(poderes): filtro por categoria além da busca por nome"
git push origin master
```

---

## Task 6: Descrição da classe no painel de detalhe

**Files:**
- Modify: `scripts/port-t20db.mjs:228-277` (bloco `classes.json`)
- Modify: `src/rules/classe.ts:14-27` (interface `ClasseData`)
- Modify: `src/wizard/steps/classe.ts`
- Modify: `templates/wizard/wizard.hbs:153-161` (painel da classe)
- Test: `test/rules/classe.test.ts`

- [ ] **Step 1: Write the failing test**

Adicionar a `test/rules/classe.test.ts`:

```ts
it("getClasse traz descrição", () => {
  const guerreiro = getClasse("guerreiro");
  expect(typeof guerreiro?.descricao).toBe("string");
  expect((guerreiro?.descricao ?? "").length).toBeGreaterThan(0);
});
```

(Se o arquivo ainda não importa `getClasse`, usar o import já presente no topo do teste.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/classe.test.ts`
Expected: FAIL — `descricao` é `undefined` (porte não emite + tipo não tem o campo).

- [ ] **Step 3: Emitir descrição no porte**

Em `scripts/port-t20db.mjs`, dentro do bloco `classes.json` (objeto `result[c.id] = { … }`), adicionar a primeira propriedade:

```js
    result[c.id] = {
      nome: c.nome ?? c.id,
      descricao: c.descricao ?? "",
      pericias: {
```

(o resto do objeto permanece igual.) Depois rodar:

Run: `npm run port`
Expected: regenera `src/data/classes.json` com campo `descricao` em cada classe.

- [ ] **Step 4: Adicionar `descricao` ao tipo + VM**

Em `src/rules/classe.ts`, na interface `ClasseData`, adicionar após `nome: string;`:

```ts
  descricao: string;
```

Em `src/wizard/steps/classe.ts`, no objeto `selectedClasse` do contexto, incluir `descricao` lido de `getClasse(...)`. Localizar onde `selectedClasse` é montado e adicionar o campo `descricao: classeData.descricao ?? ""` (usar o resultado de `getClasse` já presente no step).

- [ ] **Step 5: Mostrar no template**

Em `templates/wizard/wizard.hbs`, no painel da classe (após `<h3 …>{{selectedClasse.name}}</h3>`, linha ~155), inserir:

```hbs
        {{#if selectedClasse.descricao}}<p style="font-size:0.85em;opacity:0.8;margin:0 0 8px;">{{selectedClasse.descricao}}</p>{{/if}}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/rules/classe.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit && npm test
git add scripts/port-t20db.mjs src/data/classes.json src/rules/classe.ts src/wizard/steps/classe.ts templates/wizard/wizard.hbs test/rules/classe.test.ts
git commit -m "feat(classe): descrição da classe no painel de detalhe"
git push origin master
```

---

## Self-Review

- **Cobertura:** A2 poderes (descrição T1-T5: formatter, índice, VM, template, filtro) ✅; A1 classe descrição (T6) ✅. A1 raça/origem/divindade já existiam (fora de escopo, verificado). Cota de poder por nível = Plan 7 (depende de progressão), declarado fora.
- **Tipos consistentes:** `PoderEntry` ganha `descricao`+`unmet`+ usado em T3/T4; `PoderesContext.categorias` adicionado em T4 e consumido no template; `ClasseData.descricao` adicionado em T6 e lido no step+template. `describeUnmet(slug,state)` definido em T1, usado em T3.
- **Placeholders:** nenhum — todo passo de código traz o código.

## Atualizações ao concluir
- ROADMAP F1 → ✅ (poderes legíveis + descrição de classe).
- CLAUDE.md: "Paridade T20-DB" (poderes com motivo ✅); Mapa (`formatPrereq`/`describeUnmet` em `rules/poderes.ts`, `categorias` em `steps/poderes.ts`, `descricao` em `ClasseData`); "Fatos do sistema" se o campo de descrição do poder/classe diferir de `system.descricao`.
