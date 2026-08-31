# t20-ficha-wizard — Roadmap forward

**Data:** 2026-08-31
**Status base:** F0–F5 feitos; F6 quase. Falta exercitar a camada Foundry.
**Specs:** [`specs/2026-05-29-ficha-wizard-design.md`](specs/2026-05-29-ficha-wizard-design.md) ·
[`specs/2026-08-31-nivel-1-20-design.md`](specs/2026-08-31-nivel-1-20-design.md)

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

- ✅ `CompendiumIndex`, `RuleEngine`, `WizardState`, `WizardApp` (11 passos), `ActorWriter` + `mapper`.
- ✅ Dados portados via `scripts/port-t20db.mjs`.

---

## F1 — UI + bugfix ✅

Todos os 11 passos navegáveis. Ver Plans 5, 6A, 6-June02, 7-June02.

---

## F2 — Sub-escolhas ✅ (2026-08-31)

- ✅ Modificadores escolhíveis de raça (humano +1×3).
- ✅ Caminho de classe virou **árvore**: `classes.json.caminhos` traz slug do item,
  nome e sub-escolhas encadeadas. Arcanista → Feiticeiro → linhagem → (Dracônica)
  tipo de dano. UI = um seletor por nível, revelado conforme o anterior é respondido.
  `cadeiaSubEscolhas` / `respostaSubEscolha` em `rules/classe.ts`.
- ✅ Origem: **escolha de dois benefícios** (perícia e/ou poder, o exclusivo incluso).
  Antes o exclusivo era automático, escolhia-se 1 poder extra e as perícias da
  origem **nunca chegavam na ficha**.
- ❌ Escola de especialista do mago — o T20-DB não modela; sem dado, sem UI.

**Nota:** o `resolveSubescolhas()` genérico do plano original não foi feito. Com
caminho e origem cobertos por dois blocos próprios, um resolvedor genérico seria
mais código para o mesmo resultado.

---

## F3 — Raças complexas ✅ para o conteúdo instalado (2026-08-31)

O compêndio do sistema traz 18 raças e **já separa** Aggelus e Sulfure como itens
próprios — a variação de Suraggel não precisa de UI. Moreau, Duende, Golem Desperto,
Mashin, Soterrado e Trog Anão **não estão instalados**: são conteúdo de outros livros.

- ✅ `modificadores_atributo` tipo `misto` (Osteon, Lefou) — saíam **sem nenhum**
  atributo racial, porque o port só lia `fixo` e `escolha`.
- ✅ tipo `alternativo` (Suraggel) → o port emite `aggelus` e `sulfure` como raças.
- ✅ `atributos_disponiveis` deixou de ser descartado (Lefou aceitava +1 em Carisma).
- ✅ As 18 raças do compêndio acham suas regras (teste de integração).
- ❌ Construtor passo-a-passo (Duende/Golem Desperto) — só faz sentido quando o
  conteúdo estiver instalado.

---

## F4 — Auto-grant por nível ✅ (2026-08-31)

- ✅ `progressao_classes.json.tabela` (portada de `regras/progressao_classes.json`)
  é o **eixo de nível**: habilidade automática por nível, slots de poder, círculo.
- ✅ `habilidadesAte` concede só o que o nível alcança, uma por família
  (`ataque_especial_8` substitui `ataque_especial`, não soma).
- ✅ `slotsDePoder` acumula os níveis 1..N (nv5 = 4 poderes, era 1).
- ✅ Lista de poderes inclui **poderes gerais** (LB cap. 5: poder geral substitui
  poder de classe).
- ✅ Nível grava em `classe.system.niveis` — o campo que o sistema realmente usa.

---

## F5 — Paridade de pré-requisitos ✅ (2026-08-31)

`rules/poderes.ts` cobre os 20 tipos de `motor/prerequisitos.py`. Os nomes de campo
estavam errados, não só faltando: `{tipo:"poder"}` usa `id` e o código lia `poder`,
então **237 pré-requisitos falhavam sempre**. Comparação passou a ser por slug do
T20-DB e o atributo é o total final. Tipo narrativo/desconhecido não bloqueia.

---

## F6 — Polish ⚠️

- ✅ Validação final: `engine.pendencias()` lista o que falta e trava o botão Criar.
- ✅ Cota de magias por classe e nível (o cálculo antigo era modificador de D&D).
- ✅ Dinheiro inicial de nv2+ (já vinha de `dinheiro.json`).
- ✅ Resume: rascunho em flag do usuário, sobrevive a F5.
- ⚠️ Loja de equipamento: funciona, mas sem filtros finos.
- ❌ i18n: `lang/pt-BR.json` incompleto; sem `en`.

---

## Resolvedor de slug (novo, 2026-08-31)

`src/compendium/resolver.ts` casa slug do T20-DB com item do compêndio por uma
escada de regras (exato → qualificador de classe → prefixo → prefixo+classe →
grupo com dois-pontos → mesmos tokens → `slug-map.json` curado à mão).
Habilidades automáticas que resolvem: **71/161 → 160/161**. Poderes de classe
com item instalado: **312/513 (61%)** — o resto é Heróis de Arton, não instalado.
`test/compendium/cobertura-slugs.test.ts` mede isso a cada `npm test`.

---

## Fora de escopo (pós-1.0)

- Level-up de actor existente (o wizard só cria).
- Export PDF (o módulo `t20-pdf-exporter` já faz).
- NPCs / outros tipos de actor.
- Sistemas não-`tormenta20`. Foundry < v13.

---

## Pendente de validação no Foundry

O código está testado (219 testes, incluindo integração contra os compêndios
reais), mas **a camada Foundry ainda não foi exercitada nesta rodada** — criar
actor, hooks do sistema, PV/PM na ficha aberta. Rodar no mundo
`testes-criador-de-ficha` a matriz: guerreiro nv1, guerreiro nv7, arcanista mago
nv5, clérigo nv3 com divindade, anão nv1.
