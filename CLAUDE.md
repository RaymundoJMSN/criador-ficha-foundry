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

### Pedidos do Ray de 2026-09-07 (noite)

- **Sem contador de passos** nem barra de pontos no cabeçalho (o jogador só
  avança); botão e janela chamam "Criar Personagem".
- **Rolagem preservada**: `PARTS.wizard.scrollable` inclui `.t20w-content`
  (o rolo principal) — sem isso todo re-render voltava ao topo.
- **📖 Abrir no compêndio** (`data-action="abrirItem"` + `data-uuid`; botão
  direito no nome também): poderes, magias, habilidades de classe, caminhos,
  benefícios de origem, poderes concedidos, habilidades e montagem da raça.
  `uuidDe(item)` em `compendium/slug.ts` monta o UUID a partir de `packId`.
- **Caixas iguais**: radio e checkbox com `appearance: none` e quadrado próprio
  (`::before` com `content: ""` vence o glifo do tema do Foundry, que só
  desenhava o círculo depois de marcar).
- **Classe** mostra perícias (fixas; "1 entre Luta ou Pontaria"; "mais 2
  entre…") e proficiências, de `classes.json`; caminhos com descrição e 📖.
- **Divindade**: Crenças e Objetivos, Símbolo Sagrado, Canalizar Energia, Arma
  Preferida, Obrigações & Restrições, lidos de `06-deuses.md` para
  `textos.divindades` (só o Panteão; deuses menores não têm esses campos no
  markdown).
- **Compatibilidade — T20 Nível dos Poderes**: `marcarNiveisDosPoderes` grava
  `flags.t20-nivel-poderes.nivelObtido` (1–20 ou "bonus") em todo poder da
  ficha nova quando o módulo está ativo: habilidade = nível da tabela; poder
  escolhido ocupa, na ordem, os níveis com vaga de poder; origem/raça/
  divindade/distinção/idade = "bonus". Loja (t20-hayd-loja) só precisa do T$
  em `dinheiro.tp`, que já gravamos; GMTools e Zapera não tocam na criação.

### Pedidos do Ray de 2026-09-07 (tarde)

- **"Magias (Clérigo)" errado**: a escada do resolver tentava o nome exato antes
  do "Nome (Classe)", e o "Magias" solto do Místico (`ability`, subtipo vazio,
  pack guia-de-npcs) roubava o casamento. Agora: override → `slug_classe` →
  exato (quem é da classe pelo `subtipo` ou pela **pasta** vence o empate) →
  prefixo+classe → prefixo → grupo → tokens. O índice passou a carregar
  `pasta` ("Classe / Clérigo") lida de `pack.folders` — é a organização em
  pastas dos compêndios que o Ray apontou.
- **Poderes gerais só da categoria certa** (`geralDaLista`): `tipo:"geral"` no
  compêndio inclui poderes de raça ("Glamour (Duende)", subtipo Duende),
  complicações ("Desvantagem"), montaria, parceiros, grupo, distinção… Entram
  só Combate/Destino/Magia/Tormenta (ou subtipo vazio) e os da própria raça
  (tokens do subtipo ⊆ tokens da raça + raça-base + escolhas `raca_*`: qareen de
  Luz vê "Qareen de Luz"; Aggelus vê "(Suraggel)").
- **Pré-requisito lido do texto** (`prereqsDoTexto`): poder fora do T20-DB tem
  "Pré-requisitos: Sab 2, treinado em Vontade, 5º nível de nobre, Duas Cabeças."
  no item — vira `atributo`/`pericia`/`nivel_classe`/`habilidade_classe`
  ("Fúria ou Fúria Divina" = OR), `divindade_druida` ("druida de Tenebra"),
  `habilidade_classe: magias` ("lançar magias"). O que não dá para ler (asas,
  arma natural, familiar) não bloqueia. `describeUnmet(slug, state, descricao)`.
- **Magias**: filtro por escola e (quando há as duas) por tradição; badge
  "Arcana/Divina/Universal". Tradição aberta por poder só vale no 1º círculo
  (Centelha Mágica: "uma magia arcana ou divina de 1º círculo"). O port passou a
  contar `lancar_magia` com `escolha.tipo === "magia"` em `magias_por_poder`
  (Centelha, aspectos do druida, truques). `slugsDePoderesComMagia(state)` =
  poderes escolhidos + `divindade_poderes` — o concedido de Wynna não entrava.
  **Marcada fora do filtro vai como input escondido** (`selecionadasOcultas`):
  o FormData só vê o que está na tela e derrubava as outras ao clicar.
- **Sub-escolhas de poder** (`data/subescolhas_poder.json` +
  `rules/subescolhas-poder.ts`): Aspirante a Herói (atributo), Treinamento em
  Perícia, Conhecimento Enciclopédico (2 de Int), Foco em Arma/Arma Amada,
  Proficiência, Foco/Especialização em Magia (magia conhecida), Especialista em
  Escola, Explorador, Inimigo de, Baforada Dracônica, De Outro Mundo, Espião,
  Caminho da Perfeição. `poderesAdquiridos(state)` junta habilidades, poderes,
  origem, divindade, montagem e concedidos da raça; bloco "Escolhas dos seus
  poderes" no passo Poderes (`sp-<slug>-<i>` → `sp_<slug>_<i>`); pendência na
  Revisão. Writer: atributo = AE no ator (`system.atributos.X.bonus`), perícia
  treinada = `treinado`, bônus = AE `outros`, magia = item, e o nome do item
  ganha a escolha ("Aspirante a herói (Sabedoria)"). Sapiência (Moreau da
  Coruja) = escolha racial `magia` com `escola: "adv"` em `montagem.json`.
- **Sub-escolha genérica**: poder cujo texto tem "escolha um/uma…" ou "à sua
  escolha" e não está no JSON ganha um campo de texto OPCIONAL (vai para o
  nome do item, não trava a Revisão). Estruturados novos: Duplo Feérico
  (habilidade de 1º nível de outra classe, via `habilidadesAte(classe, 1)`),
  Cosmopolita (geral Combate/Destino/Magia ou de classe com 2+ níveis,
  filtrado pela elegibilidade), Futura Lenda (poder da própria classe), Totem
  Espiritual (animal → magia da tabela do T20-DB, embutida), Foco em Perícia,
  Especialização/Mestre em Arma, Mestre em Escola, Ushultt/Poder da
  Amizade/Citadino (texto). Chave é o slug do NOME do item: "Inimigo de
  (Criatura)" → `inimigo_de_criatura`, "Arma Amada (Anão)" → `arma_amada_anao`.
- **Origem especial** (HA "Sobre Origens Especiais"; Atlas/DB): "fornecem um
  benefício único" — perícias + poder da origem, tudo fixo (`origemEspecial`:
  sem lista de poderes e com `poder_unico_id`). O poder único resolve também
  pelo nome da origem (`slugsDoPoderDaOrigem`), que é como o compêndio guarda
  ("Aspirante a herói", tipo origem). Antes não ia para a ficha.
- **Panteão como um todo** (LB p.103 clérigo; Deuses de Arton frade):
  `PANTEAO` em `divindade.ts`, listado só para clérigo/frade (regra de classe:
  nem humano nem Devoções Abertas), sem concedido; item "Devoto do Panteão" na
  ficha com a restrição. O T20-DB também tem um `panteao` — o daqui substitui.
- **Nome aleatório**: botão 🎲 no passo Nível sorteia da Tabela 1-24 de Heróis
  de Arton (`textos.nomes`, gerado em `gerar-textos.mjs`, gitignorado): coluna
  da raça escolhida (humano, anão, dahllan, elfo, goblin, hynne, minotauro,
  qareen), senão qualquer.

### Pedidos do Ray de 2026-09-07 (manhã)

- **Listas em ordem alfabética** (`localeCompare` pt-BR) em raças, origens,
  classes, multiclasse, subescolhas de classe, divindades, perícias, magias,
  opções de habilidade e listas raciais. Poderes já eram (marcados/elegíveis/resto).
- **Combobox** (`src/wizard/combo.ts`): todo `<select>` com 8+ opções vira UM
  campo — o select fica escondido (`display:none`, o FormData continua lendo
  dele) e o input por cima filtra sem acento, abre a lista no foco, setas/Enter
  escolhem, Esc restaura; escolher dispara `change` no select, então os
  listeners existentes não mudaram. Optgroup vira cabeçalho da lista.
- **Semântica "diferentes"**: "+1 em dois atributos" SEM a palavra deixa pôr os
  dois no mesmo atributo; "+1 em dois atributos diferentes" não. Vale para o
  texto do item (`escolhasDaDescricao`) e para o T20-DB (`SEM_DIFERENTES` no
  port: mashin, minauro, kallyanach, meio_elfo — o T20-DB marcava errado).
- **Port `alternativo`**: Kallyanach tinha virado duas raças
  `alt_um_atributo`/`alt_dois_atributos` (e a Herança Dracônica ficava presa a
  ids sem item). Agora alternativa sem `fixos` = MODO de atributo da mesma raça
  (`alternativa` no grupo); Suraggel segue como Aggelus/Sulfure; Duende e Moreau
  (sem alternativas) entram só com o comum.
- **Montagem de raça** (`src/data/montagem.json` + `rules/montagem.ts`,
  escrito à mão a partir dos livros): Duende (natureza, tamanho, 3 presentes,
  tabu), Kallyanach (2 bênçãos; Armamento pede arma natural, Prática Arcana
  pede magia arcana de 1º), Golens Despertos (chassi, fonte de energia com
  elemento/magia divina, tamanho), Mashin (maravilha mecânica opcional que troca
  uma perícia — `getRaceSkillBonus(ref, escolhas)`), Kobolds (2 talentos com
  `requer`), Vampiro (Resquícios da Outra Vida como escolha racial, igual à
  Memória Póstuma). Estado: `mont_<passo>` = ids marcados,
  `mont_<passo>_<opção>_sub`. Grupos de atributo das opções (Natureza Animal,
  chassi de Bronze) entram em `getRaceModifierGroups(ref, escolhas)`.
  **O item do compêndio é a fonte dos efeitos**: `resolverMontagem` no writer lê
  os Active Effects do item ("Duende Minúsculo" já traz For –1, tamanho e
  deslocamento) e só aplica por fora o que o item não tem — sem isso o For –1
  entrava duas vezes. Sub-escolha vai no nome do item ("Herança Dracônica
  (Fogo)", "Armamento Kallyanach (Cauda (impacto))"), inclusive para as escolhas
  `lista` antigas (Fonte Elemental do golem) que antes ficavam só no wizard.
  Efeito em item que a raça já concedeu (Tabu –5 na perícia) vai como AE no
  ATOR com `origin` — AE posto num item já existente não é transferido.
- **Dois "Golem"** no compêndio (Livro Básico e Golens Despertos de Ameaças):
  `nomeDaRaca` põe o pack no nome repetido, `racaNome` guarda esse nome e o
  `ALIAS` em `montagem.ts` leva "golem_ameacas_de_arton" → `golem_desperto`
  (e "kobolds" → `kobold`).
- **Origens com texto inteiro** (`gerar-textos.mjs`): descrição completa +
  "Benefício." + "Itens." do markdown (`descricaoCompleta` em `livros.mjs`),
  PDF só como reserva. O T20-DB usa os nomes do Atlas e o Dragão Brasil renomeou
  ("Aspirante a Herói" = "Nascido Para Ser Herói"): tabela `ALIAS_ORIGEM` casada
  por itens + benefício. 130/131 (`um_com_os_kami` não está em livro nenhum).
  Template usa `.t20w-texto-livro` (`white-space: pre-line`).
- Poder concedido da divindade mostra a descrição; habilidades de classe em
  fonte normal (o `li` 0.85em × `.t20w-desc` 0.8em dava 8,8 px); base 14px.
- **Cuidado com heredoc no Bash tool**: `\n`/`\r` viram quebra de linha real
  dentro de `<<'EOF'`; patch com barra invertida vai por arquivo (Write) e
  `python arquivo.py`.

### Noite de 2026-09-07 (autônomo, solo)

- **UI**: `styles/wizard.css` (declarado no `module.json`; link de fallback no
  init porque o servidor só relê o manifesto ao reiniciar). Cabeçalho com
  título + barra de progresso (passos feitos clicáveis), cartões, itens de lista
  com seleção destacada, descrições recolhíveis (`<details>`) em poderes,
  habilidades e magias, Revisão com atributos em cartões e tags de tudo que vai
  para a ficha, janela 840×720 redimensionável, botão ⟲ recomeçar, rascunho e
  recomeçar via `DialogV2` (window.confirm travava o cliente).
- **Raças só do compêndio** (`registrarRacasDoCompendio`): Moreau, Kallyanach,
  Vampiro… atributos fixos e escolha lidos do item; "+2 em um OU +1 em dois"
  vira modo com radio (`alternativa` no `AtributoEscolhaDef`).
- **Deuses menores** (`scripts/port-pdf-deuses-menores.mjs` → `deuses_menores.json`
  + `registrarDeusesMenores`): 59 do Guia com a linha "Devotos" (sem coringa
  humano/clérigo) + os que só existem no compêndio (Mauziell, Tibar; subtipo
  precisa parecer nome de deus). Select com optgroups; cota de concedidos
  limitada ao que o deus tem.
- **Distinções** (regra da mesa; `rules/distincoes.ts`): nível ≥ 5, 76 do
  compêndio (`tipo:distincao` + `subtipo`), marca "(Marca)" automática, poderes
  entram como gerais. Poderes: ordem marcados/elegíveis/resto + "só elegíveis".
- **Classes de Heróis de Arton**: `port-pdf-classes.mjs` guarda
  `proficiencias_texto`/`pericias_texto` (com "Como o X básico" resolvido) em
  duas passadas por causa das duas colunas; ambíguo (Machado de Pedra) fica
  no padrão. Tabela não engole mais a página seguinte.
- Retrato/token = ícone da raça; aviso sem permissão ACTOR_CREATE; mensagem no
  chat ao criar (link do ator); T$ com milhar; `getClasse("")` não cai em
  arcanista.
- Ferramentas de conferência: `npm run port:pdf` (classes, com `--conferir`),
  `npm run port:deuses`.

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

## Site (t20.raynathus.com.br/criar) — o MESMO módulo no navegador

O site do t20-ficha-online (`X:\FoundryVTT\Data\modules\t20-ficha-online`,
Express + SQLite em 127.0.0.1:8731, Caddy em `t20.raynathus.com.br`) ganha o
criador em `/criar/`. Não há segunda implementação: `site/main.ts` instala um
**shim do Foundry** (`site/shim.ts`) e importa `src/module.ts` inteiro.

- Shim = só o que o módulo usa: `game.packs` (despejo `site/data/compendio.json`,
  gerado por `npm run export:compendio` dos packs em LevelDB; 4.220 itens, 6,6 MB,
  gitignorado — texto Jambo), `Actor.create` em memória (`ActorShim` reproduz o
  hook de raça: atributos `.racial` + `grants`), `game.settings`/flags do usuário
  em localStorage, `ApplicationV2` + `HandlebarsApplicationMixin` (Handlebars no
  navegador, templates via fetch, `scrollable` preservado, clique em
  `[data-action]` → `_onClickAction`), helpers `eq/gt/lt/and/or/not/localize`,
  `DialogV2.confirm` (window.confirm), `ui.notifications` (toast), `fromUuid`
  (modal com a descrição do item — é o que o 📖 abre no site), `ChatMessage` (nada).
- Fim do fluxo: o writer chama `actor.sheet.render(true)` → o site abre "Ficha
  pronta" com o JSON para baixar. No Foundry, botão **Importar ficha (JSON do
  site)** na aba Atores (`launcher.ts`) faz `Actor.create(json)`.
- Build: `npm run build:site` (Vite com `vite.config.site.ts`, base `/criar/`,
  saída `site/dist` + `scripts/copiar-site.mjs` copia templates/styles/lang para
  `site/dist/modules/t20-ficha-wizard/` e o compêndio para `site/dist/data/`).
  `npm run deploy:site` copia tudo para `server/public/criar` do ficha-online —
  o Express serve `public/` estático, sem reiniciar o serviço. Preview local:
  `.claude/launch.json` → `criador-site` (vite preview na 4174).
- Regra: **nunca** copiar lógica para o site. Se algo do Foundry faltar ao rodar
  lá, acrescenta-se ao shim. `tsc` não inclui `site/` (o Vite compila).
- **Fase 2 (salvar no site)**: login por nome (sem senha, padrão do data-rpg;
  `localStorage t20w-site.jogador`). O shim chama `onRascunho` toda vez que o
  wizard grava a flag `rascunho` → `main.ts` faz PUT com debounce de 1,5 s em
  `/api/criador/personagens/:id` (id aleatório por personagem, guardado em
  `t20w-site.personagemAtual`; "recomeçar" apaga a flag → próximo salvamento é
  personagem novo). A ficha final vai no mesmo registro (`ficha`, COALESCE no
  upsert). Painel "Meus personagens": abrir (`?personagem=<id>` → grava a flag
  e `autoConfirmar` responde "Retomar" sozinho), baixar o JSON de novo, apagar.
  Servidor: tabela `criador` em `server/src/db.js`, rotas em `app.js`, teste
  `server/test/criador.test.js`. **Rota nova só entra depois de `nssm restart
  T20Ficha` (admin)** — o estático em `public/criar` entra na hora.
- Pendente: DNS/Caddy `ficha.raynathus.com.br` (hoje é `t20.raynathus.com.br`;
  o Caddy manda `/modules/*` da raiz para o Foundry — `/criar/modules/...` não
  colide), deuses menores na ficha do deus, editar a ficha já gerada.

## Como lançar

`git tag v0.2.1 && git push origin v0.2.1` → `.github/workflows/release.yml`
testa, builda, zipa (`module.json`, `dist`, `templates`, `lang`, `styles`,
`assets`) e publica a release; o `module.json` do repo aponta para
`releases/latest/download/…`, então o manifesto de instalação é fixo. Só o
mestre da mesa (Ray) cria tag — release é ato público.

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

## Feedback do Davi (2026-09-07)

- **Versátil (humano)**: checkbox no grupo "Perícias de raça" grava
  `escolhasPorItem.versatil_poder`; `getRaceSkillBonus` tira 1 perícia e
  `poderesGeraisExtras` dá +1 slot só-geral. Contadores "(restam N)" nos grupos
  Int e raça.
- **Perícias treinadas no passo Poderes**: `state.periciasTreinadas` nunca era
  preenchido (ficava `[]`) — o passo agora usa `getTrainedPericaSlugs(state)`
  do mapper (classe + Int + raça + origem). Sub-escolha de atributo (Aspirante
  +1) também entra no `atributos` da elegibilidade.
- **Poderes de raça sem subtipo** (Vampiro do Guia de NPCs, "Soco Foguete"
  do HdA): `geralDaLista` recebe a `pasta` e lê a raça de "Raças - X (…)" ou
  "Poderes Raciais / X"; "Distinções - …" fica de fora.
- **Categorias** do filtro = `categoria` por entrada (Classe, Combate,
  Destino, Magia, Tormenta, Concedido, Raça, Geral, Distinção).
  **Concedidos do deus escolhido** entram na lista como poderes gerais (LB
  cap. 5, grupos), menos os já pegos pela devoção.
- **Deuses**: `arton` do T20-DB filtrado (era "deus" aleatório); concedidos
  do Deuses de Arton com subtipo = nome de deus maior ("Kallyadranoch",
  "Lena, Thyatis") entram no `poderes_concedidos` do deus em
  `registrarDeusesMenores`.
- **Site → Foundry**: o despejo LevelDB guarda os AEs em chaves
  `!items.effects!<item>.<efeito>` — o item só tinha ids soltos e o
  `Actor.create` rejeitava o JSON em silêncio (`undefined`). O exportador
  junta os efeitos; o botão "Importar ficha (JSON do site)" ainda limpa
  `folder`/`_id` e efeitos não-objeto (JSONs antigos importam).
- **Perícias de raça + Versátil ficam no passo Raça** (Ray, noite): bloco
  `racaPericias` (`prepareRacaPericias`) com as checkboxes `per_raca-*`, o
  checkbox Versátil e um select `versatil_poder_id` com os gerais elegíveis
  (lista vem de `preparePoderesContext` no próprio passo Raça). O poder vai
  para `state.poderes` (`_setVersatilPoder`) e gasta o slot extra. O passo
  Perícias só mostra o resumo. `_savePericiasPicks` e o caminho do formData
  só sobrescrevem os grupos presentes na tela (senão o passo Perícias apagava
  as de raça).
- **Centelha Mágica** (e todo slug de `magias_por_poder.json`): sem
  sub-escolha genérica — a magia é escolhida no passo Magias, que agora entra
  também quando a magia vem de poder concedido (`slugsDePoderesComMagia` em
  `_passos`).
- **Site**: `Roll` não existia no shim (`ReferenceError` no dinheiro inicial)
  → `RollShim` (NdM, kh/kl, aritmética). `copiar-site.mjs` copia os ícones
  referenciados pelo despejo (Data/ e Code/resources/app/public) — eram os
  404 no console.

## Padrões (2026-09-08)

Leia `docs/superpowers/PADROES.md`: escolha acontece onde a coisa é obtida;
listas de poder/magia/sub-escolha têm UMA origem cada (`preparePoderesContext`,
`filterMagias`/`opcoesDaSub`, `subescolhas_poder.json`); UI por tipo de
controle (`.t20w-item`, `.t20w-pcheck-group[data-max]`, `montarCombo`).

- Extras de poder geral (Versátil, complicação, Já Vi Coisas) são escolhidos
  na tela de origem (`poder_extra-<fonte>` → `escolhasPorItem.poderes_extras`)
  e no passo Poderes ficam marcados/riscados fora da cota. `_mesclarMarcados`
  preserva ids sem checkbox (variantes, extras) — sem isso o clique num
  checkbox ou o "Próximo" apagavam o "Aumento de Atributo (Força)".
- "Aumento de Atributo (X)" vira uma linha com select (`agruparVariantes`);
  o item da ficha é o da variante.
- Centelha, Orar, Truque Mágico, Truque de Palco: sub-escolha `magia` no
  próprio poder (saíram de `magias_por_poder.json`, que fica só com os que
  ampliam a lista da classe). O bloco `subEscolhasPasso` aparece no passo
  onde o poder nasce (`_subEscolhasDoPasso`).
- Ofício: `src/rules/oficio.ts` — fixos do sistema (alfa/alqu/arme/arte/cozi/
  enge) ou próprio (`system.pericias.ofi1`, formato de
  `_onPericiaCustomCreate`). Antes "oficio" era pulado em silêncio no writer.
- `computeTrained` conta marcação parcial (pré-requisito e bloco do Ofício
  reagem na hora); o erro continua segurando o avanço.
- Habilidades de classe, equipamento (📖), concedidos e benefícios de origem
  (limite `data-max`) seguem os blocos padrão. Origem com texto do livro não
  repete perícias/itens extraídos.
- Textos: `gerar-textos.mjs` cobre toda classe que algum livro descreve
  (+Treinador do HdA); classes só do compêndio (Duelista, Burguês…) ficam com
  a descrição do item, que costuma vir vazia.

## Rodada de 2026-09-08 (noite)

- `@UUID[...]{Nome}` nas descrições vira só o nome (`semHtml` do índice e
  `limparHtml` da raça).
- Sem botão 📖: duplo clique ou botão direito na linha (`.t20w-item`,
  `.t20w-opcao`, `.t20w-equip-row`, label, li) abre o item — Foundry abre a
  ficha (janela v1 `ItemSheetT20`, fica em `ui.windows`, não em
  `foundry.applications.instances`), site abre o diálogo. `data-uuid` vazio
  é ignorado.
- Descrição aberta (`.t20w-desc`) nas telas pequenas (raça, caminhos de
  classe); `<details>` só nas listas grandes (poderes, magias).
- **Sub-escolha genérica não existe mais**: `subEscolhaDoPoder` devolve null
  sem entrada em `subescolhas_poder.json`. Poder que precisa decidir algo ganha
  entrada no JSON, senão não pede nada.
- Perícias: grupos sem rolagem (`auto-fill minmax(170px)`); "oficio" entra em
  `PERICIA_SLUGS` (listas "qualquer").
- Deus com lista ≤ cota (menores com 1 concedido): `auto` no contexto,
  checkbox marcado+desabilitado com `data-fixo` (o `enforceCheckboxGroup`
  re-habilitava todo marcado — agora pula `data-fixo`), e
  `_sincronizarConcedidos` grava `divindade_poderes` (checkbox desabilitado
  não vai no FormData).
- Fichas dos deuses menores vêm de
  `deuses-arton/04-deuses-avatares/23-deuses-menores.md` (campos com ponto
  dentro do negrito: `**Crenças e Objetivos.**`), com Descrição e Devotos.
- `textos.poderes` (2.959 verbetes ##/###/#### dos livros, `poderesDosLivros`)
  = fallback de descrição: no índice (`descricaoDoLivro`) e no writer
  (`resolveItem` preenche `system.description.value` de poder vazio).
- Loja de equipamento: `itemDaLoja` tira packs `equipamentos-magicos` e
  `habilidades-de-criaturas` e pastas mágicas/artefatos/específicos/tesouros/
  distinções/raças/classes (o "Arco do Crepúsculo" vinha de
  "HdA - Itens Mágicos/Armas Específicas"). Ícone que falha fica invisível
  mas reserva o espaço (linhas alinhadas). Busca devolve o foco após o
  re-render (`_focarBusca`).
- Cuidado com heredoc do Bash em patch com regex: `
` e `\*` quebram —
  patch por arquivo (Write) + `python arquivo.py`.

## Rodada de 2026-09-09 (madrugada)

- **Frontmatter dos livros**: `ler()` do `livros.mjs` tinha a regex em string
  (`"[\s\S]"` virou `[s\S]`) e nunca casava — descrição de raça saía como
  "--- title: ...". Regex literal. 33 classes e 44 raças com texto.
- **Prevenir em vez de avisar** (ver PADROES.md §3): grupo exclusivo do duende
  (`opcaoBloqueada`), compra de pontos (`podeSubir`) e loja (`naoCabe`).
- **Pendência no passo onde se resolve**: `pendenciasComPasso` devolve
  `{passo, texto}`; `_pendenciasDoPasso` junta sub-escolhas, habilidades,
  dinheiro e pontos; "Próximo" trava. O "Falta para poder criar" da Revisão
  vira rede de segurança (vazia no fluxo normal).
- **Perícias na ficha importada**: `system.pericias.<code>` só com
  `{treinado:true}` **substitui o SkillData inteiro** — a perícia entra sem
  nome e com Força (foi o que aconteceu no Dulla.json). O writer grava também
  `label`/`atributo`/`st`/`pda` (de `src/data/pericias_sistema.json`, gerado
  por `npm run gerar:pericias` a partir do próprio sistema) e o botão
  "Importar ficha" tira `system.pericias` do `create` e reaplica por `update`
  (conserta JSON antigo).
- **Armas/Armaduras/Sentidos automáticos**: `proficienciasDoPersonagem`
  (mapper) preenche `system.tracos.profArmas/profArmaduras` pela classe;
  `sentidosDosItens` (writer) lê "visão no escuro/na penumbra/percepção às
  cegas/faro" no texto da raça e dos poderes raciais.
  **`system.attributes.sentidos.value` é um SetField**: update por caminho
  ("system.attributes.sentidos.value") não grava nada, tem de ser objeto
  aninhado.
- **Idade**: "Já Vi Coisas" é habilidade do **Adulto** (HdA p.289) —
  `podeJaViCoisas`; Adulto deixou de ser "nenhum efeito". Os poderes extras
  (complicação, Já Vi Coisas) são escolhidos no passo **Idade**, não no Nível.
  Rótulos separam as duas regras de complicação.
- **Descrição de habilidade de classe** sem item no compêndio (Façanha
  Atlética) vem de `textos.poderes`.
- **Botão** da aba Atores: "Importar ficha" (sem "JSON do site").
- **Site**: botão "Regras da mesa" (mesma tela do módulo). Para ela funcionar
  o shim passou a criar o elemento com a `tag` do DEFAULT_OPTIONS (`form`),
  aplicar as `classes` (senão o CSS não pegava) e disparar o
  `form.handler` no submit — antes o Salvar não fazia nada.
- Radio/checkbox quadrados em toda a janela (`.t20w-wizard`/`.t20w-config`,
  com `!important`): o círculo do v13 escapava fora de `.t20w-step`.

## Correções de 2026-09-09 (manhã)

- **Nome da perícia na ficha**: `label` de perícia PADRÃO tem de ficar VAZIO —
  a ficha resolve o nome pelo código. Gravar "T20.SkillAtle" fazia a ficha
  mostrar a chave crua (foi o que apareceu no Tazif.json). Só ofício próprio
  (`ofi1`, `custom: true`) usa label ("Ofício: Carpinteiro"). O writer grava
  atributo/st/pda/size/custom/label vazio, e a importação zera label que
  comece com "T20." (conserta ficha já baixada).
- **Descrição da raça**: o texto do livro vem PRIMEIRO; o item do compêndio é
  o último recurso (era ele que trazia lista de poderes no Eiradaan e
  "Aggelus: descendentes celestes"). Sub-raça sem verbete usa o da raça-base
  (Aggelus/Sulfure → Suraggel). `gerar-textos` grava toda raça que os livros
  descrevem (86 verbetes) e a descrição sai só de "## Descrição" ou da
  abertura do verbete — nunca de outra seção, senão vinha habilidade de raça
  ("Ajuntamento Escamoso…") ou a linha de modificadores. As 26 raças que o
  Dragão Brasil publica apenas como regras ficam sem parágrafo (o livro não
  tem texto), com as habilidades listadas normalmente logo abaixo.
- **Pendências no rodapé**, à esquerda do "Próximo" (`.t20w-pendencias-rodape`),
  e os erros do passo entram na MESMA lista: antes a origem mostrava a mesma
  frase duas vezes (bloco de erros no corpo + pendências).

- **Montagem de raça**: `opcaoBloqueada` trava a cota cheia também no passo
  opcional de uma escolha (Maravilha Mecânica do mashin era só aviso).
  `introRepetida` tira das opções a introdução que o pacote repete em cada uma
  e mostra no cabeçalho do passo (`explicacao`). Testes em
  `test/rules/montagem-bloqueio.test.ts`.

## Correções de 2026-09-09 (tarde)

- **Poder extra sumia**: no passo Poderes sem lista nenhuma (nível 1 não
  escolhe poder de classe) o FormData vinha vazio e `patch.poderes` zerava os
  poderes de complicação/Já Vi Coisas — daí "Escolha 2 poder(es)" na revisão.
  Sem caixas na tela, o estado atual é mantido.
- **Mesmo poder por duas fontes**: `_opcoesPoderGeral` tira da lista o que já
  está em `state.poderes` (exceto o da própria fonte e os repetíveis).
- **Duas regras de idade, excludentes**: `envelhecimentoClassico` (Livro
  Básico, "Toques Finais") = Maduro 45 anos (For/Des/Con −1, Int/Sab/Car +1) e
  Velho 70 anos (cumulativo: −3/+2), sem nível extra nem complicação.
  `idadesVariadas` (HdA) continua como está e tem prioridade — marcar as duas
  na tela de regras deixa só a de HdA valendo. `faixasDaMesa(config)` diz qual
  lista o passo mostra; o writer aplica os modificadores das duas regras.
