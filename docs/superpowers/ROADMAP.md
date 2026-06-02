# t20-ficha-wizard — Roadmap forward

**Data:** 2026-05-30
**Status base:** Plans 1-4 implementados; Plan 5 (bugfix-ux) escrito, em execução.
**Spec de referência:** [`specs/2026-05-29-ficha-wizard-design.md`](specs/2026-05-29-ficha-wizard-design.md)

> Roadmap **consolidado**: o que já existe + o que falta até o módulo virar produto
> usável com **paridade ao T20-DB**. Não duplica os Plans 1-5 (que detalham tarefa-a-tarefa);
> aqui é a ordem macro. Cada fase ❌/⚠️ deve virar um Plan próprio antes de executar.
>
> **Princípio-mestre:** a lógica canônica de TODA regra/sub-escolha já existe em
> `T20-DB/motor/` (Python). **Portar, não reinventar.** Dados via `scripts/port-t20db.mjs`.

---

## Legenda

✅ feito · 🔨 em andamento · ⚠️ parcial (funciona mas incompleto) · ❌ não começado

---

## F0 — Fundação ✅ (Plans 1-4)

- ✅ `CompendiumIndex` — varre packs Item do sistema + módulos, índice mínimo cacheado.
- ✅ `RuleEngine` — `getOptions`/`validate`, módulos atributos/perícias/poderes/magias/origem/divindade.
- ✅ `WizardState` — serialize/deserialize, `escolhasPorItem`.
- ✅ `WizardApp` ApplicationV2 — 11 passos scaffolded, navegação, criar actor.
- ✅ `ActorWriter` + `mapper` — `WizardState` → `Actor.create("character")`.
- ✅ Dados portados: `prereqs, origens, divindades, atributos, dinheiro, racas(parcial), poderes-por-nivel, progressao_classes`.

---

## F1 — UI + bugfix ✅ (Plans 5 + 6A + Plan6-June02 + Plan7-June02)

Objetivo: todos os 11 passos navegáveis e usáveis. Tirar do scaffolding.

- ⚠️ `pericias.inatas` string vs array — normalizar (parcialmente feito, commit `5c563c8`).
- ✅ Raça/Origem/Classe/Divindade: select + painel de detalhe (em `wizard.hbs`).
- ✅ Poderes: lista com nome + descrição + motivo específico de inelegibilidade + busca + filtro de categoria (Plan 6A).
- ✅ Classe: descrição no painel de detalhe (Plan 6A).
- ✅ `_onRender` listeners do padrão select+detail, pick-2 e filtro de poderes.
- ✅ Raça free-attribute (modificador escolhível) + Origem pick-2 — UI mínima.

**Saída:** wizard inteiro clicável de ponta a ponta, sem tela quebrada. Critério: criar um guerreiro nv1 sem erro.

---

## F2 — Sub-escolhas core 🔨 (o grande diferencial)

Implementar `src/rules/subescolhas.ts` (hoje stub) + materialização no `mapper`. Portar de `T20-DB/motor/construtor.py`.

- ✅ **Modificadores escolhíveis de raça** — humano +1 em 3 atributos diferentes; mashin/sereia +1 em N. `getRaceModifierGroups`/`validateRaceModifiers` (porta `_validar_modificadores`); UI = N selects por grupo; choices em `escolhasPorItem.raca_modificadores`; mapper soma em `atributos.*.base`; engine valida no passo Raça. Dados: `racas.json.atributos_escolha`. *(meio-elfo Int fixo + 2 escolhíveis = não no JSON portado ainda.)*
- ❌ **Multipath de classe** — Arcanista → Bruxo/Mago/Feiticeiro; Bárbaro→Trilha; etc. Sub-passo após escolher classe. Grava em `escolhasPorItem`.
- ❌ **Pick-2 de origem** — escolher 2 entre perícias/poderes da origem; materializar por nome no pack. Regra já existe em `rules/origem.ts`, falta UI+writer.
- ❌ Resolver genérico `resolveSubescolhas(context)` → `[{key,label,options}]` consumido pela UI.

**Saída:** humano, meio-elfo e arcanista criáveis com as escolhas corretas gravadas no actor.

---

## F3 — Raças complexas ❌

Portar variações e construtores do T20-DB (`racas/*.variacoes`, `racas/*.construtor`). Estender `scripts/port-t20db.mjs` + `racas.json`.

- ❌ **Variações** — Suraggel→Aggelus/Sulfure, Hynne→Comum/Sambaqui, etc. Payload exige `variacao`.
- ❌ **`variacao_de_outra_raca`** — Trog Anão, Soterrado, Mashin (chassi base + overrides).
- ❌ **Construtor passo-a-passo** — Duende (4 tipos de passo) e Golem. UI dedicada de N passos dentro do passo Raça.
- ❌ Linhagem feiticeiro / especialista em escola / familiar arcano — sub-escolhas de poder/classe que abrem picker próprio.

**Saída:** Duende, Golem e Suraggel criáveis. Feiticeiro com linhagem.

---

## F4 — Auto-grant por nível ⚠️

Poderes e habilidades automáticas que a classe/raça concede sem o jogador escolher.

- ❌ Ler `data/poderes-por-nivel.json` no `RuleEngine`; separar `poderesAutoGrant` (não contam na cota).
- ❌ `mapper` adiciona os itens auto-grant ao `items[]` do actor, buscados por slug no pack.
- ❌ Habilidades de classe automáticas do nível 1..N (a partir da `progressao_classes.json`).
- ❌ UX: mostrar auto-grants como "recebidos" (read-only), distintos dos escolhíveis.
- ✅ Race powers: `createEmbeddedDocuments` fix — race item adicionado separadamente para disparar hooks `onCreate` do sistema e auto-conceder poderes raciais.

**Saída:** personagem nv5+ vem com todos os poderes/habilidades de nível corretos, sem o jogador ter que escolher os fixos.

---

## F5 — Paridade de pré-requisitos ❌

`rules/poderes.ts` cobre 6 tipos; `T20-DB/motor/prerequisitos.py` cobre ~15. Portar os faltantes.

- ❌ `nivel_classe`, `pericia_treinada`, `habilidade_classe`, `habilidade_racial`, `divindade`/`devoto`, `proficiencia`, `poder_subcategoria`, `poder_caminho`, `escola_de_magia`, `magia`, `linhagem`.
- ❌ Tipos manuais/narrativos não bloqueiam (espelhar T20-DB).
- ❌ Testes vitest por tipo, com fixtures de `prereqs.json`.

**Saída:** elegibilidade de poder idêntica ao motor do T20-DB.

---

## F6 — Polish & produto ❌

- ❌ **Equipamento loja completa** — categorias, busca, carrinho, saldo (nv2+). MVP nv1 = pacote inicial direto.
- ❌ **Resume** — persistir `WizardState` em `game.user.setFlag`, sobreviver a refresh.
- ❌ **Limites de magia afinados** por classe/nível (conhecidas vs slots).
- ❌ **i18n** — completar `lang/pt-BR.json`; preparar gancho en.
- ❌ **Validação final na Revisão** — bloquear "Criar" se algo obrigatório faltou; listar pendências.

**Saída:** fluxo completo, com loja e resume. Módulo publicável.

---

## Fora de escopo (pós-1.0)

- Level-up de actor existente (wizard só cria novos).
- Export PDF (o T20-DB já faz; não replicar no Foundry).
- NPCs / outros tipos de actor.
- Sistemas não-`tormenta20`.
- Foundry < v13.

---

## Marco "produto mínimo usável"

**F1 + F2 + F4** = criar personagens nv1-20 das classes/raças comuns, com sub-escolhas e
auto-grants corretos. F3/F5/F6 expandem cobertura e polem.

---

## Changelog

- **2026-05-30:** Criação. Estado base: Plans 1-4 ✅, Plan 5 🔨. Fases F1-F6 derivadas do gap T20-DB↔módulo.
- **2026-05-30:** Plans escritos cobrindo F1-resto→F5: [`plan6`](plans/2026-05-30-plan6-descricoes-subescolhas-racas.md) (F1 descrições+poderes, F2 multipath+pick-2, F3 variações/construtor/linhagem) e [`plan7`](plans/2026-05-30-plan7-autogrant-prereqs.md) (F4 auto-grant por nível, F5 pré-requisitos).
- **2026-05-30:** [`plan8`](plans/2026-05-30-plan8-dinheiro-loja.md) — F6 parcial: dinheiro inicial (rolagem nv1 + fixo nv2+) + loja de compra. **Carga fora de escopo** (sistema `tormenta20` calcula). Resta de F6 (resume/i18n/validação-final) sem Plan.
- **2026-05-30:** [`plan6a`](plans/2026-05-30-plan6a-poderes-list-exec.md) **EXECUTADO** (6 tasks TDD, 126 testes verdes). Poderes step: descrição + motivo específico de pré-req (`formatPrereq`/`describeUnmet`) + filtro de categoria; descrição da classe no painel. F1 → ✅. **Desvio do plano:** T6 previa porte de `classe.descricao` do T20-DB, mas T20-DB **não tem** esse campo (classes só carregam regras). Descrição da classe vem do **item Foundry** (`IndexedClasse.system.descricao`, indexado), igual à descrição de poder (T2) — sem mexer em `port-t20db.mjs`/`classes.json`. Corrigida corrupção de working-tree em `index.ts` (typo `pivPorNivel`, `system.pericias` perdido) deixada por subagente interrompido. Pendência in-world: confirmar campo real (`system.descricao` vs `system.description.value`) dos itens poder/classe.
- **2026-06-02:** Plan 6 (June02) executado: slug fix (UUID→slug para divindade/magias), botões +/- atributos, enforcement de perícias, redesign do passo poderes (auto-grant nv1, pick nv2+), fix magias (circulo coerce, tipo relaxado), equipamentos (4 abas, busca, carrinho, dinheiro, rolagem de dados), race powers (createEmbeddedDocuments). F1 totalmente ✅. F4 parcial ⚠️.
