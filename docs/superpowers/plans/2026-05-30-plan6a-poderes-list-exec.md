# Plan 6A (executável) — Lista de poderes legível + enriquecer classe

**Data:** 2026-05-30
**Refina:** Plan 6, Bloco A. **Pré-req:** Plan 5 mergeado.
**Escopo real (verificado no código):** A maior parte do Bloco A JÁ EXISTE.
- ✅ Raça: select + painel detalhe (descrição, tamanho, deslocamento, fixos, habilidades `<details>`, modifier groups) — `steps/raca.ts` + `raca.hbs`.
- ✅ Classe: select + painel (descrição, PV, PM) — `steps/classe.ts` + `classe.hbs`.
- ❌ **Poderes: grid só-imagem** (`poderes.hbs`) — img + nome, `disabled` se inelegível. **Sem descrição, sem motivo da inelegibilidade, sem busca/filtro.** É a "seção poder sem sentido" reclamada.
- ⚠️ Classe: falta atributo-chave + perícias da classe + habilidades nv1 no painel.

> **Git:** commit direto em `master`, sem branch/PR/worktree (regra do projeto > skills). Após CADA task: `npx tsc --noEmit` && `npm test`. Verde → `git commit` + `git push origin master`.
> **TDD:** onde há lógica pura (VM/formatter), escrever teste primeiro (vermelho), implementar (verde), refatorar.

---

## Task 1 — Formatter legível de pré-requisito (TDD, lógica pura)
**Objetivo:** transformar `Prereq` em texto PT curto, p/ mostrar por que um poder está bloqueado.

1. **Teste primeiro** — `test/rules/poderes.test.ts`, adicionar:
   - `formatPrereq({tipo:"atributo",atributo:"for",valor:3})` → `"Força 3"`.
   - `formatPrereq({tipo:"nivel",valor:5})` → `"Nível 5"`.
   - `formatPrereq({tipo:"poder",poder:"ataque_poderoso"})` → `"Poder: ataque poderoso"`.
   - `formatPrereq({tipo:"pericias",pericia:"luta"})` → `"Treinado em Luta"`.
   - `formatPrereq({tipo:"classe",classe:"guerreiro"})` → `"Classe: Guerreiro"`.
   - tipo desconhecido → string genérica (não quebrar).
   - `describeUnmet(poderSlug, state)` → `string[]` (vazio se elegível).
2. **Rodar** `npm test` → vermelho.
3. **Implementar** em `src/rules/poderes.ts`: `formatPrereq(req): string` (switch por tipo, espelha os 6 tipos hoje) + `describeUnmet(slug,state): string[]` (usa `checkPrereqs(...).unmet.map(formatPrereq)`).
4. **Verde.** `npx tsc --noEmit && npm test`. Commit: `feat(poderes): formatPrereq + describeUnmet legíveis`.

**Aceite:** todos os casos passam; tipos extras (Plan 7) não quebram (fallback genérico).

---

## Task 2 — Expor descrição + motivo no VM de poderes (TDD)
**Objetivo:** `PoderVM` ganha `descricao` e `unmet[]`.

1. **Teste primeiro** — novo `test/wizard/poderes-vm.test.ts`:
   - dado um poder inelegível, `vm.eligible===false` e `vm.unmet.length>0`.
   - dado elegível, `vm.unmet.length===0`.
   - `vm.descricao` vem do `IndexedPoder.descricao`.
2. **Vermelho.**
3. **Implementar** em `src/wizard/steps/poderes.ts`:
   - `PoderVM` += `descricao?: string`, `unmet: string[]`.
   - trocar `isEligible(...)` por `describeUnmet(p.id, partialState)`; `eligible = unmet.length===0`.
   - mapear `descricao: p.descricao`.
4. **Verde.** Commit: `feat(poderes): VM expõe descrição + motivos de inelegibilidade`.

**Aceite:** VM testável sem Foundry; motivo presente.

---

## Task 3 — Template lista (grid → linhas legíveis)
**Objetivo:** matar o grid só-imagem.

1. Reescrever `templates/wizard/poderes.hbs`:
   - `<input data-action="filterPoderes" placeholder="Buscar poder…">` + `<select data-action="filterCategoria">` (categorias dos poderes).
   - lista de linhas: `img` pequeno + `name` + `descricao` truncada + badge.
   - elegível → badge verde "Disponível"; inelegível → badge cinza + `title="{{#each unmet}}{{this}}; {{/each}}"` e `disabled`.
   - manter `data-action="togglePoder" data-id`.
   - contador `{{slotsUsados}} / {{slotsTotal}}` no topo.
2. `npx tsc --noEmit` (template não compila, mas garante que VM bate). `npm test`.
3. Commit: `feat(poderes): lista com nome, descrição e motivo (remove grid)`.

**Aceite:** render mostra nome+descrição+motivo; sem `[object Object]`.

---

## Task 4 — Busca + filtro de categoria (listeners)
**Objetivo:** filtrar a lista no cliente.

1. Em `src/wizard/app.ts` `_onRender` (padrão `data-action` já usado p/ `selectRaca`/`togglePoder`):
   - `filterPoderes` (input): esconder linhas cujo nome não casa (case-insensitive). Sem re-render (manipular DOM) p/ não perder foco.
   - `filterCategoria` (select): idem por `data-categoria` na linha.
2. Adicionar `data-categoria` e `data-name` nas linhas do `.hbs` (Task 3).
3. `npx tsc --noEmit && npm test`. Commit: `feat(poderes): busca + filtro de categoria`.

**Aceite:** digitar filtra; trocar categoria filtra; seleção persiste.

---

## Task 5 — Enriquecer painel de classe (A1 restante)
**Objetivo:** painel de classe mostra atributo-chave + perícias + habilidades nv1.

1. `src/wizard/steps/classe.ts`: `detalhe` += `atributoChave`, `pericias: {fixas[], escolhas}`, `habilidadesNivel1: string[]` (de `getClasse` + `habilidades_classe_ids`; nomes resolvidos no compêndio quando possível).
   - teste em `test/rules/classe.test.ts` se adicionar helper puro.
2. `templates/wizard/classe.hbs`: render dos novos campos.
3. `npx tsc --noEmit && npm test`. Commit: `feat(classe): painel mostra atributo-chave, perícias e habilidades nv1`.

**Aceite:** ao escolher classe, painel lista perícias fixas + habilidades de nv1.

---

## Fora deste plano
- **Slots de poder por nível** (`slotsTotal`): depende de Plan 7 (cota por nível). Aqui usa o valor que o state já fornece.
- Pool ampliado (categorias gerais + concedido divindade): Plan 7.
- Origem/Divindade detail: já seguem o padrão select+detail (verificar lore quando porte de descrição existir).

## Atualizações ao concluir
- ROADMAP: F1 → ✅ (descrições + lista de poderes).
- CLAUDE.md: "Paridade T20-DB" (poderes elegibilidade com motivo ✅), Mapa (`formatPrereq`/`describeUnmet` em `rules/poderes.ts`).
