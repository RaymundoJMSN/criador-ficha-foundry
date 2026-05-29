# t20-ficha-wizard — Design Spec

**Data:** 2026-05-29
**Autor:** Yuri (RaymundoJMSN)
**Status:** Aprovado (revisado contra o sistema real `tormenta20` v1.5.015)

---

## Visão Geral

Módulo Foundry VTT standalone que guia um GM ou jogador por um wizard de 11 passos para criar um personagem Tormenta 20 válido, resultando em um Foundry actor `character` jogável. Conteúdo (raças, classes, poderes, magias, equipamentos) é lido dinamicamente dos compêndios do sistema `tormenta20` e de módulos adicionais. Regras estruturais do T20 (point buy, progressão de classe, pré-requisitos, origens, divindades) são fornecidas por **dados estruturados portados do projeto T20-DB**, embutidos no módulo — porque o sistema NÃO expõe essas regras de forma máquina-legível.

**Não gera PDF. Não calcula stats derivados.** O sistema `tormenta20` faz PV/PM/Defesa/perícias/CD ao receber o actor.

---

## ⚠️ Fatos do sistema real (inspeção de `tormenta20` v1.5.015)

Verificado direto em `system.json` + `templates/` + `tormenta20.mjs`. **Estes fatos invalidam várias premissas da versão anterior do spec:**

### Tipos de Item (reais)

`arma`, `equipamento`, `classe`, `comodo`, `consumivel`, `magia`, `mobilia`, `poder`, `race`, `tesouro`.

- O id da raça é **`race`** (inglês), não `raca`/`raça`.
- **NÃO existe tipo `origem`. NÃO existe tipo `divindade`.**

### Packs do sistema (reais)

`racas`, `classes`, `poderes`, `poderes-distincao`, `equipamentos`, `equipamentos-magicos`, `magias`, `habilidades-de-criaturas`, `pocoes`, `parceiros` (Items) + `ameacas`, `convocacoes` (Actors) + `basico` (Journal) + `tabelas-de-tesouro` (RollTable) + `macros`.

- **NÃO existe pack de origens. NÃO existe pack de divindades.**
- `poderes` e `poderes-distincao` são packs separados — indexar ambos.

### Actor

- Tipo de personagem jogável = **`character`** (não "personagem").
- Token attrs: `attributes.pv` (primário), `attributes.pm` (secundário).

### Atributos (chave para evitar dupla aplicação)

`system.atributos.{for,des,con,int,sab,car}` é um `SchemaField` com sub-campos **`base`, `racial`, `bonus`, `temp`, `value`**.

- `value` é **derivado** pelo sistema.
- O item `race`, ao ser adicionado, preenche `.racial` e seta `system.detalhes.raca` (o sistema faz `detalhes.raca = nome.capitalize()`).
- **➡️ O wizard escreve SOMENTE `system.atributos.{attr}.base`.** Nunca escreve `.value` nem `.racial`. Isso elimina a dupla aplicação de modificadores raciais.

### Origem e Divindade são TEXTO, não itens

- `system.detalhes.origem` → string.
- `system.detalhes.divindade` → string.
- Logo, os passos de Origem e Divindade **não leem compêndio**: o wizard usa seus próprios dados (T20-DB), grava a string em `detalhes.*`, e materializa os benefícios (poderes/itens da origem) buscando os **poderes/equipamentos por nome** nos packs do sistema.

### Dinheiro

`system.dinheiro` é objeto multi-denominação **`{ tc, tl, to, tp }`** (não um número único). Denominações confirmadas (lang `Currency*Abbr`):

- `tc` = Cobre (TC)
- `tl` = Prata → **abbr "T$" = Tibar, a moeda principal do livro**
- `to` = Ouro (TO)
- `tp` = Platina (TP)

➡️ Dinheiro inicial (tabela por nível, em T$) é gravado em **`system.dinheiro.tl`**.

### Classe (campos reais)

`system.inicial`, `system.niveis`, `system.pmPorNivel`, `system.pvPorNivel`, `system.pericias.{ inatas, escolhas, numero, value }`.

- `pericias.inatas` = perícias automáticas; `pericias.escolhas` = lista para escolher; `pericias.numero` = quantas escolher.
- **➡️ Reusar esses campos do próprio item de classe** em vez de re-tabelar perícias/PV/PM no módulo.

### Magia (campos reais + enums confirmados)

`system.circulo`, `system.escola`, `system.tipo`, `system.rolltags`.

- `system.tipo`: **`"arc"`** (Arcana) | **`"div"`** (Divina). _(lang `SpellArc`/`SpellDiv`.)_
- `system.circulo`: **Number 1–5**. _(lang `SpellLevel1..5`.)_
- `system.escola`: código curto de 3 letras — **`abj` (Abjuração), `adv` (Adivinhação), `con` (Convocação), `enc` (Encantamento), `evo` (Evocação), `ilu` (Ilusão), `nec` (Necromancia), `tra` (Transmutação)**. _(lang `School*`.)_
- Filtro de magias arcanas vs divinas usa `system.tipo`; círculos liberados por classe/nível comparam contra `system.circulo`.

### Poder (campos reais)

`system.tipo`, `system.subtipo`, `system.alcance`, `system.area`, `system.ativacao.{custo,execucao,qtd,special}`, `system.duracao.*`, `system.efeito`.

- **NÃO existe `system.requisitos` nem qualquer campo de pré-requisito estruturado.** Pré-requisito só existe como texto em `description.value` (HTML), quando existe.
- **➡️ Validação de pré-requisito DEVE vir de dados próprios (T20-DB), casados por slug.**

---

## Stack

- **Linguagem:** TypeScript strict
- **Bundler:** Vite, lib mode, ESM → `dist/module.js` (+ cópia de `templates/`, `lang/`, `assets/`)
- **Tipos:** `fvtt-types` — **pinar um commit específico** (community/main churna e os tipos de ApplicationV2 ainda são incompletos).
- **Foundry:** v13 (ApplicationV2 / HandlebarsApplicationMixin). O sistema é `minimum/verified/maximum = 13`.
- **Sistema alvo:** `tormenta20` (>= 1.5.015)
- **Licença:** MIT
- **Formato:** pt-BR (`lang/pt-BR.json`)
- **Testes:** `vitest` headless no RuleEngine (TS puro). Ver seção Testes.

---

## Arquitetura — 5 Camadas

```
CompendiumIndex   ← varre TODOS os packs Item dos tipos relevantes (system + módulos), cacheia
      ↓
RuleEngine        ← regras estruturais T20 vindas de DADOS PRÓPRIOS (T20-DB) + campos do item de classe
      ↓
WizardState       ← objeto em memória com choices do usuário, inclui escolhasPorItem
      ↓
WizardApp         ← ApplicationV2 multi-step (Handlebars), renderiza opções filtradas
      ↓
ActorWriter       ← WizardState → Actor.create() com schema tormenta20 (atributos.base + items[] + detalhes.*)
```

**Fluxo:**

1. Hook `ready` → `CompendiumIndex.build()`
2. Botão "Criar Personagem" no sidebar Actors → abre `WizardApp`
3. Cada passo: `RuleEngine.getOptions(step, state)` → filtra → renderiza
4. Usuário escolhe → `WizardState.apply(step, choice)` → valida → avança
5. Revisão → `ActorWriter.create(state)` → `Actor.create(data)` → fecha wizard, abre ficha

---

## Dados próprios embutidos (porte do T20-DB) — peça central

O sistema `tormenta20` é um runtime de ficha; **não** carrega regras de criação. Para o que o sistema não fornece, o módulo embute JSON estruturado **portado do projeto T20-DB** (`data/`), evitando reescrever e evitando drift entre os dois projetos:

| Dado                                                                                                                | Fonte T20-DB                              | Usado para                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| Pré-requisitos de poderes                                                                                           | `data/poderes/**` (`pre_requisitos[]`)    | Validar elegibilidade (passo Poderes) — casar por slug com o item do pack |
| Origens (perícias, poderes, itens, pick-2)                                                                          | `data/origens/*.json`                     | Passo Origem inteiro (não há pack)                                        |
| Divindades (devotos aceitos, panteão, regras druida)                                                                | `data/divindades/*.json`                  | Passo Divindade inteiro (não há pack)                                     |
| Point buy + métodos de rolagem                                                                                      | `data/atributos/atributos.json`           | Passo Atributos                                                           |
| Dinheiro inicial por nível                                                                                          | `data/regras/equipamento_inicial.json`    | Passo Equipamento                                                         |
| Sub-escolhas (especialista escola, familiar, modificadores escolhíveis, linhagem, construtor Duende, pick-2 origem) | lógica do `motor/construtor.py` do T20-DB | `escolhasPorItem` (ver WizardState)                                       |

> Perícias por classe, PV/PM por nível e progressão **não** precisam de dados próprios: vêm do próprio item `classe` (`system.pericias.*`, `pvPorNivel`, `pmPorNivel`, `niveis`).

O slug de casamento (T20-DB id ↔ nome do item Foundry) reusa a mesma estratégia de slug do T20-DB (`scripts/sync_*_foundry.py`).

---

## Passos do Wizard (em ordem)

> **Nível foi movido para o passo 1.** Perícias, poderes e magias dependem do nível; tê-lo por último era circular.

| #   | Passo            | Descrição                                                                                                                                                                                                           |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Nível & Nome** | Define nível (1–20, default 1) e nome. Tudo a jusante usa o nível.                                                                                                                                                  |
| 2   | **Atributos**    | Método (point buy / rolagem / khalmyr / valkaria / nimb / épica / clássica). Point buy usa tabela do T20-DB. Escreve em `atributos.*.base`.                                                                         |
| 3   | **Raça**         | Item `race` do pack `racas`. Sub-escolhas raciais (modificadores escolhíveis, variações, construtor) via `escolhasPorItem`. A aplicação de atributos é do sistema (não pré-aplicar).                                |
| 4   | **Origem**       | **Dados próprios** (sem pack). Grava `detalhes.origem`. Pick-2 de benefícios; materializa poderes/itens por nome.                                                                                                   |
| 5   | **Classe**       | Item `classe` do pack `classes`. Multipath (Arcanista → Bruxo/Mago/Feiticeiro) via `escolhasPorItem`. Lê `pericias.*`, `pv/pmPorNivel` do item.                                                                     |
| 6   | **Perícias**     | Treináveis = `classe.system.pericias.numero` + bônus Int + raça; `pericias.inatas` pré-marcadas; escolher entre `pericias.escolhas`.                                                                                |
| 7   | **Divindade**    | **Dados próprios** (sem pack). Filtra por devotos aceitos (raça OR classe). Druida: lista fixa. Panteão: só com poder `devoto_fiel`. Obrigatória p/ clérigo/paladino/druida. Grava `detalhes.divindade`.            |
| 8   | **Poderes**      | Qtd por nível (dados próprios). Elegibilidade via **pré-requisitos do T20-DB** casados por slug (não há campo no item). Inelegível = marcado, não bloqueado. Inclui packs `poderes` + `poderes-distincao`.          |
| 9   | **Magias**       | Só se classe conjuradora. Filtra `magia.system.circulo`/`tipo`/`escola` por classe/nível. Conta conhecidas vs limite.                                                                                               |
| 10  | **Equipamento**  | Loja por categoria, busca, carrinho, saldo. Dinheiro inicial por nível (T20-DB). **MVP:** nível 1 = pacote inicial de classe/origem direto; loja completa para nível 2+. Itens de origem pré-adicionados sem custo. |
| 11  | **Revisão**      | Resumo. "Criar Personagem" → `ActorWriter.create(state)`.                                                                                                                                                           |

**Passos condicionais:** Divindade (pulável se classe não exige e usuário não quis); Magias (pulada se classe não conjuradora).

---

## Estrutura de Arquivos

```
module.json              id="t20-ficha-wizard", relationships.requires=tormenta20, compatibility v13
package.json             vite + typescript + fvtt-types(pinned) + vitest
vite.config.ts           → dist/module.js + copy templates/lang/assets
tsconfig.json            strict, ES2022, fvtt-types
vitest.config.ts

src/
  module.ts              init→registerSettings, ready→CompendiumIndex.build()+registerUI
  constants.ts           MODULE_ID, SYSTEM_ID="tormenta20", CHARACTER_TYPE="character",
                         ITEM_TYPES, EXTRA_MODULE_IDS[] (aditivo, não exclusivo)

  data/                  ← JSON portado do T20-DB (embutido no bundle)
    prereqs.json         pre_requisitos por slug de poder
    origens.json
    divindades.json
    atributos.json       point buy + métodos rolagem
    dinheiro.json        por nível
    slug-map.json        T20-DB id ↔ nome Foundry (overrides)

  compendium/
    index.ts             CompendiumIndex singleton — build(), getAll(), getById(), rebuild()
    types.ts             IndexedRace, IndexedClasse, IndexedPoder, IndexedMagia, IndexedItem
    slug.ts              normalização de slug (espelha scripts T20-DB)

  rules/
    engine.ts            getOptions(step, state), validate(step, choice, state)
    steps.ts             WizardStep enum + ordem + metadata (condicional/obrigatório)
    atributos.ts         point buy + rolagem (Foundry Roll API)
    classe.ts            lê item.system (pericias/pv/pm/niveis) + multipath
    pericias.ts          conta treináveis (classe.numero + Int + raça)
    magias.ts            círculos/limites por classe/nível
    poderes.ts           prereq checker (usa data/prereqs.json) + qtd por nível
    origem.ts            regras de origem (data/origens.json)
    divindade.ts         filtro devotos (data/divindades.json)
    subescolhas.ts       resolve escolhasPorItem (especialista, familiar, modificadores, linhagem, construtor)

  wizard/
    state.ts             WizardState + apply(), undo(), isComplete(), serialize() p/ resume
    app.ts               WizardApp extends ApplicationV2 (HandlebarsApplicationMixin, PARTS)
    steps/               nivel.ts, atributos.ts, raca.ts, origem.ts, classe.ts, pericias.ts,
                         divindade.ts, poderes.ts, magias.ts, equipamento.ts, revisao.ts

  actor/
    writer.ts            ActorWriter.create(state) → Actor.create(data)
    mapper.ts            WizardState → schema tormenta20 (atributos.*.base, detalhes.*, items[], dinheiro.*)

  ui/launcher.ts         botão no sidebar Actors

  lang/pt-BR.json
templates/               Handlebars por passo (PARTS de ApplicationV2)
assets/
test/                    vitest — rules/*.test.ts
```

---

## CompendiumIndex

Roda em `ready`. Varre **todo** `game.packs` cujo `documentName === "Item"` e cujos documentos sejam de tipo relevante (`race`, `classe`, `poder`, `magia`, `equipamento`, `arma`, `consumivel`, `tesouro`). Não depende de allowlist de fontes — `EXTRA_MODULE_IDS[]` existe só para priorização, nunca como filtro exclusivo. Assim conteúdo premium/terceiro aparece automaticamente.

**Indexação mínima com `fields` explícito** — `getIndex` do Foundry só traz `_id/name/img` por padrão. Para filtrar/validar é obrigatório pedir os campos:

```ts
await pack.getIndex({
  fields: [
    "system.tipo",
    "system.subtipo", // poder
    "system.circulo",
    "system.escola", // magia
    "system.atributos", // race
    "system.pericias",
    "system.pvPorNivel", // classe
    "system.preco",
    "system.peso", // equipamento
  ],
});
```

Documento completo (`pack.getDocument(id)`) só no `ActorWriter`.

**API:**

```ts
CompendiumIndex.getAll(type): IndexedX[]
CompendiumIndex.getById(type, id): IndexedX | undefined
CompendiumIndex.rebuild(): Promise<void>
```

---

## WizardState

```ts
interface WizardState {
  nivel: number; // PASSO 1 — definido cedo
  nome: string;
  metodoAtributos:
    | "compra-pontos"
    | "rolagem"
    | "khalmyr"
    | "valkaria"
    | "nimb"
    | "epica"
    | "classica";
  atributosBase: Record<"for" | "des" | "con" | "int" | "sab" | "car", number>; // → atributos.*.base
  racaId: string; // id do item `race`
  origemId: string; // chave em data/origens.json (NÃO é item)
  classeId: string; // id do item `classe`
  subclasseId?: string; // multipath
  divindadeId?: string; // chave em data/divindades.json (NÃO é item)
  periciasTreinadas: string[];
  poderes: string[]; // ids de itens — escolhidos
  poderesAutoGrant: string[]; // separado p/ UX (não contam na cota)
  magias: string[];
  equipamento: { itemId: string; qty: number }[];
  dinheiroRestante: number; // saldo após loja (mapeado p/ dinheiro.{tc,tl,to,tp} no writer)
  escolhasPorItem: Record<string, unknown>; // sub-escolhas dentro de raça/classe/poder/origem
  detalhes: Record<string, string>; // aparência, história → detalhes.*
}
```

**`escolhasPorItem`** cobre tudo que o T20-DB tratava como sub-escolha: especialista em escola, familiar, modificadores de atributo escolhíveis (humano +1 livre), linhagem do feiticeiro, construtor do Duende, pick-2 da origem. Resolvido por `rules/subescolhas.ts` e materializado pelo `mapper` como flags/Active Effects nos itens embutidos.

**Resume:** `serialize()`/`deserialize()` permitem persistir o state num flag de usuário (`game.user.setFlag`) para sobreviver a refresh. (Opcional no MVP, mas o hook fica pronto.)

---

## Rule Engine

Só codifica **estrutura**, nunca stats derivados.

- **Atributos:** point buy do T20-DB; rolagem via `new Roll("4d6kh3").evaluate()`.
- **Classe:** lê o próprio item — `system.pericias.{inatas,escolhas,numero}`, `pvPorNivel`, `pmPorNivel`, `niveis`. Multipath via sub-escolha.
- **Perícias:** treináveis = `classe.numero + max(0, Int) + bônus raça`; `inatas` pré-marcadas e travadas.
- **Poderes:** qtd por nível (dados próprios); elegibilidade lê `data/prereqs.json` por slug e compara com o state. Fallback se slug ausente: `eligible:true` (exibe sem aviso) — mas como os prereqs vêm do T20-DB, a cobertura é alta (não depende do sistema).
- **Magias:** círculos desbloqueados e limites por classe/nível; filtra por `magia.system.circulo`/`tipo`/`escola`.
- **Origem:** de `data/origens.json` — pick-2 de benefícios, poderes/itens materializados por nome no pack.
- **Divindade:** de `data/divindades.json` — druida lista fixa; panteão só com `devoto_fiel`; demais por `devotos_aceitos` (match raça OR classe).
- **Equipamento:** loja por categoria; carrinho com subtração de saldo; item desabilitado se `preço > saldo`; itens de origem grátis.

---

## ActorWriter

Executa só na confirmação (Revisão).

**Processo:**

1. Resolve IDs de compêndio via `pack.getDocument(id)` (raça, classe, poderes, magias, equip) → `.toObject()`.
2. Materializa origem/divindade: grava strings em `system.detalhes.origem` / `system.detalhes.divindade`; adiciona poderes/itens da origem buscados por nome.
3. Monta `ActorCreateData` (`type: "character"`):
   - `system.atributos.{attr}.base` ← `state.atributosBase` (**só base**; o item `race` cuida de `.racial`; o sistema deriva `.value`).
   - `system.attributes.nivel.value` ← nível.
   - `system.detalhes.{raca,origem,divindade,...}`.
   - `system.dinheiro.{tc,tl,to,tp}` ← conversão de `dinheiroRestante`.
   - `items[]` ← race, classe, poderes, magias, equipamentos (`.toObject()`), com `escolhasPorItem` aplicado como flags/AE.
4. `Actor.create(data)` → o sistema deriva PV/PM/Defesa/perícias/CD.
5. Fecha WizardApp, abre a ficha.

**Erro:** se `getDocument` falhar (módulo removido mid-wizard) → notifica quais itens faltaram, cria actor sem eles.

---

## Testes

`vitest` headless cobre o `RuleEngine` (TS puro, sem Foundry):

- Point buy: custo total, limites por atributo.
- Perícias: contagem (classe.numero + Int + raça), inatas travadas.
- Poderes: prereq atendido/não atendido por slug (fixtures de `data/prereqs.json`).
- Magias: círculos por classe/nível, limite de conhecidas.
- Origem/Divindade: filtros (pick-2, devotos aceitos, druida, panteão).

Camada Foundry (CompendiumIndex/ActorWriter) é validada manualmente em mundo de teste — mockar Foundry não compensa.

---

## Fora de Escopo (MVP)

- Exportação para PDF.
- Level-up de actor existente (wizard só cria novos).
- NPCs / `npc`, `hazard`, etc.
- Sistemas não-`tormenta20`.
- Multi-personagem em lote.
- UI de configuração de fontes de compêndio (índice é automático sobre todos os packs Item).
- Compatibilidade com Foundry < v13.

---

## Changelog do spec

- **2026-05-29 (rev. 2b):** Enums cravados via lang/templates: `dinheiro.tl` = T$ (Tibar, principal; tc=Cobre, to=Ouro, tp=Platina); `magia.tipo` = `arc`/`div`; `magia.circulo` = Number 1–5; `magia.escola` = `abj/adv/con/enc/evo/ilu/nec/tra`.
- **2026-05-29 (rev. 2):** Revisado contra `tormenta20` v1.5.015 (system.json + templates + mjs). Correções: tipo `race` (não `raca`); origem/divindade são `detalhes.*` em texto, sem pack/item; actor `character`; `atributos.*.base` (sem dupla aplicação); `dinheiro` objeto `{tc,tl,to,tp}`; classe expõe perícias/PV/PM; poder sem campo de requisito (prereq vem do T20-DB). Integradas as 8 sugestões: tipos verificados, prereq/origem/divindade/tabelas portados do T20-DB, atributos.base, nível movido p/ passo 1, `escolhasPorItem` p/ sub-escolhas, índice sobre todos os packs (allowlist aditiva), `getIndex({fields})` explícito, testes vitest, fvtt-types pinado, loja MVP enxuta, resume via flag.
