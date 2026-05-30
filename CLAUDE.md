# t20-ficha-wizard — Contexto para o Claude

> Módulo **Foundry VTT v13** que adiciona um wizard de criação de personagem
> Tormenta 20 ao sistema `tormenta20`. Lê conteúdo (raças, classes, poderes,
> magias, equipamentos) dos **compêndios do sistema**; embute as **regras de
> criação portadas do projeto T20-DB** (que o sistema não expõe). Resultado: um
> actor `character` válido — o sistema deriva PV/PM/Defesa/perícias/CD.

---

## 🎯 FOCO ATUAL

Levar o wizard de "scaffolding navegável" a "paridade com o T20-DB". A ordem está
em [`docs/superpowers/ROADMAP.md`](docs/superpowers/ROADMAP.md). Fase atual: **F1 (UI+bugfix)** /
**F2 (sub-escolhas core)**. O grande diferencial — sub-escolhas (caminhos de
arcanista, modificadores de atributo de raça, construtor de Golem/Duende,
pick-2 de origem) — ainda é stub em `src/rules/subescolhas.ts`.

---

## 🔥 FLUXO GIT — REGRA ABSOLUTA

Branch padrão = **`master`**. Único fluxo: mudança → `git commit` direto em `master` → `git push origin master`.

- **NÃO criar branches.** Trabalhar direto em `master`.
- **NÃO abrir PRs.** Não usar `gh pr create`.
- Cada conjunto coerente de mudanças = 1 commit + 1 push imediato.
- Pre-commit falhando → corrigir causa raiz, recommitar (NUNCA `--no-verify`).
- Push divergente → `git pull --rebase origin master` → resolver → push.

Aplicar silenciosamente após qualquer alteração, sem perguntar.

---

## Stack (resumo de 5 linhas)

- **TypeScript strict** → bundle ESM via **Vite** (lib mode) → `dist/module.js` (+ copia `templates/`, `lang/`, `assets/`).
- **Foundry v13** — ApplicationV2 / HandlebarsApplicationMixin. Tipos via `fvtt-types` (pinado — community/main churna).
- **Sistema alvo:** `tormenta20` (>= 1.5.015). `module.json` declara `relationships.requires`.
- **Regras de criação:** JSON portado do T20-DB embutido em `src/data/` (o sistema só roda a ficha, não cria).
- **Testes:** `vitest` headless sobre `src/rules/*` (TS puro, sem Foundry). Camada Foundry validada em mundo de teste.

## Como rodar

```
npm install
npm run build          # vite → dist/module.js (+ assets)
npm run dev            # vite watch (rebuild em cada save)
npm test               # vitest (rules/*)
npx tsc --noEmit       # typecheck strict
```

**Instalar no Foundry:** symlink/junction `dist + module.json + templates + lang + assets` em
`Data/modules/t20-ficha-wizard/`, ou apontar o manifest. Requer o sistema `tormenta20` ativo no mundo.
Toda mudança de regra/UI → `npm run build` → reload do mundo (F5) para ver efeito.

---

## 🧠 PRINCÍPIO MESTRE — Foundry guarda ITENS, T20-DB guarda REGRAS

**O sistema `tormenta20` no Foundry é só um repositório de _itens_** (poder, equipamento,
classe, magia, race). Esses itens são **conteúdo** (nome, descrição, img, efeitos do item) —
**NÃO carregam a lógica de criação de ficha.** Nada no Foundry diz "guerreiro treina Fortitude",
"humano escolhe +1 em 3 atributos", "esta classe sobe X por nível". **Toda essa lógica vive no
T20-DB e é portada para `src/data/` + `src/rules/`.** Nosso módulo é ~99% igual ao T20-DB; a única
diferença é que pegamos os itens do compêndio do Foundry e montamos o actor direto no Foundry.

➡️ **Consequência prática:** ao implementar qualquer regra (perícias, atributos, progressão,
auto-grant, pré-requisitos), a fonte é **`src/data/*.json` (portado do T20-DB)**, NUNCA campos do
item Foundry. Ler `classe.system.pericias`, `race.system.atributos` etc. como regra = bug (foi a
causa de "todas perícias treinadas" e "humano sem escolher atributos"). O item Foundry só entra
no `items[]` do actor + fornece descrição/efeitos próprios do item.

---

## ⚠️ Fatos do sistema `tormenta20` (NÃO assumir — verificado em v1.5.015)

Estes fatos invalidam premissas "óbvias" vindas de outros sistemas. Mudou? Re-verificar
em `system.json` + `templates/` + `tormenta20.mjs` do sistema instalado.

**Tipos de Item:** `arma`, `equipamento`, `classe`, `comodo`, `consumivel`, `magia`, `mobilia`, `poder`, `race`, `tesouro`.

- Raça = tipo **`race`** (inglês). **NÃO existe tipo `origem` nem `divindade`.**

**Packs do sistema:** `racas`, `classes`, `poderes`, `poderes-distincao`, `equipamentos`, `equipamentos-magicos`, `magias`, `pocoes`, `parceiros`, ... (+ Actors/Journal/RollTable).

- **Sem pack de origens, sem pack de divindades.** `poderes` e `poderes-distincao` são separados — indexar ambos.

**Actor jogável = `character`.** Token attrs: `attributes.pv` (primário), `attributes.pm` (secundário).

**Atributos:** `system.atributos.{for,des,con,int,sab,car}` é SchemaField com `base, racial, bonus, temp, value`.

- `value` é **derivado** pelo sistema. O item `race` preenche `.racial` e seta `detalhes.raca`.
- ➡️ **O wizard escreve SÓ `system.atributos.{attr}.base`.** Nunca `.value` nem `.racial`. Elimina dupla aplicação.

**Origem e Divindade = TEXTO:** `system.detalhes.origem` / `system.detalhes.divindade` (strings). Benefícios (poderes/itens) materializados buscando por **nome** nos packs.

**Dinheiro:** `system.dinheiro` = `{tc, tl, to, tp}` (cobre/prata-Tibar/ouro/platina). Moeda principal = **`tl` (T$, Tibar)**. Dinheiro inicial vai em `dinheiro.tl`.

**Perícias (chaves do actor):** `system.pericias.{code}` onde **`code` = 4 letras** (`acro ades atle atua cava conh cura dipl enga fort furt guer inic inti intu inve joga ladi luta mist nobr perc pilo pont refl reli sobr vont`). Treino = `system.pericias.{code}.treinado` (Boolean). **NÃO** é o slug completo (`fortitude`).

- ⚠️ Dados portados (progressao/racas/origens) usam slug completo. **Traduzir slug→code via `src/rules/pericia-slug.ts` (`toPericiaCode`) antes de escrever no actor.** "Ofício" não tem code único (explode em alfa/alqu/...) → mapeia para `null` e é pulado.

**Classe = só ITEM (sem regra de criação).** O item `classe` tem campos (`system.pericias.*` etc.)
mas eles **NÃO são confiáveis/completos** e **não devem ser lidos como regra**. A regra canônica de
classe (perícias fixas/obrigatórias/escolhas, pv/pm, proficiências, habilidades/poderes por nível)
vive em **`src/data/classes.json`** (portado de `T20-DB/data/classes/*.json` via `npm run port`),
consumida por **`src/rules/classe.ts` (`getClasse`)**. O item Foundry entra só no `items[]` do actor.

- **Perícia de classe (modelo canônico, `caracteristicas.pericias`):** `fixas` (auto-treinadas) +
  `escolhas_obrigatorias[]` (`{quantidade,opcoes}`, ex. guerreiro Luta|Pontaria) +
  `escolhas{quantidade,opcoes}` (N da lista da classe) + extras por **Int FINAL** (`max(0, base+racial)`,
  qualquer perícia) + raça Versátil/etc (qualquer perícia). Ver `rules/pericias.ts`.

**Magia:** `system.circulo` (Number 1–5), `system.tipo` (`arc`/`div`), `system.escola` (`abj/adv/con/enc/evo/ilu/nec/tra`).

**Poder:** `system.tipo/subtipo/alcance/area/ativacao/duracao/efeito`. **NÃO existe campo de pré-requisito estruturado** — só texto em `description.value`.

- ➡️ **Validação de pré-requisito vem dos dados T20-DB** (`src/data/prereqs.json`), casados por slug.

---

## Mapa de arquivos críticos

**Raiz**

- `module.json` — id `t20-ficha-wizard`, requires `tormenta20`, compat v13, `esmodules: dist/module.js`.
- `vite.config.ts` — lib mode + copy plugin (templates/lang/assets). `vitest.config.ts` — testes de rules.
- `scripts/port-t20db.mjs` — gera `src/data/*.json` a partir do T20-DB. **Re-rodar quando o T20-DB mudar.**

**`src/`**

- `module.ts` — hooks: `init` (define WizardApp, settings), `ready` (`CompendiumIndex.build()` + UI).
- `constants.ts` — `MODULE_ID`, `SYSTEM_ID="tormenta20"`, `CHARACTER_TYPE="character"`, `ITEM_TYPES`, `EXTRA_MODULE_IDS[]` (aditivo, nunca filtro exclusivo).

**`src/compendium/`** — leitura dos packs do sistema

- `index.ts` — `CompendiumIndex` singleton. `build()` varre TODO `game.packs` Item, `getIndex({fields})` (campos explícitos, senão só traz `_id/name/img`), cacheia por tipo. API: `getAll(type)`, `getById(type,id)`, `rebuild()`.
- `types.ts` — `IndexedRace/Classe/Poder/Magia/Item`. `slug.ts` — normalização de slug (espelha scripts T20-DB).

**`src/data/`** — JSON portado do T20-DB (embutido no bundle)

- `prereqs.json` (108KB) — `pre_requisitos[]` por slug de poder · `classes.json` — **spec canônico por classe** (perícias fixas/obrigatorias/escolhas, pv/pm, proficiências, habilidades/poderes ids; fonte `T20-DB/data/classes/*.json`) · `origens.json` · `divindades.json` (sem descrição — T20-DB não porta lore) · `atributos.json` · `dinheiro.json` · `racas.json` (atributos fixos/escolha — **parcial: falta variações/construtor**) · `poderes-por-nivel.json` (auto-grant) · `progressao_classes.json` (intermediário lossy — preferir `classes.json`) · `slug-map.json`.

**`src/rules/`** — regras estruturais T20 (TS puro, testável)

- `engine.ts` — orquestrador: `getOptions(step, state)`, `validate(step, choice, state)`. `steps.ts` — `WizardStep` enum + ordem + metadata (condicional/obrigatório).
- `atributos.ts` — point buy + métodos rolagem · `classe.ts` — `getClasse(id|nome)` (spec canônico de `classes.json`: perícias/pv/pm/habilidades/poderes) · `pericias.ts` — `buildPericiaPlan(classe, IntFinal, raçaBonus)` + `computeTrained(plan, picks)` (modelo canônico fixas/obrigatorias/escolhas/Int/raça) · `raca.ts` — `getRaca(id|nome)`, `getRaceSkillBonus`, `getRaceFixedModifiers` · `pericia-slug.ts` — `toPericiaCode(slug)` + `PERICIA_SLUGS`/`PERICIA_CODES` · `subescolhas.ts` — modificadores de raça + `getRaceAttributeTotals` (fixed+chosen, p/ Int final) · `poderes.ts` — `checkPrereqs`/`isEligible` (lê `prereqs.json`; **6 tipos hoje:** atributo/nivel/poder/classe/raca/pericias) · `magias.ts` — círculos/limites + filtro · `origem.ts` — pick-2 + `formatItensIniciais` · `divindade.ts` — filtro devotos (raça OR classe), druida fixo, obrigatória clérigo/paladino/druida.
- `subescolhas.ts` — ⚠️ **parcial.** ✅ **modificadores escolhíveis de raça** (`getRaceModifierGroups`/`validateRaceModifiers`, porta `_validar_modificadores`; choices em `escolhasPorItem.raca_modificadores: string[][]`, aplicados em `atributos.*.base` pelo mapper). Stub ainda: especialista escola, familiar, linhagem feiticeiro, construtor Duende/Golem, multipath classe, pick-2 origem. Ver ROADMAP F2/F3.

**`src/wizard/`** — UI

- `state.ts` — `WizardState` + `apply()/undo()/isComplete()/serialize()`. Campo-chave `escolhasPorItem: Record<string,unknown>` (todas as sub-escolhas; ex. `raca_modificadores`, `origem_poder`). `racaNome`/`classeNome` (nomes dos itens Foundry, p/ resolver slug de raça/classe → dados T20-DB fora do compêndio). `escolhasPorItem.pericias = {obrigatorias[][], escolhas[], extras_int[], raca[]}`. `detalhes` → `system.detalhes.*`.
- `app.ts` — `WizardApp extends ApplicationV2` (HandlebarsApplicationMixin, PARTS). **Definida no hook `init`, não no top-level** (globals Foundry não existem antes). `_onRender` liga listeners.
- `steps/` — um `prepare<Passo>Context()` por passo: `nivel, atributos, raca, origem, classe, pericias, divindade, poderes, magias, equipamento, revisao`.

**`src/actor/`** — escrita

- `writer.ts` — `ActorWriter.create(state)`: resolve ids via `pack.getDocument(id).toObject()`, monta data, `Actor.create()`, abre ficha. Se item sumiu (módulo removido) → notifica + cria sem ele.
- `mapper.ts` — `WizardState` → schema `tormenta20`: `atributos.*.base` (só base!), `detalhes.*`, `dinheiro.*`, `items[]` (race/classe/poderes/magias/equip) com `escolhasPorItem` aplicado como flags/Active Effects.

**`src/ui/launcher.ts`** — botão "Criar Personagem" no sidebar Actors.

---

## Contrato de fluxo (5 camadas)

```
CompendiumIndex  → varre packs Item (system + módulos), cacheia índice mínimo
      ↓
RuleEngine       → regras estruturais (dados T20-DB + campos do item de classe)
      ↓
WizardState      → choices do usuário em memória (inclui escolhasPorItem)
      ↓
WizardApp        → ApplicationV2 11 passos; getOptions→filtra→renderiza; apply→valida→avança
      ↓
ActorWriter      → resolve docs, mapper monta data, Actor.create("character")
```

**Passos (ordem):** 1 Nível&Nome · 2 Atributos · 3 Raça · 4 Origem · 5 Classe · 6 Perícias · 7 Divindade · 8 Poderes · 9 Magias · 10 Equipamento · 11 Revisão.

- Nível é passo 1 (perícias/poderes/magias dependem dele).
- **Condicionais:** Divindade (pulável se classe não exige); Magias (pulada se classe não conjuradora).

---

## Paridade T20-DB ↔ módulo (o que reusa, o que falta)

| Recurso T20-DB                                           | Estado no módulo                        | Origem dos dados                                   |
| -------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Point buy + 7 métodos atributo                           | ✅ `rules/atributos.ts`                 | `data/atributos.json`                              |
| Pré-requisitos de poder                                  | ⚠️ parcial (6 de ~15 tipos) + `formatPrereq`/`describeUnmet` legíveis | `data/prereqs.json`                                |
| Passo Poderes legível (descrição + motivo + filtro)      | ✅ Plan 6A (`steps/poderes.ts` + `wizard.hbs` + `app.ts`) | item poder (`system.descricao`) + `prereqs.json` |
| Descrição de classe no painel                            | ✅ Plan 6A                              | `data/classes.json` (`descricao`)                  |
| Perícias por classe (fixas/obrigatorias/escolhas/Int/raça)| ✅ modelo canônico (`pericias.ts`), escrita slug→code | `data/classes.json` (NÃO o item Foundry)           |
| Origem + pick-2 benefícios                               | ⚠️ UI/detalhe ok; materialização (itens/poder no actor) pendente | `data/origens.json`                                |
| Divindade (devotos, druida, panteão)                     | ✅ `rules/divindade.ts`                 | `data/divindades.json`                             |
| Magias (círculo/tipo/escola/limites)                     | ✅ filtro; limites a afinar             | packs `magias` + regra                             |
| **Modificadores escolhíveis de raça** (humano +1 livre)  | ✅ `subescolhas.ts` (UI selects + base) | `data/racas.json` (`atributos_escolha`)            |
| **Variações de raça** (Suraggel, Hynne...)               | ❌ não portado                          | T20-DB `racas/*.variacoes`                         |
| **Construtor raça** (Golem, Duende)                      | ❌ não portado                          | T20-DB `racas/*.construtor`                        |
| **Multipath classe** (Arcanista→Bruxo/Mago/Feiticeiro)   | ❌ stub                                 | `escolhasPorItem`                                  |
| **Linhagem feiticeiro / especialista escola / familiar** | ❌ stub                                 | `subescolhas.ts`                                   |
| **Auto-grant poderes/habilidades por nível**             | ❌ dados existem, não wired             | `data/poderes-por-nivel.json`                      |
| Dinheiro inicial por nível                               | ✅ regra                                | `data/dinheiro.json`                               |

Tudo o que está ❌/⚠️ está faseado no ROADMAP. **A lógica canônica vive no `motor/construtor.py` do T20-DB** — portar, não reinventar.

---

## Princípio de reuso (NÃO reinventar) — onde está a lógica canônica

O T20-DB já resolveu TODAS estas regras em Python. **Está no disco como projeto irmão:**

```
T20-DB raiz = ../Ideias e RPG/T20-DB/   (relativo a este projeto; mesma pasta Projects)
            = override via env T20DB_ROOT
```

`scripts/port-t20db.mjs` usa esse path (relativo, com fallback `T20DB_ROOT`) para portar os **dados** (`data/*.json`).
A **lógica** NÃO é importada — é portada à mão para TS, espelhando o handler Python. Mapa exato de fontes:

| Regra a implementar aqui            | Fonte canônica no T20-DB                                                       | Porta para                       |
| ----------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| Pré-requisitos (~15 tipos)          | `motor/prerequisitos.py` (321L)                                                | `src/rules/poderes.ts`           |
| Aplicar atributos / point buy       | `motor/construtor.py::_aplicar_atributos` (L746)                               | `src/rules/atributos.ts`         |
| **Raça: modificadores escolhíveis** | `motor/construtor.py::_aplicar_raca` (L860) + `_validar_modificadores` (L1394) | `src/rules/subescolhas.ts`       |
| **Raça: construtor (Golem/Duende)** | `_validar_construtor` (L1504) + `_aplicar_construtor` (L1631)                  | `src/rules/subescolhas.ts`       |
| **Raça: efeitos de habilidade**     | `_aplicar_efeitos_habilidade_raca` (L1768)                                     | `src/actor/mapper.ts` (flags/AE) |
| **Classe: multipath/linhagem**      | `_aplicar_classe` (L2899) + `_aplicar_efeitos_linhagem_basica` (L3040)         | `src/rules/subescolhas.ts`       |
| Origem: pick-2                      | `_aplicar_origem` (L3115)                                                      | `src/rules/origem.ts`            |
| Divindade: filtro devotos           | `_aplicar_divindade` (L3234)                                                   | `src/rules/divindade.ts`         |
| Perícias: contagem/Int              | `_aplicar_pericias` (L3323) + `motor/pericia_atributos.py`                     | `src/rules/pericias.ts`          |
| Magias: círculo/limites             | `_aplicar_magias` (L3657) + `motor/calculos.py`                                | `src/rules/magias.ts`            |
| **Auto-grant poderes por nível**    | `motor/level_up.py` (733L)                                                     | `src/rules/` + `mapper`          |
| Slug T20-DB id ↔ item Foundry       | `scripts/sync_*_foundry.py` (T20-DB)                                           | `src/compendium/slug.ts`         |

> ⚠️ Números de linha são referência; `construtor.py` evolui. Se a linha não bater, `grep -n "def _aplicar_<passo>"`.

**Workflow ao implementar uma regra/sub-escolha:**

1. Abrir o handler Python correspondente da tabela (`../Ideias e RPG/T20-DB/motor/...`). Ler a lógica.
2. Portar os DADOS via `npm run port` (ou `node scripts/port-t20db.mjs`) — **não copiar JSON à mão**.
3. Portar a LÓGICA para o `src/rules/` da tabela, espelhando o handler.
4. Casar id ↔ item Foundry por **slug** (`src/compendium/slug.ts`).
5. Testar em `vitest` com fixture dos dados portados.

Se a sessão não conseguir ler `../Ideias e RPG/T20-DB/` (sandbox), pedir ao usuário para abrir os dois projetos juntos ou exportar `T20DB_ROOT`.

---

## Auto-update obrigatório

Mudou alguma destas áreas? Atualizar este `CLAUDE.md` **no mesmo commit**:

| Mudança                                           | Seção                             |
| ------------------------------------------------- | --------------------------------- |
| Novo módulo em `src/rules/` ou `src/compendium/`  | Mapa de arquivos críticos         |
| Novo passo / mudança de ordem no wizard           | Contrato de fluxo                 |
| Novo campo em `WizardState`                       | Mapa → `src/wizard/state.ts`      |
| Novo tipo de pré-requisito em `rules/poderes.ts`  | Paridade T20-DB + Mapa            |
| Sub-escolha implementada em `subescolhas.ts`      | Paridade T20-DB (❌→✅) + ROADMAP |
| Novo dado portado em `src/data/`                  | Mapa → `src/data/` + Paridade     |
| Fato novo descoberto sobre o sistema `tormenta20` | "Fatos do sistema"                |
| Fase concluída                                    | ROADMAP (mover status)            |

**Por que:** sessão nova sem mapa fresco gasta 5-15 min explorando o repo. Manter vivo economiza tokens.

---

## Cuidados

- **Modificadores raciais FIXOS:** não aplicar — o item `race` + o sistema preenchem `.racial`. O wizard escreve só `.base`. Mas os **escolhíveis** (humano +1×3) não têm item que os carregue → mapper soma em `.base` (ROADMAP F2). Não confundir os dois.
- **Perícia NUNCA vem do item Foundry.** Quais treinar/quantas = `data/classes.json` via `rules/pericias.ts`. Escrever no actor = `system.pericias.{code}.treinado` (code 4 letras, via `toPericiaCode`).
- **`getIndex` sem `fields` só traz `_id/name/img`** — pedir os campos explicitamente ou a filtragem quebra silenciosa.
- **WizardApp não pode estender globals Foundry no top-level** — ApplicationV2 não existe antes do hook `init`.
- **Edições grandes de arquivo:** preferir `Write` (arquivo inteiro) a `Edit` parcial — evita truncar.
- **Não inventar mecânica T20.** Se não está no livro / no T20-DB, marcar `// TODO` e perguntar.
- **Pós-`git push`:** rodar `npx tsc --noEmit` + `npm test` local antes (build remoto não existe — deploy é manual no Foundry).
