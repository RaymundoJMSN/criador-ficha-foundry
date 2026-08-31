# Plan 7 — Magias fix, Equipamentos UX, Dice Rolling, Race Powers

**Data:** 2026-06-02  
**Status:** Em execução  
**Cobre:** F1 resto (magias vazia, UX equipamentos), F4 parcial (race powers via createEmbeddedDocuments)

---

## Bugs + features do usuário

| Problema | Root cause | Fix |
|---|---|---|
| Magias vazia mesmo com Arcanista | `filterMagias` faz `circles.has(m.system.circulo)` mas `circulo` pode ser string; `tipos.has(tipo)` filtra tudo se tipo não bater | Coerce number, relaxar tipo |
| Guia magias ~-1 | `intMod + 3` com Int base 0 → -5+3=-2 | Usar `Math.max(1, intMod+3)` |
| Poderes de raça não aparecem | `Actor.create({items:[raceItem]})` não dispara `onCreate` hooks do sistema | Criar actor SEM race, depois `createEmbeddedDocuments("Item", [raceItem])` |
| Equipamentos sem busca | Não implementado | Campo text search → filtra itens por nome |
| Subtypes de item genéricos | Só 3 tabs (arma/geral/consumivel), não usa `system.subtipo` | 4 tabs + filter por subtipo dentro de Geral e Consumivel |
| Sem rolagem de atributos | Outros métodos mostram inputs mas sem "Rolar" button | Foundry `Roll` API (4d6kh3 para rolagem_padrao, etc.) |
| Dinheiro nv1 fixo em 14 | Deveria rolar 4d6 via Foundry | Botão "Rolar Dinheiro" → `new Roll("4d6").roll()` |
| Pode gastar mais do que tem | Sem block no Next | Validar `dinheiroRestante < 0` no engine |
| Itens iniciais nv1 não auto-incluídos | Não implementado | Se nivel=1 + origemId set: auto-add `itens_iniciais` ao cart no `prepareEquipamentoContext` |

---

## T1 — Fix magias filter + search

**Arquivos:** `src/rules/magias.ts`, `src/wizard/steps/magias.ts`, `templates/wizard/wizard.hbs`

### magias.ts filter fix
```typescript
export function filterMagias(magias: IndexedMagia[], classeId: string, nivel: number): IndexedMagia[] {
  const circles = new Set(getCirculosDesbloqueados(classeId, nivel));
  const tipos = new Set<string>(CLASSE_TIPO_MAGIA[classeId] ?? []);

  return magias.filter((m) => {
    const circulo = Number(m.system.circulo);  // coerce — getIndex may return string
    if (!circulo || !circles.has(circulo)) return false;
    // If class has tipo restriction AND item has tipo, filter by tipo; otherwise allow
    if (tipos.size > 0 && m.system.tipo && !tipos.has(m.system.tipo)) return false;
    return true;
  });
}
```

### steps/magias.ts
- Fix `magiaLimit`: `Math.max(1, intMod + 3)` so it's never negative
- Add `searchQuery: string` to context (from `state.escolhasPorItem["magia_search"]`)
- Filter `filtered` by searchQuery (case-insensitive name match)
- Add `circuloLabel` helper for display ("1º Círculo", etc.)

### wizard.hbs magias block
- Add `<input type="text" id="t20w-magia-search" placeholder="Buscar magia..." value="{{magiaSearch}}">` 
- Group magias by `circulo`: `{{#each magiasByCirculo}}<h4>{{circuloLabel}} Círculo</h4>...{{/each}}`
- app.ts: onChange on magia-search → save to `escolhasPorItem.magia_search` + re-render

---

## T2 — Equipamentos UX (search + subtypes + level1 auto-include + block overspent)

**Arquivos:** `src/compendium/index.ts`, `src/wizard/steps/equipamento.ts`, `templates/wizard/wizard.hbs`, `src/wizard/app.ts`

### compendium/index.ts
Add `"system.subtipo"` to `INDEX_FIELDS`. This exposes item subtypes (e.g. "Armadura Leve", "Munição").

### steps/equipamento.ts  
Category logic upgrade:
```typescript
export type ItemCategoria = "arma" | "armadura" | "geral" | "consumivel";

const ARMADURA_SUBTIPOS = new Set([
  "Armadura Leve", "Armadura Pesada", "Escudo", "Armadura Natural",
  "Bônus Mágico", "Acessório", "Vestuário", "Ferramenta", "Esotérico"
]);

function toCategoria(type: string, subtipo?: string): ItemCategoria {
  if (type === "arma") return "arma";
  if (type === "consumivel" || type === "pocao") return "consumivel";
  if (subtipo && ARMADURA_SUBTIPOS.has(subtipo)) return "armadura";
  return "geral";
}
```

Search: filter `itens` by `state.escolhasPorItem["equip_search"]` (case-insensitive name match).

Level 1 auto-include: if `state.nivel === 1 && state.origemId`, resolve `itensIniciaisNomes` and auto-add those items to state.equipamento (as qty=1 each) IF not already added. Do this in context preparation as a side-effect on state. OR: just mark them `isInitial` and always show as pre-selected in the cart.

Actually: mark `isInitial` and include in cart display as "free" (no cost). Block removal of initial items. The level 1 specific behavior: at creation time (nivel=1), initial items ARE in the character's inventory.

Block overspent: add to `EquipamentoContext` a `canProceed: boolean = dinheiroRestante >= 0`. In `src/rules/engine.ts` (or wherever step validation happens), validate equipamento step: if `dinheiroRestante < 0` → error.

### templates/wizard/wizard.hbs equipamento block
- Add search input above category tabs
- Add "Armaduras" tab (4th tab)
- level 1 auto-include info note: `{{#if isNivel1}}<p class="t20w-info">Itens iniciais de origem incluídos gratuitamente.</p>{{/if}}`

---

## T3 — Foundry dice rolling (Atributos + Dinheiro)

**Arquivos:** `templates/wizard/wizard.hbs`, `src/wizard/app.ts`, `src/wizard/steps/atributos.ts`

### Rolling methods — atributos
In `app.ts`, add action handler `rollAtributos`:
```typescript
case "rollAtributos": {
  const method = this._state.metodoAtributos;
  const attrs: (keyof typeof this._state.atributosBase)[] = ["for","des","con","int","sab","car"];
  
  if (method === "valkaria") {
    const vals = [4,3,2,2,1,0];
    attrs.forEach((a,i) => { this._state.atributosBase[a] = vals[i]!; });
  } else if (method === "khalmyr") {
    const vals = [3,3,2,2,2,1];
    attrs.forEach((a,i) => { this._state.atributosBase[a] = vals[i]!; });
  } else if (method === "epica") {
    attrs.forEach(a => { this._state.atributosBase[a] = 4; });
  } else if (method === "nimb") {
    attrs.forEach(a => { this._state.atributosBase[a] = 0; });
  } else if (method === "rolagem_padrao") {
    // 4d6kh3 × 6 = roll 4 dice, keep highest 3
    for (let i = 0; i < attrs.length; i++) {
      // @ts-expect-error Roll is a Foundry global
      const roll = await new Roll("4d6kh3").roll({async: true});
      this._state.atributosBase[attrs[i]!] = roll.total ?? 0;
    }
  } else if (method === "classica") {
    // 3d6 × 6
    for (let i = 0; i < attrs.length; i++) {
      // @ts-expect-error Roll is a Foundry global
      const roll = await new Roll("3d6").roll({async: true});
      this._state.atributosBase[attrs[i]!] = roll.total ?? 0;
    }
  }
  await this.render();
  break;
}
```

Add "Rolar" button to atributos template (only shown when `!isCompra`):
```handlebars
{{#unless isCompra}}
<button type="button" data-action="rollAtributos" class="t20w-btn">🎲 Rolar Atributos</button>
{{/unless}}
```

### Rolling money — equipamentos
Add `rollDinheiro` action:
```typescript
case "rollDinheiro": {
  if (this._state.nivel === 1) {
    // @ts-expect-error Roll global
    const roll = await new Roll("4d6").roll({async: true});
    this._state.escolhasPorItem["dinheiro_rolado"] = roll.total ?? 14;
    await this.render();
  }
  break;
}
```

In `equipamento.ts`, check `state.escolhasPorItem["dinheiro_rolado"]` and use it if set (for nivel=1).

Add button to equipamento template near money display:
```handlebars
{{#if isNivel1}}
<button type="button" data-action="rollDinheiro" class="t20w-btn-sm">🎲 Rolar 4d6</button>
{{/if}}
```

---

## T4 — Race powers auto-grant (writer fix)

**Arquivo:** `src/actor/writer.ts`

### Current problem
`Actor.create({name, type, items: [raceItem, classeItem, ...]})` embeds items during creation but does NOT fire each item's `onCreate` Foundry hooks. The `tormenta20` system registers `onCreate` on race items to auto-grant racial powers.

### Fix
Create actor with all items EXCEPT the race item. Then call `actor.createEmbeddedDocuments("Item", [raceData])` separately — this fires the system's `onCreate` hooks.

```typescript
// Separate race item from rest
const raceItemData = resolvedItems.find(item => (item as any).type === "race");
const otherItems = resolvedItems.filter(item => (item as any).type !== "race");

const data = mapStateToActorData(state, otherItems);

const actor = await Actor.create(data) as ActorLike | null | undefined;

if (actor && raceItemData) {
  // This fires tormenta20's onCreate hook → auto-grants racial powers/features
  await (actor as any).createEmbeddedDocuments("Item", [raceItemData]);
}
```

---

## T5 — Build + tag v0.7.0

- `npx tsc --noEmit --skipLibCheck` → fix errors
- `npm test` → 129+ tests green
- `npm run build`
- `git tag v0.7.0-plan7 && git push origin v0.7.0-plan7`

---

## ROADMAP updates

- F1: fully ✅ (Plan 5 + Plan 6A + Plan 6-June02 + Plan 7)
- F4 parcial: race powers via createEmbeddedDocuments ⚠️
- F6 equipamentos: ⚠️ (loja funcional, falta resume/i18n/validação-final)
- Changelog entry: Plan 7 added
