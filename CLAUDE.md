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

**Classe (campos reais):** `system.inicial`, `system.niveis`, `system.pmPorNivel`, `system.pvPorNivel`, `system.pericias.{inatas,escolhas,numero,value}`.
- ⚠️ `pericias.inatas` pode ser **string com vírgula/espaço**, não array — parsear, não fazer spread char-a-char.
- ➡️ Reusar esses campos do item de classe em vez de re-tabelar (mas há fallback em `src/data/progressao_classes.json`).

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
- `prereqs.json` (108KB) — `pre_requisitos[]` por slug de poder · `origens.json` · `divindades.json` · `atributos.json` (point buy + métodos) · `dinheiro.json` (por nível) · `racas.json` (atributos fixos/escolha — **parcial: falta variações/construtor**) · `poderes-por-nivel.json` (auto-grant) · `progressao_classes.json` · `slug-map.json` (overrides id↔nome Foundry).

**`src/rules/`** — regras estruturais T20 (TS puro, testável)
- `engine.ts` — orquestrador: `getOptions(step, state)`, `validate(step, choice, state)`. `steps.ts` — `WizardStep` enum + ordem + metadata (condicional/obrigatório).
- `atributos.ts` — point buy + métodos rolagem · `pericias.ts` — treináveis = `classe.numero + max(0,Int) + raça`, `inatas` travadas · `poderes.ts` — `checkPrereqs`/`isEligible` (lê `prereqs.json`; **6 tipos hoje:** atributo/nivel/poder/classe/raca/pericias) · `magias.ts` — círculos/limites + filtro · `origem.ts` — pick-2 · `divindade.ts` — filtro devotos (raça OR classe), druida fixo, obrigatória clérigo/paladino/druida.
- `subescolhas.ts` — ⚠️ **STUB.** Deve resolver: especialista escola, familiar, modificadores escolhíveis de raça, linhagem feiticeiro, construtor Duende/Golem, multipath classe, pick-2 origem. Ver ROADMAP F2/F3.

**`src/wizard/`** — UI
- `state.ts` — `WizardState` + `apply()/undo()/isComplete()/serialize()`. Campo-chave `escolhasPorItem: Record<string,unknown>` (todas as sub-escolhas). `detalhes` → `system.detalhes.*`.
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

| Recurso T20-DB | Estado no módulo | Origem dos dados |
|---|---|---|
| Point buy + 7 métodos atributo | ✅ `rules/atributos.ts` | `data/atributos.json` |
| Pré-requisitos de poder | ⚠️ parcial (6 de ~15 tipos) | `data/prereqs.json` |
| Perícias por classe (inatas/escolhas/Int) | ✅ `rules/pericias.ts` | item `classe` + fallback `progressao_classes.json` |
| Origem + pick-2 benefícios | ⚠️ regra ok, UI/materialização pendente | `data/origens.json` |
| Divindade (devotos, druida, panteão) | ✅ `rules/divindade.ts` | `data/divindades.json` |
| Magias (círculo/tipo/escola/limites) | ✅ filtro; limites a afinar | packs `magias` + regra |
| **Modificadores escolhíveis de raça** (humano +1 livre) | ❌ stub | `data/racas.json` (`atributos_escolha`) |
| **Variações de raça** (Suraggel, Hynne...) | ❌ não portado | T20-DB `racas/*.variacoes` |
| **Construtor raça** (Golem, Duende) | ❌ não portado | T20-DB `racas/*.construtor` |
| **Multipath classe** (Arcanista→Bruxo/Mago/Feiticeiro) | ❌ stub | `escolhasPorItem` |
| **Linhagem feiticeiro / especialista escola / familiar** | ❌ stub | `subescolhas.ts` |
| **Auto-grant poderes/habilidades por nível** | ❌ dados existem, não wired | `data/poderes-por-nivel.json` |
| Dinheiro inicial por nível | ✅ regra | `data/dinheiro.json` |

Tudo o que está ❌/⚠️ está faseado no ROADMAP. **A lógica canônica vive no `motor/construtor.py` do T20-DB** — portar, não reinventar.

---

## Princípio de reuso (NÃO reinventar)

O T20-DB (`E:\rayna\Documents\Claude\Projects\Ideias e RPG\T20-DB`) já resolveu TODAS estas regras em Python
(`motor/construtor.py`, `motor/prerequisitos.py`, `motor/level_up.py`, `data/`). Ao implementar uma
sub-escolha/regra aqui:

1. **Achar a lógica equivalente no T20-DB primeiro** (mesma sub-escolha, mesmos campos).
2. Portar os DADOS via `scripts/port-t20db.mjs` (não copiar à mão — mantém sincronizado).
3. Portar a LÓGICA para TS em `src/rules/`, espelhando o handler Python.
4. Casar T20-DB id ↔ item Foundry por **slug** (mesma estratégia dos `scripts/sync_*_foundry.py` do T20-DB).
5. Testar a regra em `vitest` com fixture dos dados portados.

---

## Auto-update obrigatório

Mudou alguma destas áreas? Atualizar este `CLAUDE.md` **no mesmo commit**:

| Mudança | Seção |
|---|---|
| Novo módulo em `src/rules/` ou `src/compendium/` | Mapa de arquivos críticos |
| Novo passo / mudança de ordem no wizard | Contrato de fluxo |
| Novo campo em `WizardState` | Mapa → `src/wizard/state.ts` |
| Novo tipo de pré-requisito em `rules/poderes.ts` | Paridade T20-DB + Mapa |
| Sub-escolha implementada em `subescolhas.ts` | Paridade T20-DB (❌→✅) + ROADMAP |
| Novo dado portado em `src/data/` | Mapa → `src/data/` + Paridade |
| Fato novo descoberto sobre o sistema `tormenta20` | "Fatos do sistema" |
| Fase concluída | ROADMAP (mover status) |

**Por que:** sessão nova sem mapa fresco gasta 5-15 min explorando o repo. Manter vivo economiza tokens.

---

## Cuidados

- **Não pré-aplicar modificadores raciais nos atributos.** Escrever só `.base`; o item `race` + o sistema fazem o resto. Aplicar duas vezes é o bug clássico.
- **`pericias.inatas` pode ser string** — sempre normalizar (split por `,`/espaço) antes de iterar.
- **`getIndex` sem `fields` só traz `_id/name/img`** — pedir os campos explicitamente ou a filtragem quebra silenciosa.
- **WizardApp não pode estender globals Foundry no top-level** — ApplicationV2 não existe antes do hook `init`.
- **Edições grandes de arquivo:** preferir `Write` (arquivo inteiro) a `Edit` parcial — evita truncar.
- **Não inventar mecânica T20.** Se não está no livro / no T20-DB, marcar `// TODO` e perguntar.
- **Pós-`git push`:** rodar `npx tsc --noEmit` + `npm test` local antes (build remoto não existe — deploy é manual no Foundry).
