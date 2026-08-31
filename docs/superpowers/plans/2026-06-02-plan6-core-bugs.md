# Plan 6 — Core Bug Fixes: Slug, Atributos, Divindade, Poderes, Magias, Perícias, Equipamentos

**Data:** 2026-06-02  
**Status:** Em execução

---

## Root Causes

| Bug | Causa | Fix |
|-----|-------|-----|
| Magias não aparecem para Arcanista | `isConjurador(state.classeId)` — UUID, não slug | Passar `toNomeSlug(classeNome)` |
| Divindade mostra só 2 | `listDivindadesParaPersonagem(racaId, classeId)` — UUID vs slug | Idem |
| Poderes concedidos não aparecem | Não implementado no step | Adicionar pick concedido na Divindade |
| Poderes step errado | Mostra pick livre de qualquer poder | Redesenhar: auto-grant nível 1, pick por nível 2+ |
| Atributos outros métodos quebrados | UI só implementa compra_pontos | Adicionar input livre para outros métodos |
| Perícias sem limite real | Sem enforcement no DOM | JS disable ao atingir máximo |
| Equipamentos sem lógica | UI incompleta | Categorias + dinheiro + lista |

---

## T1 — Fix Slug + Divindade (A)

**Arquivos:** `src/compendium/slug.ts`, `src/rules/divindade.ts`, `src/wizard/steps/divindade.ts`, `templates/wizard/wizard.hbs`, `src/wizard/app.ts`

### 1a. Slug helper
Em `src/compendium/slug.ts`, adicionar export:
```typescript
/** Normalize display name → T20-DB slug key (lowercase, sem acento). */
export function toNomeSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
```

### 1b. Fix divindade step
Em `steps/divindade.ts`:
- Importar `toNomeSlug` de `../../compendium/slug.js`
- `listDivindadesParaPersonagem(toNomeSlug(state.racaNome ?? ""), toNomeSlug(state.classeNome ?? ""))`
- `isDivindadeObrigatoria(toNomeSlug(state.classeNome ?? ""))`
- Adicionar `poderesConcedidos: string[]` ao `selectedDivindade`
- Exportar `numeroPoderesParaPick(classeSlug)`: `1` para todos; clérigo/paladino/druida → "todos" (get all auto)

### 1c. Conceded powers pick na UI
Em `wizard.hbs` (bloco `showDivindade`):
- Após select de divindade + detail card, adicionar seção:
  ```
  {{#if selectedDivindade}}
    <div class="t20w-conceded-powers">
      <h4>Poder Concedido</h4>
      {{#if divindadeObrigatoriaTodoPoder}}
        <p>Como {{classeNome}}, você recebe todos os poderes concedidos automaticamente.</p>
        <ul>{{#each selectedDivindade.poderesConcedidos}}<li>{{this}}</li>{{/each}}</ul>
      {{else}}
        <p>Escolha 1 poder concedido:</p>
        <div class="t20w-poder-list">
          {{#each selectedDivindade.poderesConcedidos}}
          <label class="t20w-poder-radio">
            <input type="radio" name="divindade_poder" value="{{this}}" {{#if (eq ../../divindadePoder this)}}checked{{/if}}>
            {{this}}
          </label>
          {{/each}}
        </div>
      {{/if}}
    </div>
  {{/if}}
  ```
- Em `app.ts`, save `divindadePoder` em `escolhasPorItem.divindade_poder`
- Em `state.ts`, `escolhasPorItem.divindade_poder?: string`

---

## T2 — Atributos UX (B)

**Arquivos:** `src/wizard/steps/atributos.ts`, `templates/wizard/wizard.hbs`, `src/wizard/app.ts`

### Regras
- Point buy: min=-1, max=4 por atributo. Botões - e +. Input readonly (só via botões).
- Outros métodos: input numérico livre (o jogador rola na mesa), sem limite de pontos. Mostrar descrição do método.

### Template changes
Bloco `showAtributos`:
```handlebars
{{#each atributos}}
<div class="t20w-attr-row">
  <span class="t20w-attr-label">{{label}}</span>
  {{#if ../isCompra}}
    <button type="button" class="t20w-attr-dec" data-attr="{{id}}" data-action="attrDec">−</button>
    <input type="number" name="attr_{{id}}" value="{{value}}" min="-1" max="4" readonly class="t20w-attr-input">
    <button type="button" class="t20w-attr-inc" data-attr="{{id}}" data-action="attrInc">+</button>
    <span class="t20w-attr-cost">({{custo}} pts)</span>
  {{else}}
    <button type="button" class="t20w-attr-dec" data-attr="{{id}}" data-action="attrDec">−</button>
    <input type="number" name="attr_{{id}}" value="{{value}}" class="t20w-attr-input">
    <button type="button" class="t20w-attr-inc" data-attr="{{id}}" data-action="attrInc">+</button>
  {{/if}}
</div>
{{/each}}
{{#if isCompra}}
<p class="t20w-points">Pontos restantes: <strong class="t20w-remaining {{#if pontosNegativo}}t20w-neg{{/if}}">{{pontosRestantes}}</strong></p>
{{else}}
<p class="t20w-method-desc">{{metodoDescricao}} — insira os valores rolados</p>
{{/if}}
```

### app.ts handlers
- `attrDec`: decrement `state.atributosBase[attr]`; if compra: min=-1; else: min=-5
- `attrInc`: increment; if compra: max=4; else: max=10
- Remove point buy specific limits from non-compra inputs

---

## T3 — Perícias Enforcement (B)

**Arquivos:** `src/wizard/steps/pericias.ts`, `templates/wizard/wizard.hbs`, `src/wizard/app.ts`

### Dedup logic
Em `steps/pericias.ts`, antes de montar as listas:
- `alreadyTrained = new Set([...fixas, ...obrigatoriasPicked, ...escolhasPicked, ...extraIntPicked, ...racaPicked])`
- Cada sub-lista filtra fora `alreadyTrained` (exceto as próprias opções fixas que são mostradas como locked)

### DOM enforcement
Em `app.ts`, `_onRender`, adicionar listener para grupos de checkboxes de perícias:
```typescript
// Para cada grupo [obrigatorias[i], escolhas, extras_int, raca]:
// Quando total checked >= limite, disable todos unchecked nesse grupo
const enforceCheckboxLimit = (groupName: string, limit: number) => {
  const checkboxes = html.querySelectorAll<HTMLInputElement>(`input[name="${groupName}"]`);
  const checkedCount = [...checkboxes].filter(c => c.checked).length;
  checkboxes.forEach(cb => {
    if (!cb.checked) cb.disabled = checkedCount >= limit;
  });
};
```
Chamar para cada grupo no change event.

---

## T4 — Poderes Redesign (C)

**Arquivos:** `src/wizard/steps/poderes.ts`, `templates/wizard/wizard.hbs`

### Lógica correta T20
- Nível 1: nenhum poder de lista para escolher. O personagem RECEBE auto as `habilidades_classe_ids` da classe. Origem pode conceder poderes (já tratado no step Origem). Raça concede habilidades.
- Nível 2+: escolher `poderes-por-nivel[nivel]` poderes da lista `poderes_classe_ids` (filtrado por elegibilidade/pré-requisitos).

### Step redesign
```typescript
export function preparePoderContext(state, allPoderes, errors=[]) {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const classeData = getClasse(classeSlug);
  const nivel = state.nivel;
  
  // Auto-granted habilidades (always shown)
  const habilidades = classeData?.habilidades_classe_ids ?? [];
  
  // How many free picks at this level
  const poderesParaPick = poderesporNivel[classeSlug]?.[nivel] ?? 0;
  
  if (nivel <= 1 || poderesParaPick === 0) {
    return { stepTitle: "Poderes", habilidades, poderesParaPick: 0, poderes: [], ... };
  }
  
  // Filter eligible powers from poderes_classe_ids
  const eligible = allPoderes.filter(p => 
    classeData.poderes_classe_ids.includes(slugFromName(p.name)) && checkPrereqs(p, state)
  );
  return { habilidades, poderesParaPick, poderes: eligible, selectedCount: state.poderes.length };
}
```

### Template: split into two sections
- "Habilidades de Classe" (sempre visível): lista dos `habilidades`
- "Poderes" (só se nível >= 2): pick list com limit

---

## T5 — Magias Fix + UI (C)

**Arquivos:** `src/wizard/steps/magias.ts`, `src/rules/magias.ts`

### Fix slug
Em `steps/magias.ts`:
- `import { toNomeSlug } from "../../compendium/slug.js"`
- `const classeSlug = toNomeSlug(state.classeNome ?? "")`
- `isConjurador(classeSlug)` e `filterMagias(allMagias, classeSlug, state.nivel)`

### UI
Adicionar ao context: `selectedCount`, `magiaLimit` (Int + 3 para arcanista, regra T20).
No template: contador "X/Y magias selecionadas", agrupar por círculo.

---

## T6 — Equipamentos Overhaul (D)

**Arquivos:** `src/wizard/steps/equipamento.ts`, `templates/wizard/wizard.hbs`

### Funcionalidades
1. **Dinheiro inicial** — mostrar valor por nível (de `dinheiro.json`). Nível 1: "4d6 T$ (média: 14 T$)". Nível 2+: valor fixo. Guardar em `state.dinheiroInicial`.
2. **Itens iniciais** — de origem (já em `origemData.itens_iniciais`), mostrar como "recebidos grátis".
3. **Categorias** — tabs: Armas | Armaduras | Geral | Consumíveis (baseado em `item.type`: `arma`, `equipamento`, `consumivel`, `pocao`).
4. **Lista** — rows: img(pequena 24px) + nome + preço + peso + botão Adicionar.
5. **Carrinho** — seção direita: itens selecionados + preço total + saldo restante.
6. **Limite** — bloquear adicionar se `totalGasto > dinheiroInicial`.

---

## Sequência de execução

1. **A** — Slug fix + Divindade (T1) → commit
2. **B** — Atributos + Perícias (T2+T3) → commit
3. **C** — Poderes + Magias (T4+T5) → commit  
4. **D** — Equipamentos (T6) → commit
5. Build final + tag v0.6.0

