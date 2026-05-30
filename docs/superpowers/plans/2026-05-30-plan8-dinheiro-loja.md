# Plan 8 — Dinheiro inicial + compra de itens (F6 parcial)

**Data:** 2026-05-30
**Cobre:** ROADMAP F6 — dinheiro inicial por nível + loja de compra.
**FORA de escopo:** carga/espaços (o sistema `tormenta20` calcula sozinho a partir dos itens do actor — NÃO replicar).
**Princípio:** dinheiro inicial = dado portado (`data/dinheiro.json`); itens = pack do compêndio Foundry (`equipamentos`, `equipamentos-magicos`). Foundry guarda itens, T20-DB guarda a regra de quanto dinheiro.

> Convenção: cada task = 1 commit em `master`. Após cada: `npx tsc --noEmit` + `npm test`.

---

## Estado atual (verificado nos arquivos — mais avançado que o ROADMAP dizia)
- `data/dinheiro.json` — `por_nivel[]` `{nivel,valor,moeda}` (nv1 `valor:"4d6"`; nv2=300 … nv20=260000 T$) + `nivel_1_dado="4d6"`. ✅ portado.
- `wizard/state.ts` — já tem `state.equipamento: [{itemId,qty}]` + `state.dinheiroRestante`.
- `steps/equipamento.ts::prepareEquipamentoContext` — **loja-scaffold já existe**: lista itens (filtra `equipamento|arma|consumivel|tesouro`), preço de `system.preco` (number), carrinho, subtotal, total, `affordable`, saldo. Falta: busca/filtro UI, wiring de listeners, popular `dinheiroRestante` inicial.
- `actor/mapper.ts` — já grava `system.dinheiro.tl = state.dinheiroRestante` (NÃO é 0). Mas `items[]` é injetado pelo `writer.ts` — **compras + itens de origem ainda não entram no `items[]`**.

### Gap real (o que falta)
1. Computar `dinheiroInicial` e popular `state.dinheiroRestante` (nv1 rolar 4d6; nv2+ fixo). Hoje nada seta o saldo inicial.
2. Materializar compras (`state.equipamento`) no `items[]` do actor (writer resolve do pack).
3. Materializar itens iniciais da origem no `items[]`.
4. UI: busca + filtro + botões add/remove do carrinho (`_onRender`).
5. Verificar campo de preço real do item (`system.preco` é number? confirmar).

---

## Tasks

### T1. Dinheiro inicial real (incl. rolagem nv1) + popular saldo
- **Arquivos:** novo `src/rules/dinheiro.ts`, `src/wizard/state.ts`, `src/wizard/steps/equipamento.ts`.
- **Fazer:**
  - `dinheiroInicial(nivel, roll?) → number` (T$ = Tibar = `tl`): nv1 rola `4d6` (`nivel_1_dado`); nv2+ usa `por_nivel[].valor`.
  - Setar `state.dinheiroBase` na entrada do passo (rolar 1× p/ nv1; re-roll manual via botão, persiste). `state.dinheiroRestante = dinheiroBase − totalCarrinho` (recalcular ao mexer no carrinho).
- **Fonte T20-DB:** `data/dinheiro.json` (já portado).
- **Aceite:** nv1 produz 4-24 T$; nv2 = 300 T$. Saldo estável após rolado.
- **Teste:** `test/rules/dinheiro.test.ts` — nv2+ fixo; nv1 ∈ [4,24].

### T2. Verificar campo de preço do item `equipamento` (FATO do sistema)
- **Fazer:** no mundo de teste, inspecionar um item `equipamento`/`arma` do pack: nome do campo de preço (`system.preco`? `{ valor, moeda }`? número?) e espaços (só p/ exibir, não calcular). Anotar no CLAUDE.md "Fatos do sistema".
- **Aceite:** campo de preço documentado e usado em T3. Sem assumir.
- ⚠️ Bloqueia T3 — confirmar antes de codar a loja.

### T3. Loja — índice + filtro + carrinho
- **Arquivos:** `src/compendium/index.ts` (indexar `equipamentos` + `equipamentos-magicos` com `fields: [preço, tipo, ...]`), novo `src/rules/loja.ts`, `src/wizard/steps/equipamento.ts`, `templates/wizard/equipamento.hbs`, `src/wizard/app.ts` (`_onRender`).
- **Fazer:**
  - Listar itens do pack: nome, preço, categoria. Busca por nome + filtro por categoria.
  - Carrinho: adicionar/remover, quantidade. Saldo = `dinheiroInicial − Σ(preço×qtd)`.
  - Bloquear compra que estoura saldo (saldo negativo proibido).
  - Carrinho persiste em `state.escolhasPorItem.compras = [{itemId, qtd}]`.
- **Aceite:** comprar reduz saldo; não deixa saldo negativo; carrinho sobrevive a navegar passos.
- **Teste:** `test/rules/loja.test.ts` — soma de carrinho, rejeição de saldo negativo (lógica pura, sem Foundry).

### T4. Materializar no actor (itens + saldo restante)
- **Arquivos:** `src/actor/mapper.ts`, `src/actor/writer.ts`.
- **Fazer:**
  - Adicionar cada item comprado ao `items[]` (writer resolve doc por id no pack, `qtd` → `system.quantidade` se existir).
  - Adicionar itens iniciais da origem (já listados) ao actor — buscar por nome no pack `equipamentos`.
  - `system.dinheiro.tl` = saldo restante (T$). Demais moedas 0.
  - Item sumido (módulo removido) → notifica, cria sem ele (padrão existente).
- **Aceite:** actor criado tem itens comprados + saldo restante em `tl`; o sistema mostra a carga derivada sozinho (não escrevemos carga).
- **Teste:** `test/actor/mapper.test.ts` — compras viram `items[]`; `dinheiro.tl` = saldo.

### T5. UX do passo Equipamento
- **Arquivos:** `src/wizard/steps/equipamento.ts`, `templates/wizard/equipamento.hbs`.
- **Fazer:** seções "Dinheiro inicial" (com re-roll nv1), "Itens da origem" (read-only), "Loja" (busca+filtro+carrinho), "Saldo". Sem widget de carga (sistema cuida).
- **Aceite:** passo navegável, saldo visível e correto.

---

## Saída do Plan 8
Personagem nv1 rola dinheiro inicial; nv2+ recebe T$ fixo; jogador compra itens do compêndio
dentro do saldo; itens + saldo restante gravados no actor; carga calculada pelo sistema.

## Atualizações obrigatórias ao concluir
- ROADMAP: F6 — marcar dinheiro+loja ✅ (resume/i18n/validação-final continuam ❌).
- CLAUDE.md: "Fatos do sistema" (campo de preço do item equipamento), "Paridade T20-DB" (loja ✅),
  Mapa (`rules/loja.ts`, `rules/dinheiro.ts`, `state.escolhasPorItem.compras`).
