# Padrões do criador (módulo Foundry + site)

Regras fixas de como toda escolha funciona. Mudança nova segue isto; bug em
regra compartilhada se corrige UMA vez, no módulo central.

## 1. A escolha acontece onde a coisa é obtida

Clicou para obter → decide ali, definitivamente. Nunca "depois", nunca num
passo genérico.

| Fonte da escolha | Onde decide | Como |
|---|---|---|
| Versátil (humano) | passo Raça | checkbox + select de poder geral (`poder_extra-versatil`) |
| Complicação / Já Vi Coisas | passo Nível | select `poder_extra-<fonte>` |
| Perícias da raça | passo Raça | `per_raca-*` |
| Perícias de classe/Int | passo Perícias | `per_esc-*`, `per_int-*` |
| Ofício (qual?) | o passo em que Ofício foi marcado | bloco global `oficio` |
| Sub-escolha de poder (Centelha → magia, Aumento de Atributo → atributo…) | o passo em que o poder nasce | bloco global `subEscolhasPasso` |
| Concedidos do deus | passo Divindade | checkboxes com limite |

Poder "sem definição" nunca é opção real: "Aumento de Atributo" aparece como
uma linha com dropdown; o item que vai para a ficha é o da variante
("Aumento de Atributo (Força)"). Item que precisa de sub-escolha sai com o
sufixo no nome ("Centelha Mágica (Abençoar Alimentos)").

## 2. Módulos centrais (a única origem de cada lista)

- **Poderes** — `preparePoderesContext` (`src/wizard/steps/poderes.ts`) é a
  única lista de poderes com elegibilidade (pré-requisitos via
  `describeUnmet`, categoria, cota, extras, variantes). No app:
  `_contextoPoderes()`; qualquer select de poder geral usa
  `_opcoesPoderGeral(fonte)`. Nunca montar uma lista de poderes à parte.
- **Magias** — `filterMagias` (`src/rules/magias.ts`) para a lista do passo
  Magias; `opcoesDaSub` tipo `magia` (`circulo`, `tradicao` = `arc`/`div`,
  `escola`) para sub-escolha. Poder que ensina UMA magia específica é
  sub-escolha (`subescolhas_poder.json`); poder que amplia a lista da classe
  fica em `magias_por_poder.json`.
- **Sub-escolhas** — `subescolhas_poder.json` + `subEscolhaDoPoder` +
  `montarSubEscolhas`. A view traz `fonte`/`slug`; o app filtra por passo em
  `_subEscolhasDoPasso`. Poder novo com decisão = uma entrada no JSON, zero
  UI nova.
- **Perícias** — `buildPericiaPlan`/`computeTrained`; treinadas de todas as
  fontes só por `getTrainedPericaSlugs` (mapper). Marcação parcial já conta
  (pré-requisito reage na hora; o erro segura o avanço).
- **Extras de poder geral** — `fontesDePoderExtra`/`poderesExtrasEscolhidos`
  (`src/rules/idade.ts`); `state.poderes` contém os ids, `poderes_extras`
  diz de onde vieram; o passo Poderes mostra riscado e fora da cota.
- **Estado de checkbox → estado** — sempre `_mesclarMarcados`: o que não tem
  checkbox na tela (variante, escolhido noutro passo) permanece.

## 3. Prevenir, nunca avisar depois

Escolha inválida **não pode ser feita**: a opção fica desabilitada com o motivo
no `title`. Nada de mensagem "você errou" depois do fato.

- Grupo exclusivo / pré-requisito (Presentes do duende): `opcaoBloqueada`
  desabilita as irmãs do grupo e as que dependem de outra opção.
- Compra de pontos: `podeSubir` por atributo — o "+" morre quando o próximo
  ponto não cabe (o saldo nunca fica negativo).
- Loja: `naoCabe` desabilita o "+" do item mais caro que o dinheiro restante.
- Cota cheia (`.t20w-pcheck-group[data-max]`): o resto desabilita.

O que ainda falta aparece **no passo onde se resolve**, não no fim:
`pendenciasComPasso` (engine) marca cada pendência com o `WizardStep`; o app
soma as do passo (sub-escolhas, habilidades, dinheiro, pontos) em
`_pendenciasDoPasso` e o "Próximo" fica travado até a lista esvaziar. A
Revisão só mostra o que sobrar — no fluxo normal, nada.

## 4. UI: um padrão por tipo de controle

- Lista de itens (poder, magia, habilidade, equipamento): `.t20w-lista` +
  `.t20w-item` (`.selecionado`, `.inelegivel`, `.t20w-extra`), nome em
  `.t20w-nome[data-uuid]`, botão `.t20w-abrir` (📖 abre o item — no Foundry o
  compêndio, no site o diálogo), `.t20w-badge` para categoria,
  `.t20w-desc` para a descrição inteira, `.t20w-requer` para o que falta.
- Grupo de N escolhas: `.t20w-pcheck-group[data-max]` — `enforceCheckboxGroup`
  desabilita o resto ao chegar no máximo (perícias, concedidos, benefícios
  de origem). Contador "escolha N (restam M)".
- Select longo: `montarCombo` (busca embutida; opção `disabled` não é
  escolhível).
- Escolha ilegível/inelegível fica visível e desabilitada com o motivo
  ("— requer Des 2"), nunca some.
- Módulo e site rodam o MESMO código (templates, CSS, regras); o site só
  troca o Foundry pelo `site/shim.ts`. Nada de comportamento só de um lado.

## 5. Fluxo para coisa nova

1. Regra pura em `src/rules/*` com `--check`/vitest.
2. Dados em `src/data/*.json` (sub-escolha, prereq, tarifa) — não em código.
3. Contexto do passo em `src/wizard/steps/*`; o app só liga eventos.
4. Template reaproveita os blocos acima; CSS só em `styles/wizard.css`.
5. Testar no Foundry (junction) e no site (`npm run build:site`).
