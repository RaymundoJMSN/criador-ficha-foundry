# Plan 8 — Dinheiro inicial + compra de itens (F6 parcial)

**Data:** 2026-05-30
**Cobre:** ROADMAP F6 — dinheiro inicial por nível + loja de compra.
**FORA de escopo:** carga/espaços (o sistema `tormenta20` calcula sozinho a partir dos itens do actor — NÃO replicar).
**Princípio:** dinheiro inicial = dado portado (`data/dinheiro.json`); itens = pack do compêndio Foundry (`equipamentos`, `equipamentos-magicos`). Foundry guarda itens, T20-DB guarda a regra de quanto dinheiro.

> Convenção: cada task = 1 commit em `master`. Após cada: `npx tsc --noEmit` + `npm test`.

---

## Estado atual
- `data/dinheiro.json` — `por_nivel` (nv1=0; nv2=150 … nv20=900000 T$) + `nivel_1_dado="4d6"`. ✅ portado.
- `rules/atributos.ts::dinheiroInicial(nivel)` — retorna o fixo por nível (nv1 retorna 0).
- `steps/equipamento.ts` — mostra saldo + itens da origem. **Sem loja.**
- `actor/mapper.ts` — `system.dinheiro = {tc,tl,to,tp}` hardcoded **0**. Não escreve compras.

---

## Tasks

### T1. Dinheiro inicial real (incl. rolagem nv1)
- **Arquivos:** `src/rules/atributos.ts` (ou novo `src/rules/dinheiro.ts`), `src/wizard/state.ts`.
- **Fazer:**
  - nv1: rolar `4d6` T$ (campo `nivel_1_dado`) uma vez; guardar em `state.dinheiroInicial`. Re-roll manual permitido (botão), valor persiste no state.
  - nv>1: usar `por_nivel[nivel]` (fixo).
  - Função `dinheiroInicial(nivel, roll?)` → número em T$ (= Tibar = `tl`).
- **Fonte T20-DB:** `data/regras/equipamento_inicial.json` (já portado).
- **Aceite:** nv1 produz 4-24 T$; nv5 = 1200 T$. Valor estável após rolado (não muda a cada render).
- **Teste:** `test/rules/dinheiro.test.ts` — nv>1 fixo; nv1 dentro de [4,24].

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
