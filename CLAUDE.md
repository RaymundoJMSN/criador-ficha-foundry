# t20-ficha-wizard — Contexto para o Claude

> Módulo **Foundry VTT v13** que adiciona um wizard de criação de personagem
> Tormenta 20 ao sistema `tormenta20`. Lê conteúdo (raças, classes, poderes,
> magias, equipamentos) dos **compêndios do sistema**; embute as **regras de
> criação portadas do projeto T20-DB** (que o sistema não expõe). Resultado: um
> actor `character` válido — o sistema deriva PV/PM/Defesa/perícias/CD.

---

## 🎯 FOCO ATUAL

Wizard cria personagem correto de **nível 1 a 20**. Passos refeitos um a um
contra o PDF em 2026-09-06 (Atributos, Equipamento, Magias, Poderes, Revisão) e
conferidos criando fichas de verdade no mundo `Testes criador de ficha` (login
Mestre2). 317 testes. Ver "Refeito passo a passo" abaixo e o
[`ROADMAP.md`](docs/superpowers/ROADMAP.md) para o que ainda falta.

### Refeito passo a passo (2026-09-06)

Regra: **nada de memória** — cada passo lido no PDF (`scripts/.cache-pdf/`),
implementado, testado e criado no Foundry. Achados que mudaram comportamento:

- **Atributos.** Rolagem gera um *pool* de seis valores convertidos que o jogador
  distribui (LB p.17 "distribua como quiser"); Valkaria é 7d6 aplicados inteiros
  sobre base 8, Nimb 7d20 descartando o menor (HA p.281); Khalmyr é pool fixo.
  Validação existe para todo método (antes só compra de pontos).
- **Equipamento.** Kit do 1º nível (LB p.146: mochila, saco, traje, arma simples
  + marcial se proficiente, armadura leve/brunea, escudo leve; arcanista sem
  armadura) e itens de origem de verdade (escolha "X ou Y", quantidade, T$ em dado).
  **T$ é `system.dinheiro.tp`** — `tl` é platina, oculta. Quantidade no carrinho.
- **Duas armadilhas do sistema na criação:** (1) item de arma dentro do
  `Actor.create` quebra `prepareData` (`getAttackToHit` lê atributo que não
  existe) — equipamento entra por `createEmbeddedDocuments` depois de raça e
  classe; (2) raça com atributo à escolha abre o diálogo "Atributos Dinâmicos"
  (`_onCreateOwnedRace`) e **fica esperando o jogador** — a escolha vai somada em
  `system.atributos` do item de raça (vira `.racial`) com `atributosDinamicos.value=[]`.
  A base do actor é só a base.
- **Magias.** Tradição/escolas vêm do T20-DB pelo port; universais entram para
  todos; bardo/druida escolhem 3 escolas (LB p.44/61); mago +1 por círculo novo;
  teto por círculo (LB: iniciais são de 1º, cada nível aprende uma de qualquer
  círculo aberto); cota soma poderes que ensinam magia (`magias_por_poder.json`);
  paladino só vê o passo com Orar. Excesso vira pendência.
- **Poderes.** Poder de classe = `tipo:"classe"` + `subtipo:"<Classe>"` no
  compêndio (serve para qualquer classe instalada). Repetíveis
  (`poderes_repetiveis.json`) têm contador ×N.
- **Classes fora do T20-DB.** `scripts/port-pdf-classes.mjs` lê a tabela
  "O <Classe> / Nível / Habilidades de Classe" dos PDFs → `progressao_livros.json`
  (Frade, Treinador, 14 de Heróis de Arton). `--conferir` compara as 14 do LB com
  o T20-DB — achou que `furia_+2`/`inspiracao_+N` não eram escalonamento (bardo
  nv17 ganhava Inspiração 5×) e Baluarte em dobro. Samurai/Místico/Miragem não
  têm tabela em livro nenhum dos PDFs → aviso no passo.
- Caminho da classe só no nível certo (cavaleiro: 5º, `caminho_nivel`).

### Regras da mesa (2026-09-07)

O equivalente ao item de configuração do Call of Cthulhu: **setting de mundo**
`t20-ficha-wizard.configuracao` (`src/config/config.ts`), editado pelo mestre em
Configurações → Criador de Ficha → "Regras da mesa" ou pelo botão abaixo de
"Criar Personagem" (só aparece para GM). Todo cliente lê; o wizard copia para
`state.config` ao abrir (`aplicarConfig`) e mostra o resumo no topo.

| campo | efeito no wizard | fonte |
|---|---|---|
| `metodoAtributos` | trava o método (sem select) | LB p.17 / HA p.280 |
| `pontosCompra` | Pontos Variados (5/10/15…) | HA p.281 |
| `dinheiro` fixo | substitui 4d6/Tabela 3-1 (T$ da origem ainda soma) | — |
| `racasPermitidas` / `classesPermitidas` | filtra as listas (vazio = todas) | — |
| `complicacoes` | passo Idade & Complicações: 1 complicação do compêndio (`tipo:complicacao`, gerais + da classe) ↔ +1 poder geral | HA p.282 |
| `complicacaoIdade` | "Já Vi Coisas" para qualquer faixa: +1 complicação de idade ↔ +1 poder geral (no livro só o Adulto) | HA p.289 |
| `idadesVariadas` | faixa etária (Tabela 4-2): atributos, níveis extras, complicações obrigatórias, Sem Origem / Origem em Construção, Protegido dos Deuses, Ímpeto Juvenil, bloqueio de Aumento de Atributo físico | HA p.288 |
| `racasAbertas` | modificadores fixos da raça distribuídos em atributos distintos | HA p.281 |
| `devocoesAbertas` | qualquer deus, sem requisito de raça/classe | HA p.281 |

Regras em `src/rules/idade.ts` (faixas e as 19 complicações de idade com os
efeitos numéricos) e `rules/subescolhas.ts` (`distribuirAbertos`). **Nível**:
o campo do passo 1 é o nível do GRUPO (`escolhasPorItem.nivel_grupo`);
`state.nivel` = grupo + extras da faixa (`nivelEfetivo`). Poderes extras só
podem ser gerais: o passo trava os de classe quando as vagas de classe acabam.
**PV/PM do sistema ignoram `.bonus` de atributo** ("Pontos ignoram bônus"), por
isso o modificador da faixa etária vai somado no `system.atributos` do item de
raça (coluna racial), junto com Raças Abertas; o resto (Defesa, resistências,
PM, perícias, PV/PM por nível) vai como Active Effect nos itens criados
(`Faixa etária: X`, complicações de idade como `poder` tipo `complicacao`).
Validado no Foundry: anão guerreiro ancião com Raças Abertas, Caolho, Já Vi
Coisas e 5 complicações de idade → nível 4, PV 25, PM 8, atributos certos.

Fechados depois: **habilidade de classe com opção** ("Bênção da Justiça: Égide
/ Montaria", "Dádiva da Fé", "Escola de Duelo", "Lorde" — `opcoesDaHabilidade`
no resolver; o passo Poderes mostra um select e a Revisão trava sem escolha);
**poder que dá uma magia específica** (`magia_por_poder.json` do port: Dedo
Verde → Controlar Plantas, Manto de Batalha → Vestimenta da Fé…, a magia entra
fora da cota); **`openRaces` do sistema** ligado — o writer desliga durante o
embed da raça se for mestre, senão avisa; **criança** não precisa de origem.

### Multiclasse (2026-09-07, noite)

LB p.35: "Zaled é um arcanista de 3º nível, um paladino de 1º nível e um
personagem de 4º nível." No passo Classe, "Multiclasse" adiciona linhas
[classe, níveis]; a classe do 1º nível é a **principal** (fica com o resto dos
níveis, dá perícias, proficiências e o PV inicial — `inicial:true` só nela).
`rules/multiclasse.ts`: `classesDoPersonagem`, `slotsDePoderTotal`,
`habilidadesDeTodas`, `niveisPorClasse` (pré-requisito "X níveis de classe"
compara o nível NA classe), `caminhoDe` (caminho por classe: `classe_caminho`
na principal, `classe_caminho_<slug>` nas outras). Magias: cota somada por
classe no nível dela, lista = união das conjuradoras, teto por círculo somado.
Divindade obrigatória/concedidos: qualquer das classes. Validado: guerreiro 3 /
arcanista 2 (bruxo) → nível 5, PV 39, PM 21, 3 poderes, 4 magias de 1º.

**Ainda não cobre:** proficiências/perícias das classes só do compêndio (Samurai
sai com "escolha 2 entre todas"); "Origem em Construção" com origem de um
benefício só (perícia a menos da classe); "Tipo: X" do Melhor Amigo do Treinador
(o prefixo não é o nome da habilidade).

### O que mudou em 2026-08-31 (spec `2026-08-31-nivel-1-20-design.md`)

Cinco defeitos de raiz, todos na junção regra × compêndio × actor:

1. **Nível não persistia.** O sistema deriva `nivel` de `soma(itens classe .system.niveis)`
   (`tormenta20.mjs:7711`); gravar `attributes.nivel.value` dava PV/PM de nv1 e o número
   voltava para 1 no primeiro update. Agora o writer grava `niveis` no item de classe.
2. **Pré-requisito de poder falhava sempre.** `{tipo:"poder"}` usa o campo `id`, o
   código lia `poder`. 237 ocorrências. Também comparava id de compêndio com slug.
3. **Atributo do pré-requisito ignorava bônus racial.**
4. **Cota de poderes era a do nível, não a acumulada** (nv5 dava 1, devia dar 4);
   e a lista não oferecia poderes gerais, que a regra permite no lugar do de classe.
5. **Todas as habilidades de classe vinham de uma vez** — guerreiro nv1 nascia com Campeão.

**Peça nova: `src/compendium/resolver.ts`.** T20-DB e compêndio nomeiam a mesma coisa
de formas diferentes (`ambidestria` × "Ambidestria (Guerreiro)", `furia_+2` × "Fúria",
`virtude_temperanca` × "Virtude Paladinesca: Temperança"). Uma escada de regras
+ `src/data/slug-map.json` curado à mão. Habilidades automáticas resolvidas:
**71/161 → 160/161**; poderes de classe com item: **507/513 (99%)** neste mundo,
que tem o módulo `suplementos-de-arton` (Heróis de Arton, deuses).
`test/compendium/cobertura-slugs.test.ts` mede a cada `npm test`.

Os 6 que sobram são erro de dado no T20-DB, não do casamento: `inspicar_confianca`
(é "inspirar"), `inimigo_de`, `canalizar_energia`, `catalisador_instavel`,
`combinacao_tecnica_sacrificio`, `palavras_ressonantes`.

Também: origem virou escolha de **dois** benefícios (as perícias de origem nunca
chegavam na ficha); caminho de classe virou árvore com a linhagem do feiticeiro
encadeada; cota de magias saiu de `(Int-10)/2` (matemática de D&D) para a regra da
classe; raças `misto` (Osteon, Lefou) saíam sem atributo racial nenhum; Revisão
lista pendências e trava o botão Criar; rascunho sobrevive a F5.

### Conferidor contra os livros (2026-08-31, noite)

**Qual fonte manda.** Três candidatas, e elas discordam:

| fonte | o que é | vale pra quê |
|---|---|---|
| `arauto/books/*.pdf` | os livros de verdade | **fonte da verdade** |
| compêndio do Foundry | Edição Jogo do Ano, com `source` e página | verdade do lado do Foundry |
| `tormenta-livros/livros/**.md` | conversão de comunidade | ler regra, **não** conferir número |

O markdown erra: joia do Aristocrata sai T$ 100 (PDF, T20-DB e o dataset do
arauto dizem T$ 300); itens do Amnésico T$ 100 (PDF: T$ 500); a tabela do Nobre é
de uma impressão anterior (Gritar Ordens no 5º nível, sem Palavras Afiadas —
o PDF diz "Palavras Afiadas. No 2º nível", igual ao T20-DB e ao compêndio).

**Ferramentas** (`npm run conferir`, `npm run textos`):
- `scripts/extrair-pdfs.py` — PyMuPDF, 1.648 páginas de 6 livros → `scripts/.cache-pdf/` (gitignorado).
- `scripts/conferir-livros.mjs` — compara o T20-DB com o PDF. Hoje: **0 divergências
  em raças e classes**; nas origens sobram 5 candidatas de Heróis de Arton, cujo
  layout no PDF é diferente. Não corrige nada, só lista.
- `scripts/gerar-textos.mjs` — descrições → `src/data/textos.json` (**gitignorado**:
  o repo é público e o texto é da Jambo). Sem ele o wizard roda igual, só sem descrição.
- `scripts/livros.mjs` — leitor do markdown, ainda útil pra prosa.

**Conclusão da auditoria: o T20-DB conferiu em tudo que dá pra ler automaticamente.**
Os erros que eu tinha "achado" no markdown eram do markdown.

### Rodada de bugs do teste no Foundry (2026-08-31, tarde)

Doze defeitos relatados testando no mundo real. Os de raiz:

- **Poder racial "Magias" no lugar de "Magias (Arcanista)"** — o módulo
  `bestiario-de-arton` tem um poder `racial` chamado só "Magias", e `magias` é
  prefixo de `magias_1_circulo`. `resolverPoder` agora aceita o **tipo esperado**
  e roda a escada primeiro só entre itens desse tipo.
- **Só 3 divindades apareciam** — o requisito de devoto era **E** entre raça e
  classe; o livro (cap. 2) diz **OU**, e humanos e clérigos podem qualquer uma.
- **Contador de magias parado em 0/3** — poder e magia só entravam no estado ao
  trocar de passo. Agora sincronizam no clique; o que não pode ser marcado vem
  `disabled` (cota cheia ou pré-requisito não cumprido), e pegar o Poder A
  libera o Poder B na hora.
- **Rolagem de atributo gravava o total cru do dado** (Força 14). Converte pela
  tabela do LB p.17. Épica/Nimb/Valkaria/Khalmyr estavam com valores inventados.
  Trocar de método zerava e logo reaplicava o formulário antigo — dava pra rolar
  14 e voltar pra compra de pontos com ele.
- **Origem**: "um poder de combate a sua escolha" existia no T20-DB
  (`poderes_categoria_livre`) e o port descartava; itens que vinham como texto
  solto ("traje da corte") eram descartados em silêncio.
- **Habilidades raciais com sub-escolha** (Memória Póstuma do Osteon, Deformidade
  do Lefou, Fonte Elemental do Golem, Qareen, Kliren) não existiam. O port
  normaliza as três formas do T20-DB numa só; as respostas viram perícia
  treinada, bônus em `system.pericias.<code>.outros` ou item no actor.

Menores: busca em todo dropdown com 8+ opções; raça mostra descrição, tamanho por
extenso, deslocamento e as habilidades que concede; seletor de atributo racial
respeita "diferentes" e "atributos disponíveis" e diz o que é proibido; radios
voltaram a ser nativos (o desenho à mão virava rosquinha); topo mostra só o passo
atual; lutador não passa por Magias; dinheiro inicial rola uma vez só.

**Correção de dado contra o livro:** o T20-DB dá ao clérigo 2 magias iniciais e 1 a
cada nível par (padrão do bardo). LB cap. 4 diz **três** iniciais e **uma a cada nível**.
A correção está em `scripts/port-t20db.mjs`, citada — o T20-DB não foi alterado.

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

**Dinheiro:** `system.dinheiro` = `{tc, tp, to, tl}`. **T$ (Tibar, prata) = `tp`**; `tl` é platina e só aparece na ficha com a flag `sheet.mostrarPlatina` (lang: CurrencySilver abrev. "T$" ↔ `tp`; Item Piles usa `tp` como primária). Dinheiro inicial vai em `dinheiro.tp`.

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
| Descrição de classe no painel                            | ✅ Plan 6A                              | item Foundry (`IndexedClasse.system.descricao`)    |
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
