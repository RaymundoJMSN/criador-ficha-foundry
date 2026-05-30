# Plan 6 — Descrições, sub-escolhas e raças complexas (F1-resto + F2 + F3)

**Data:** 2026-05-30
**Cobre:** ROADMAP F1 (descrições + lista de poderes), F2 (multipath classe + pick-2 origem), F3 (variações + construtor + linhagem).
**Princípio:** portar de `T20-DB/motor/construtor.py`, NÃO reinventar. Dados via `npm run port`.
**Pré-requisito:** Plan 5 (bugfix-ux) mergeado.

> Convenção: cada task = 1 commit em `master`. Após cada commit: `npx tsc --noEmit` + `npm test`.
> Caminho T20-DB: `../Ideias e RPG/T20-DB/` (fallback `T20DB_ROOT`).

---

## Bloco A — Descrições e detalhe (fecha F1)

### A1. Painel de detalhe para Raça/Classe/Origem/Divindade
- **Problema:** passos mostram grid; falta `descricao` + mecânica do item.
- **Arquivos:** `src/wizard/steps/{raca,classe,origem,divindade}.ts`, `templates/wizard/{raca,classe,origem,divindade}.hbs`, `src/wizard/app.ts` (`_onRender`).
- **Fazer:** padrão **select + painel**. Painel puxa:
  - Raça: `descricao` do item Foundry (`description.value`) + tipo, tamanho, deslocamento + habilidades raciais (cards com `<details>` para efeitos). Atributos fixos/escolha vindos de `data/racas.json`.
  - Classe: `descricao` do item + PV/PM/atributo-chave + perícias da classe (de `getClasse`) + habilidades automáticas nv1.
  - Origem/Divindade: descrição + benefícios.
- **Fonte:** descrição = item do compêndio; regra = `src/data/*.json`. NUNCA ler regra do item.
- **Aceite:** ao selecionar cada item, painel mostra texto + mecânica. Sem `[object Object]`.

### A2. Lista de poderes com nome + elegibilidade (fecha F1 poderes)
- **Problema:** passo Poderes é grid só-imagem; "não faz sentido".
- **Arquivos:** `src/wizard/steps/poderes.ts`, `templates/wizard/poderes.hbs`, `src/rules/poderes.ts`.
- **Fazer:** lista com nome + descrição curta + badge de elegibilidade (`isEligible`). Mostrar **por que** inelegível (texto do pré-req faltante). Contador "X de N escolhidos" do nível.
- **Depende:** quantos poderes o nível concede → `getClasse().tabela_progressao` / Plan 7 F4. Por ora usar a cota de "Poder de Classe" da progressão; auto-grants entram no Plan 7.
- **Aceite:** lista legível, filtra elegíveis, conta cota corretamente para nv1.

---

## Bloco B — Sub-escolhas core (F2)

### B1. Resolver genérico de sub-escolhas
- **Arquivos:** `src/rules/subescolhas.ts` (`resolveSubescolhas` hoje stub, L115).
- **Fazer:** `resolveSubescolhas(context) → [{key,label,options,quantidade,obrigatoria}]` unificando: modificadores de raça (já feito), multipath classe (B2), pick-2 origem (B3). UI itera o retorno.
- **Aceite:** retorno tipado consumível pela UI; modificadores de raça migram para o resolver sem regressão.

### B2. Multipath de classe (Arcanista→Bruxo/Mago/Feiticeiro etc.)
- **Fonte T20-DB:** `construtor.py::_aplicar_classe` (~L2899) + `_aplicar_efeitos_linhagem_basica` (~L3040).
- **Arquivos:** `scripts/port-t20db.mjs` (emitir `caminhos[]`/`linhagens[]` em `classes.json`), `src/rules/classe.ts` (`ClasseSpec.caminhos`), `src/rules/subescolhas.ts`, `src/wizard/steps/classe.ts`, `src/wizard/state.ts` (`escolhasPorItem.classe_caminho`), `src/actor/mapper.ts`.
- **Fazer:** após escolher classe, sub-passo de caminho. Feiticeiro → sub-escolha de linhagem (4×3 tiers). Gravar em `escolhasPorItem`; mapper aplica flags/itens.
- **Aceite:** arcanista exige caminho; feiticeiro exige linhagem; bruxo/mago não pedem extra.
- **Teste:** `test/rules/subescolhas.test.ts` — caminho obrigatório p/ arcanista, opcional onde não há.

### B3. Pick-2 de origem (materialização no actor)
- **Fonte T20-DB:** `_aplicar_origem` (~L3115). Regra já em `rules/origem.ts` (`getOrigemBeneficioPool`).
- **Arquivos:** `src/wizard/steps/origem.ts`, `templates/wizard/origem.hbs`, `src/rules/engine.ts` (validar pick-2 no passo), `src/actor/mapper.ts` (materializar por nome no pack), `src/wizard/state.ts` (`escolhasPorItem.origem_beneficios`).
- **Fazer:** UI pick-2 do pool (perícias + poderes + poder_unico). Perícias escolhidas viram locked no passo Perícias. Poderes/poder_unico viram itens no actor (busca por nome no pack `poderes`/`poderes-distincao`).
- **Aceite:** origem com pool>2 exige exatamente 2; itens aparecem no actor criado.
- **Teste:** `test/rules/origem.test.ts` — pool, exigência de 2, perícia escolhida marca treinada.

---

## Bloco C — Raças complexas (F3)

### C1. Estender porte de raças (variações + construtor)
- **Fonte T20-DB:** `data/racas/*.json` (`variacoes[]`, `variacao_de_outra_raca`, `construtor`).
- **Arquivos:** `scripts/port-t20db.mjs`, `src/data/racas.json` (regenerado), `src/rules/raca.ts` (`RacaSpec` ganha `variacoes`, `raca_base`, `construtor`).
- **Fazer:** porte passa a emitir variações, chassi-base e passos de construtor. `npm run port` regenera.
- **Aceite:** `racas.json` contém Suraggel.variacoes, Trog Anão.raca_base, Duende.construtor.

### C2. Variações de raça
- **Fonte:** `construtor.py::_aplicar_raca` ramo `variacoes[]`.
- **Arquivos:** `src/rules/subescolhas.ts`, `src/wizard/steps/raca.ts`, `state.ts` (`escolhasPorItem.raca_variacao`), `mapper.ts`.
- **Fazer:** raça com `variacoes[]` exige escolha; aplica top-level + bloco da variação (modificadores, habilidades, sentidos).
- **Aceite:** Suraggel→Aggelus/Sulfure; Hynne→Comum/Sambaqui criáveis com efeitos certos.
- **Teste:** `test/rules/raca.test.ts` — variação obrigatória, modificadores da variação somam.

### C3. `variacao_de_outra_raca` (Trog Anão, Soterrado, Mashin)
- **Arquivos:** `src/rules/raca.ts`, `mapper.ts`.
- **Fazer:** resolver chassi base + overrides da variante.
- **Aceite:** Trog Anão usa base Trog + overrides; sem duplicar habilidade.

### C4. Construtor passo-a-passo (Duende, Golem)
- **Fonte:** `_validar_construtor` (~L1504) + `_aplicar_construtor` (~L1631).
- **Arquivos:** `src/rules/subescolhas.ts`, `src/wizard/steps/raca.ts`, `templates/wizard/raca.hbs`, `state.ts` (`escolhasPorItem.raca_construtor`), `mapper.ts`.
- **Fazer:** 4 tipos de passo (`escolha_unica`, `escolha_atributos`, `pool_escolhas`, `fixo`). UI renderiza N passos dentro do passo Raça; valida cada um.
- **Aceite:** Duende e Golem criáveis com todas as escolhas; "Confirmar" só libera completo.
- **Teste:** `test/rules/subescolhas.test.ts` — cada tipo de passo do construtor.

### C5. Linhagem feiticeiro / especialista escola / familiar
- **Arquivos:** `src/rules/subescolhas.ts`, `src/wizard/steps/{classe,poderes}.ts`, `mapper.ts`.
- **Fazer:** sub-escolhas de poder/classe que abrem picker próprio (escola de especialista, tipo de familiar, tier de linhagem).
- **Aceite:** feiticeiro com linhagem + apoteose; especialista escolhe escola; familiar escolhe tipo.

---

## Saída do Plan 6
Humano, meio-elfo, arcanista (c/ caminho+linhagem), Suraggel, Duende e Golem criáveis com sub-escolhas corretas gravadas no actor. Passos de Raça/Classe/Origem/Divindade/Poderes legíveis com descrição.

## Atualizações obrigatórias ao concluir
- ROADMAP: F1→✅, F2→✅, F3→✅ (conforme tasks fechadas).
- CLAUDE.md: "Paridade T20-DB" (mover ❌→✅), Mapa (novos campos em `state.ts`/`subescolhas.ts`), "Fatos do sistema" se descobrir algo novo.
