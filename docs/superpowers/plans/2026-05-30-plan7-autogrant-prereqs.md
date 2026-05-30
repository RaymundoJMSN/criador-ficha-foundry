# Plan 7 — Auto-grant por nível + paridade de pré-requisitos (F4 + F5)

**Data:** 2026-05-30
**Cobre:** ROADMAP F4 (poderes/habilidades automáticos por nível) e F5 (pré-requisitos completos).
**Princípio:** portar de `T20-DB/motor/level_up.py` e `motor/prerequisitos.py`. NÃO reinventar.
**Pré-requisito:** Plan 6 (multipath de classe — auto-grant depende do caminho).

> Endereça a queixa central: "não sei a quantos poderes o personagem tem acesso / que poderes
> ganha por nível em cada classe". F4 resolve o que é **automático**; F5 resolve o que é **elegível**.

---

## Bloco A — Auto-grant por nível (F4)

### A1. Ler poderes/habilidades automáticos no RuleEngine
- **Fonte T20-DB:** `motor/level_up.py` (`opcoes_nivel`/`aplicar_nivel`); dados em `data/poderes-por-nivel.json` (já portado) + `classes.json.tabela_progressao`.
- **Arquivos:** `src/rules/progressao.ts` (existe), `src/rules/classe.ts`, `src/rules/engine.ts`.
- **Fazer:** função `getAutoGrants(classeId, caminho, nivel) → { poderesAuto: string[], habilidadesAuto: string[] }` somando nível 1..N. Distinguir **auto-grant** (não conta cota) de **escolhível** ("Poder de Classe").
- **Aceite:** guerreiro nv5 lista habilidades automáticas certas; cota de poderes escolhíveis separada.
- **Teste:** `test/rules/progressao.test.ts` — auto-grants acumulam por nível; caminho afeta lista.

### A2. Cota de poderes escolhíveis por nível
- **Arquivos:** `src/rules/classe.ts`, `src/wizard/steps/poderes.ts`.
- **Fazer:** `getPoderSlots(classeId, nivel)` = nº de "Poder de Classe" liberados até o nível. Passo Poderes mostra "X de N". Pool = poderes da classe + categorias gerais + `concedido` da divindade (espelha `_poderes_disponiveis_broad`).
- **Aceite:** nv1 dá a cota certa; subir nível aumenta N; pool inclui concedidos da divindade quando há devoção.

### A3. Materializar auto-grants no actor
- **Arquivos:** `src/actor/mapper.ts`, `src/actor/writer.ts`.
- **Fazer:** adicionar itens auto-grant ao `items[]` buscando por slug/nome no pack (`poderes`/`poderes-distincao`). Item sumido → notifica, cria sem ele (padrão existente do writer).
- **Aceite:** actor nv5 vem com poderes/habilidades automáticos + os escolhidos, sem duplicar.

### A4. UX: auto-grants read-only
- **Arquivos:** `src/wizard/steps/poderes.ts`, `templates/wizard/poderes.hbs`.
- **Fazer:** seção "Recebidos automaticamente" (read-only) distinta de "Escolha N".
- **Aceite:** jogador vê o que ganhou de graça vs o que precisa escolher.

---

## Bloco B — Paridade de pré-requisitos (F5)

### B1. Portar tipos faltantes de pré-requisito
- **Fonte T20-DB:** `motor/prerequisitos.py` (~15 tipos). Hoje `rules/poderes.ts` cobre 6: atributo, nivel, poder, classe, raca, pericia_treinada.
- **Arquivos:** `src/rules/poderes.ts` (estender `PrereqType` + checks), `src/data/prereqs.json` (já portado; conferir cobertura).
- **Faltantes:** `nivel_classe`, `habilidade_classe`, `habilidade_racial`, `divindade`/`devoto`/`devoto_divindade_aceita`, `proficiencia`, `poder_subcategoria`, `poder_caminho`, `escola_de_magia`, `magia`, `linhagem`/`linhagem_definida`.
- **Fazer:** um check por tipo, espelhando o handler Python. Tipos manuais/narrativos (`outro`) NÃO bloqueiam.
- **Aceite:** elegibilidade idêntica ao motor T20-DB para uma amostra de poderes.

### B2. Estado de ficha consumido pelos checks
- **Arquivos:** `src/rules/poderes.ts`, `src/wizard/state.ts`.
- **Fazer:** `isEligible` recebe contexto completo (atributos finais, nível, classe+caminho+linhagem, raça+variação, perícias treinadas, divindade, poderes/habilidades já possuídos, proficiências, magias/escolas). Montar de `WizardState`.
- **Aceite:** pré-req `pericia_treinada` enxerga perícias da classe+origem+Int+raça; `nivel_classe` enxerga o nível.

### B3. Testes por tipo
- **Arquivos:** `test/rules/poderes.test.ts`.
- **Fazer:** fixture por tipo de pré-req com caso elegível + inelegível.
- **Aceite:** todos os ~15 tipos cobertos; `outro` nunca bloqueia.

---

## Saída do Plan 7
Personagem nv1-20 vem com poderes/habilidades automáticos corretos por classe+caminho;
passo Poderes mostra cota certa e só lista elegíveis com motivo da inelegibilidade.
Elegibilidade idêntica ao T20-DB.

## Fora deste plano (vai p/ Plan 8 = F6)
Loja de equipamento completa (compra nv2+ com saldo), resume via `setFlag`, limites de magia
afinados, i18n, validação final na Revisão. (Dinheiro inicial por nível já existe em `dinheiro.json`.)

## Atualizações obrigatórias ao concluir
- ROADMAP: F4→✅, F5→✅.
- CLAUDE.md: "Paridade T20-DB" (auto-grant ✅, pré-req ✅ ~15 tipos), Mapa (`progressao.ts`, novos checks em `poderes.ts`).
