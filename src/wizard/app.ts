import { MODULE_ID } from "../constants.js";

/** Chave da flag onde o rascunho do wizard fica salvo no usuário. */
const RASCUNHO_FLAG = "rascunho";

/**
 * Acesso às flags do usuário. `fvtt-types` só conhece o escopo "core", então o
 * escape fica aqui, num lugar só, em vez de espalhado por cada chamada.
 */
const rascunho = {
  ler(): { estado?: string; passo?: WizardStep } | undefined {
    // @ts-expect-error fvtt-types restringe o escopo de flag aos ids que conhece
    return game.user?.getFlag(MODULE_ID, RASCUNHO_FLAG) as
      | { estado?: string; passo?: WizardStep }
      | undefined;
  },
  gravar(valor: { estado: string; passo: WizardStep }): void {
    // @ts-expect-error idem
    void game.user?.setFlag(MODULE_ID, RASCUNHO_FLAG, valor);
  },
  apagar(): void {
    // @ts-expect-error idem
    void game.user?.unsetFlag(MODULE_ID, RASCUNHO_FLAG);
  },
};
import { WizardState } from "./state.js";
import { WizardStep, STEP_ORDER, STEP_META, passosAplicaveis } from "../rules/steps.js";
import { slugsDosPoderes } from "../rules/magias.js";
import { CompendiumIndex } from "../compendium/index.js";
import { validate } from "../rules/engine.js";
import {
  ATRIBUTOS,
  type Atributo,
  type Distribuicao,
  especRolagem,
  valoresFixos,
  precisaRerolar,
  poolDaRolagem,
  indiceDoMenor,
  atributosDistribuidos,
  atributosValkaria,
  VALKARIA,
  pointBuyCost,
  validatePointBuy,
} from "../rules/atributos.js";
import { prepareNivelContext } from "./steps/nivel.js";
import { prepareAtributosContext } from "./steps/atributos.js";
import { prepareRacaContext } from "./steps/raca.js";
import { prepareOrigemContext } from "./steps/origem.js";
import { prepareClasseContext } from "./steps/classe.js";
import { preparePericiaContext } from "./steps/pericias.js";
import { getRaceSkillBonus } from "../rules/raca.js";
import { totaisRaciaisDoEstado, distribuirAbertos, valoresFixosDaRaca } from "../rules/subescolhas.js";
import { toSlug, toNomeSlug } from "../compendium/slug.js";
import { lerConfig, resumoConfig } from "../config/config.js";
import { listMetodos } from "../rules/atributos.js";
import { nivelEfetivo, faixaDoPersonagem } from "../rules/idade.js";
import { prepareIdadeContext } from "./steps/idade.js";
import { openConfigApp } from "../config/app.js";

/** Final Int = base + racial (fixed + chosen). Drives the perícia Int bonus. */
function finalInt(state: WizardState): number {
  return (state.atributosBase.int ?? 0) + (totaisRaciaisDoEstado(state).int ?? 0);
}

/** Regras da mesa entram no estado ao abrir; método travado já vai aplicado. */
function aplicarConfig(state: WizardState): void {
  const config = lerConfig();
  const patch: Record<string, unknown> = { config };
  if (config.metodoAtributos !== "livre" && state.metodoAtributos !== config.metodoAtributos) {
    patch["metodoAtributos"] = config.metodoAtributos;
    patch["atributosBase"] = { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  }
  state.apply(patch as Parameters<WizardState["apply"]>[0]);
}
import { prepareDivindadeContext } from "./steps/divindade.js";
import { preparePoderesContext } from "./steps/poderes.js";
import { prepareMagiasContext } from "./steps/magias.js";
import { prepareEquipamentoContext } from "./steps/equipamento.js";
import { prepareRevisaoContext } from "./steps/revisao.js";
import { ActorWriter } from "../actor/writer.js";
import { pendencias, type EngineState } from "../rules/engine.js";
import type {
  IndexedClasse,
  IndexedRace,
  IndexedPoder,
  IndexedMagia,
} from "../compendium/types.js";

const TPL = (name: string) => `modules/${MODULE_ID}/templates/wizard/${name}.hbs`;

/**
 * WizardApp must NOT extend Foundry globals at module top-level.
 * ApplicationV2 / HandlebarsApplicationMixin don't exist until after Foundry's
 * own scripts have loaded — which happens inside (or after) the "init" hook.
 *
 * Pattern: call defineWizardApp() inside Hooks.once("init", ...) in module.ts.
 * Then openWizard() can safely create instances.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _WizardAppClass: any = null;
let _instance: unknown = null;

export function defineWizardApp(): void {
  if (_WizardAppClass) return; // idempotent

  // In Foundry v13 these live in foundry.applications.api, not as bare globals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AppV2 = (foundry as any).applications.api.ApplicationV2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HbsMixin = (foundry as any).applications.api.HandlebarsApplicationMixin;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _WizardAppClass = class WizardApp extends HbsMixin(AppV2) {
    static DEFAULT_OPTIONS = {
      id: "t20w-wizard",
      window: { title: "T20W: Criar Personagem" },
      position: { width: 720, height: 600 },
    };

    // Single PART — avoids @partial-block / sibling-PART layout issues
    static PARTS = {
      // Listas longas guardam o scroll entre renders — marcar uma magia no fim
      // da lista devolvia a lista ao topo a cada clique.
      wizard: { template: TPL("wizard"), scrollable: [".t20w-scroll"] },
    };

    _state = new WizardState();
    _currentStep: WizardStep = WizardStep.Nivel;
    _errors: string[] = [];

    /**
     * Guarda o rascunho numa flag do usuário para sobreviver a F5.
     * Falha em silêncio: perder o rascunho é chato, travar o wizard é pior.
     */
    _salvarRascunho(): void {
      try {
        rascunho.gravar({ estado: this._state.serialize(), passo: this._currentStep });
      } catch (err) {
        console.warn(`${MODULE_ID} | não consegui salvar o rascunho:`, err);
      }
    }

    /** Passos válidos para a classe escolhida (lutador não vê Magias). */
    _passos(): WizardStep[] {
      return passosAplicaveis(
        toNomeSlug(this._state.classeNome ?? ""),
        slugsDosPoderes(this._state.poderes),
        this._state.config
      );
    }

    goToStep(step: WizardStep): void {
      this._currentStep = step;
      this._errors = [];
      this.render();
    }

    async nextStep(): Promise<void> {
      if (this._currentStep === WizardStep.Equipamento) {
        const equipCtx = prepareEquipamentoContext(this._state, CompendiumIndex.equipamentos(), []);
        const erros: string[] = [];
        if (!equipCtx.dinheiroOk) erros.push("Você excedeu o orçamento disponível. Remova itens do carrinho.");
        if (equipCtx.escolhasPendentes) erros.push("Escolha os itens iniciais que faltam.");
        if (erros.length) {
          this._errors = erros;
          this.render();
          return;
        }
      }

      const result = validate(this._currentStep, this._state as Parameters<typeof validate>[1]);
      if (!result.valid) {
        this._errors = result.errors;
        this.render();
        return;
      }
      const passos = this._passos();
      const idx = passos.indexOf(this._currentStep);
      if (idx < passos.length - 1) {
        this._currentStep = passos[idx + 1]!;
        this._errors = [];
        this.render();
      }
    }

    prevStep(): void {
      const passos = this._passos();
      const idx = passos.indexOf(this._currentStep);
      if (idx > 0) {
        this._currentStep = passos[idx - 1]!;
        this._errors = [];
        this.render();
      }
    }

    applyFormData(formData: FormData): void {
      const nivel = parseInt((formData.get("nivel") as string) ?? "1", 10);
      const nome = ((formData.get("nome") as string) ?? "").trim();
      const metodoAtributos =
        (formData.get("metodoAtributos") as string) ?? this._state.metodoAtributos;
      const racaId = (formData.get("racaId") as string) ?? this._state.racaId;
      const origemId = (formData.get("origemId") as string) ?? this._state.origemId;
      const classeId = (formData.get("classeId") as string) ?? this._state.classeId;
      const divindadeId = (formData.get("divindadeId") as string) ?? this._state.divindadeId;

      const atributosBase = { ...this._state.atributosBase };
      for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
        const v = formData.get(`attr-${attr}`);
        if (v !== null) atributosBase[attr] = parseInt(v as string, 10);
      }

      // Canonical perícia picks → escolhasPorItem.pericias (4 buckets).
      const perObrig: string[][] = [];
      const perEsc: string[] = [];
      const perInt: string[] = [];
      const perRaca: string[] = [];
      let sawPericia = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [key, value] of (formData as any).entries()) {
        const k = key as string;
        const v = value as string;
        const mo = /^per_obrig-(\d+)$/.exec(k);
        if (mo) {
          sawPericia = true;
          (perObrig[parseInt(mo[1], 10)] ??= []).push(v);
        } else if (k.startsWith("per_esc-")) {
          sawPericia = true;
          perEsc.push(k.replace("per_esc-", ""));
        } else if (k.startsWith("per_int-")) {
          sawPericia = true;
          perInt.push(k.replace("per_int-", ""));
        } else if (k.startsWith("per_raca-")) {
          sawPericia = true;
          perRaca.push(k.replace("per_raca-", ""));
        }
      }

      const poderes: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [key] of (formData as any).entries()) {
        if ((key as string).startsWith("poder-")) {
          poderes.push((key as string).replace("poder-", ""));
        }
      }

      const magias: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [key] of (formData as any).entries()) {
        if ((key as string).startsWith("magia-")) {
          magias.push((key as string).replace("magia-", ""));
        }
      }

      // Race choosable modifiers: name="raca_mod-{group}-{slot}" → string[][]
      const racaMod: string[][] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [key, value] of (formData as any).entries()) {
        const m = /^raca_mod-(\d+)-(\d+)$/.exec(key as string);
        if (!m) continue;
        const g = parseInt(m[1], 10);
        const s = parseInt(m[2], 10);
        const v = (value as string) ?? "";
        if (v) {
          (racaMod[g] ??= [])[s] = v;
        }
      }

      const patch: Record<string, unknown> = { atributosBase };
      let escolhas: Record<string, unknown> | null = null;
      if (formData.has("racaId") || racaMod.length > 0) {
        // Normalize sparse arrays (skipped empty slots) to dense arrays.
        const normalized = racaMod.map((grp) => (grp ?? []).filter((x) => x));
        escolhas = { ...(escolhas ?? this._state.escolhasPorItem), raca_modificadores: normalized };
      }
      if (sawPericia) {
        escolhas = {
          ...(escolhas ?? this._state.escolhasPorItem),
          pericias: {
            obrigatorias: perObrig.map((g) => (g ?? []).filter(Boolean)),
            escolhas: perEsc,
            extras_int: perInt,
            raca: perRaca,
          },
        };
      }
      if (escolhas) patch["escolhasPorItem"] = escolhas;
      if (formData.has("nivel")) {
        // O campo é o nível do GRUPO; maduro/velho/ancião jogam acima dele (HA p.289).
        const esc = { ...((patch["escolhasPorItem"] as Record<string, unknown> | undefined) ?? this._state.escolhasPorItem) };
        esc["nivel_grupo"] = nivel;
        patch["escolhasPorItem"] = esc;
        patch["nivel"] = nivelEfetivo(nivel, { config: this._state.config, escolhasPorItem: esc });
      }
      if (formData.has("nome")) patch["nome"] = nome;
      if (formData.has("metodoAtributos")) patch["metodoAtributos"] = metodoAtributos;
      if (formData.has("racaId")) {
        patch["racaId"] = racaId;
        const racaItem = CompendiumIndex.getAll("race").find((r) => r.id === racaId);
        patch["racaNome"] = racaItem?.name ?? "";
      }
      if (formData.has("origemId")) patch["origemId"] = origemId;
      if (formData.has("classeId")) {
        patch["classeId"] = classeId;
        const classeItem = CompendiumIndex.getAll("classe").find((c) => c.id === classeId);
        patch["classeNome"] = classeItem?.name ?? "";
      }
      if (formData.has("divindadeId")) patch["divindadeId"] = divindadeId;
      const classeCaminho = formData.get("classe_caminho") as string | null;
      if (classeCaminho) {
        patch["escolhasPorItem"] = {
          ...(patch["escolhasPorItem"] as Record<string, unknown> ?? this._state.escolhasPorItem),
          classe_caminho: classeCaminho,
        };
      }
      // Checkbox desmarcada não aparece no FormData, então "lista vazia" e "passo
      // não estava na tela" ficavam iguais — desmarcar tudo nunca limpava o estado.
      // O input escondido do passo distingue os dois casos.
      if (formData.has("passo_poderes")) patch["poderes"] = poderes;
      if (formData.has("passo_magias")) patch["magias"] = magias;

      this._state.apply(patch as Parameters<typeof this._state.apply>[0]);
    }

    async _prepareContext(_options: unknown): Promise<unknown> {
      const step = this._currentStep;
      const state = this._state;
      // Cada passo acrescenta o que ele mesmo detecta ao que veio da navegação;
      // sem dedupe a mesma frase aparecia repetida a cada render.
      const errors = [...new Set(this._errors)];

      const passos = this._passos();
      const stepIdx = passos.indexOf(step);
      const steps = passos.map((s, i) => ({
        id: s,
        label: STEP_META[s].labelKey,
        active: s === step,
        done: i < stepIdx,
        reachable: i <= stepIdx,
      }));

      let stepCtx: unknown = {};
      switch (step) {
        case WizardStep.Nivel:
          stepCtx = prepareNivelContext(state, errors);
          break;
        case WizardStep.Atributos:
          stepCtx = prepareAtributosContext(state, errors);
          break;
        case WizardStep.Raca: {
          const racas = CompendiumIndex.getAll("race") as IndexedRace[];
          const poderesRaca = CompendiumIndex.getAll("poder") as IndexedPoder[];
          stepCtx = prepareRacaContext(
            state,
            racas,
            errors,
            poderesRaca,
            CompendiumIndex.getAll("magia")
          );
          break;
        }
        case WizardStep.Idade:
          stepCtx = prepareIdadeContext(state, CompendiumIndex.getAll("poder") as IndexedPoder[], errors);
          break;
        case WizardStep.Origem: {
          const poderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
          const resolvePoderNome = (slug: string): string | null =>
            poderes.find((p) => toSlug(p.name) === slug)?.name ?? null;
          stepCtx = prepareOrigemContext(state, errors, resolvePoderNome, poderes);
          break;
        }
        case WizardStep.Classe: {
          const classes = CompendiumIndex.getAll("classe") as IndexedClasse[];
          const allPoderesClasse = CompendiumIndex.getAll("poder");
          const resolvePoderNomeClasse = (slug: string): string | null =>
            allPoderesClasse.find((p) => toNomeSlug(p.name) === slug)?.name ?? null;
          stepCtx = prepareClasseContext(state, classes, errors, resolvePoderNomeClasse);
          break;
        }
        case WizardStep.Pericias: {
          const intFinal = finalInt(state);
          const racaBonus = getRaceSkillBonus(state.racaNome || state.racaId);
          stepCtx = preparePericiaContext(state, intFinal, racaBonus, errors);
          break;
        }
        case WizardStep.Divindade: {
          const divPoderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
          const resolvePoderNome = (slug: string): string | null =>
            divPoderes.find((p) => toSlug(p.name) === slug)?.name ?? null;
          stepCtx = prepareDivindadeContext(state, errors, resolvePoderNome);
          break;
        }
        case WizardStep.Poderes: {
          const poderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
          const resolvePoderNomePoderes = (slug: string): string | null =>
            poderes.find((p) => toNomeSlug(p.name) === slug)?.name ?? null;
          stepCtx = preparePoderesContext(
            state,
            poderes,
            errors,
            resolvePoderNomePoderes,
            CompendiumIndex.getAll("magia")
          );
          break;
        }
        case WizardStep.Magias: {
          const magias = CompendiumIndex.getAll("magia") as IndexedMagia[];
          let ctx = prepareMagiasContext(state, magias, errors);
          // Trocou classe/escola/nível? Magia que não vale mais sai do estado
          // aqui, sem esperar o clique em Próximo.
          const validas = new Set(ctx.idsValidos);
          if (state.magias.some((id) => !validas.has(id))) {
            state.apply({ magias: state.magias.filter((id) => validas.has(id)) });
            ctx = prepareMagiasContext(state, magias, errors);
          }
          stepCtx = ctx;
          break;
        }
        case WizardStep.Equipamento: {
          // T$ 4d6 (e dado da origem) rola sozinho na primeira vez que o passo abre.
          let ctx = prepareEquipamentoContext(state, CompendiumIndex.equipamentos(), errors);
          if (ctx.formulasPendentes.length) {
            let total = 0;
            for (const f of ctx.formulasPendentes) {
              // @ts-expect-error Roll is a Foundry global
              total += ((await new Roll(f).roll({ async: true })) as { total: number }).total;
            }
            state.apply({ escolhasPorItem: { ...state.escolhasPorItem, dinheiro_rolado: total } });
            ctx = prepareEquipamentoContext(state, CompendiumIndex.equipamentos(), errors);
          }
          stepCtx = ctx;
          break;
        }
        case WizardStep.Revisao: {
          const racaItem = CompendiumIndex.getAll("race").find((r) => r.id === state.racaId);
          const classeItem = CompendiumIndex.getAll("classe").find((c) => c.id === state.classeId);
          const equipRev = prepareEquipamentoContext(state, CompendiumIndex.equipamentos());
          stepCtx = prepareRevisaoContext(
            state,
            racaItem?.name ?? state.racaId,
            classeItem?.name ?? state.classeId,
            errors,
            equipRev.dinheiroRestante,
            (id) => CompendiumIndex.getById("poder", id)?.name
          );
          break;
        }
      }

      return {
        currentStep: step,
        steps,
        showBack: stepIdx > 0,
        showNext: stepIdx < passos.length - 1,
        showCreate: stepIdx === passos.length - 1,
        passoNumero: stepIdx + 1,
        passoTotal: passos.length,
        // Boolean switches for wizard.hbs single-template approach
        showNivel: step === WizardStep.Nivel,
        showAtributos: step === WizardStep.Atributos,
        showRaca: step === WizardStep.Raca,
        showIdade: step === WizardStep.Idade,
        regrasDaMesa: resumoConfig(state.config, (id) => listMetodos().find((m) => m.id === id)?.nome ?? id),
        nivelGrupo: (state.escolhasPorItem["nivel_grupo"] as number | undefined) ?? state.nivel,
        nivelExtra: state.nivel - ((state.escolhasPorItem["nivel_grupo"] as number | undefined) ?? state.nivel),
        showOrigem: step === WizardStep.Origem,
        showClasse: step === WizardStep.Classe,
        showPericias: step === WizardStep.Pericias,
        showDivindade: step === WizardStep.Divindade,
        showPoderes: step === WizardStep.Poderes,
        showMagias: step === WizardStep.Magias,
        showEquipamento: step === WizardStep.Equipamento,
        showRevisao: step === WizardStep.Revisao,
        ...(stepCtx as object),
        // Cada passo soma o que ele detecta ao que veio da navegação, então a
        // mesma frase chegava pelos dois caminhos e aparecia repetida.
        errors: [...new Set((stepCtx as { errors?: string[] }).errors ?? errors)],
      };
    }

    async _onRender(_context: unknown, _options: unknown): Promise<void> {
      // Todo estado que vale a pena passa por um render — salvar aqui cobre tudo.
      this._salvarRascunho();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const root = (this as any).element as HTMLElement;

      // ── Compra de pontos: número digitado entra no estado na hora ──────
      // Sem re-render: o blur do input já disparava o render e engolia o clique
      // no botão +/− ao lado. Atualiza custo e saldo direto no DOM.
      const atualizarCompra = () => {
        this.applyFormData(this._gatherFormData());
        root.querySelectorAll<HTMLInputElement>("[name^='attr-']").forEach((inp) => {
          const span = inp.parentElement?.querySelector(".t20w-custo");
          if (!span) return;
          try {
            span.textContent = `custo: ${pointBuyCost(Number(inp.value))}`;
          } catch {
            span.textContent = "custo: ?";
          }
        });
        const rest = root.querySelector<HTMLElement>("#t20w-pontos-restantes");
        if (rest) {
          const r = validatePointBuy(this._state.atributosBase);
          rest.textContent = String(r.remaining);
          rest.classList.toggle("t20w-over", r.remaining < 0);
        }
      };
      root.querySelectorAll<HTMLInputElement>("[name^='attr-']").forEach((inp) => {
        inp.addEventListener("input", atualizarCompra);
      });

      // ── Distribuição dos valores rolados (LB p.17 "distribua como quiser") ──
      root.querySelectorAll<HTMLSelectElement>("select.t20w-dist").forEach((sel) => {
        sel.addEventListener("change", () => {
          const attr = sel.name.replace("dist-", "") as Atributo;
          const esc = this._state.escolhasPorItem;
          const dist: Distribuicao = { ...((esc["atributos_dist"] as Distribuicao) ?? {}) };
          const novo = sel.value === "" ? undefined : Number(sel.value);
          // Valor já usado por outro atributo? Troca os dois em vez de duplicar.
          const dono = ATRIBUTOS.find((a) => a !== attr && novo !== undefined && dist[a] === novo);
          if (dono) dist[dono] = dist[attr];
          dist[attr] = novo;
          const pool = valoresFixos(this._state.metodoAtributos) ?? ((esc["atributos_pool"] as number[]) ?? []);
          this._state.apply({
            escolhasPorItem: { ...esc, atributos_dist: dist },
            atributosBase: atributosDistribuidos(pool, dist),
          });
          void this.render();
        });
      });

      // ── Valkaria: cada dado vai para um atributo ──────────────────────
      root.querySelectorAll<HTMLSelectElement>("select.t20w-vdado").forEach((sel) => {
        sel.addEventListener("change", () => {
          const esc = this._state.escolhasPorItem;
          const dados = (esc["valkaria_dados"] as number[]) ?? [];
          const dist = [...(((esc["valkaria_dist"] as Array<Atributo | undefined>) ?? []))];
          dist[Number(sel.name.replace("vdado-", ""))] = (sel.value || undefined) as Atributo | undefined;
          this._state.apply({
            escolhasPorItem: { ...esc, valkaria_dist: dist },
            atributosBase: atributosValkaria(dados, dist),
          });
          void this.render();
        });
      });

      // ── Method select → reset atributosBase + re-render ───────────────
      const sel = root.querySelector<HTMLSelectElement>("[name='metodoAtributos']");
      if (sel) {
        sel.addEventListener("change", () => {
          // NÃO reaproveitar o formulário aqui: ele ainda tem os valores do método
          // anterior, e reaplicá-los deixava um 14 rolado dentro da compra de pontos.
          const esc = { ...this._state.escolhasPorItem };
          for (const k of ["atributos_pool", "atributos_dist", "valkaria_dados", "valkaria_dist"]) delete esc[k];
          this._state.apply({
            metodoAtributos: sel.value,
            atributosBase: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
            escolhasPorItem: esc,
          });
          this.render();
        });
      }

      // ── Péricias checkbox limit enforcement ────────────────────────────
      const enforceCheckboxGroup = (groupEl: HTMLElement, max: number) => {
        const checkboxes = groupEl.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
        const enforce = () => {
          const checked = Array.from(checkboxes).filter((c) => c.checked);
          const atLimit = checked.length >= max;
          checkboxes.forEach((cb) => {
            if (!cb.checked) {
              cb.disabled = atLimit;
              const lbl = cb.closest("label");
              if (lbl) lbl.style.opacity = atLimit ? "0.45" : "";
            } else {
              cb.disabled = false;
              const lbl = cb.closest("label");
              if (lbl) lbl.style.opacity = "";
            }
          });
        };
        enforce();
        checkboxes.forEach((cb) => cb.addEventListener("change", enforce));
      };

      root.querySelectorAll<HTMLElement>(".t20w-pcheck-group").forEach((grp) => {
        const max = parseInt(grp.dataset["max"] ?? "999", 10);
        enforceCheckboxGroup(grp, max);
      });

      // ── Select dropdowns → re-render on change to show detail card ──────
      for (const name of ["racaId", "origemId", "classeId"]) {
        const dropdown = root.querySelector<HTMLSelectElement>(`[name="${name}"]`);
        if (dropdown) {
          dropdown.addEventListener("change", () => {
            this.applyFormData(this._gatherFormData());
            this.render();
          });
        }
      }
      // Divindade select — also clears conceded power pick
      const divDropdown = root.querySelector<HTMLSelectElement>(`[name="divindadeId"]`);
      if (divDropdown) {
        divDropdown.addEventListener("change", () => {
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, divindade_poderes: [] },
          });
          this.applyFormData(this._gatherFormData());
          this.render();
        });
      }

      // ── Divindade: marcar os poderes concedidos ─────────────────────────
      const poderesDiv = root.querySelectorAll<HTMLInputElement>(
        "input[name='divindade_poder']"
      );
      poderesDiv.forEach((caixa) => {
        caixa.addEventListener("change", () => {
          const marcados = Array.from(poderesDiv)
            .filter((c) => c.checked)
            .map((c) => c.value);
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, divindade_poderes: marcados },
          });
          this._errors = [];
          void this.render();
        });
      });

      // ── Origem: marcar 2 benefícios (perícia e/ou poder) ────────────────
      const beneficios = root.querySelectorAll<HTMLInputElement>("[name='origem_beneficio']");
      beneficios.forEach((chk) => {
        chk.addEventListener("change", () => {
          const marcados = Array.from(beneficios)
            .filter((c) => c.checked)
            .map((c) => c.value);
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, origem_beneficios: marcados },
          });
          this._errors = [];
          void this.render();
        });
      });

      // ── Escolhas de habilidade racial (Memória Póstuma, Deformidade…) ────
      root
        .querySelectorAll<HTMLSelectElement | HTMLInputElement>(
          "select[name^='raca_esc-'], input[name^='raca_esc-']"
        )
        .forEach((sel) => {
          sel.addEventListener("change", () => {
            const chave = sel.name.replace("raca_esc-", "");
            const novas = { ...this._state.escolhasPorItem, [chave]: sel.value };
            // Trocar de ramo invalida as respostas do ramo anterior.
            if (chave.endsWith("_ramo")) {
              const prefixo = chave.replace(/_ramo$/, "");
              for (const k of Object.keys(novas)) {
                if (k.startsWith(`${prefixo}_`) && k !== chave) delete novas[k];
              }
            }
            this._state.apply({ escolhasPorItem: novas });
            this._errors = [];
            void this.render();
          });
        });

      // ── Poder livre da origem ───────────────────────────────────────────
      root.querySelectorAll<HTMLSelectElement>("select[name='origem_poder_livre']").forEach((sel) => {
        sel.addEventListener("change", () => {
          const categoria = sel.dataset["categoria"];
          if (!categoria) return;
          this._state.apply({
            escolhasPorItem: {
              ...this._state.escolhasPorItem,
              [`origem_poder_livre_${categoria}`]: sel.value,
            },
          });
          this._errors = [];
          void this.render();
        });
      });

      // ── Campo de busca em cima de cada dropdown longo ───────────────────
      root.querySelectorAll<HTMLSelectElement>("select").forEach((sel) => {
        if (sel.options.length < 8 || sel.dataset["busca"] === "pronto") return;
        sel.dataset["busca"] = "pronto";

        const todas = Array.from(sel.options).map((o) => ({
          value: o.value,
          text: o.text,
          selected: o.selected,
        }));

        const busca = document.createElement("input");
        busca.type = "text";
        busca.placeholder = "Filtrar…";
        busca.className = "t20w-busca-select";
        sel.parentElement?.insertBefore(busca, sel);

        busca.addEventListener("input", () => {
          const termo = busca.value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "");
          const atual = sel.value;
          sel.replaceChildren();
          for (const o of todas) {
            const limpo = o.text
              .toLowerCase()
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "");
            // A opção vazia e a escolhida ficam sempre, senão o select perde o valor.
            if (termo && o.value && o.value !== atual && !limpo.includes(termo)) continue;
            const opt = document.createElement("option");
            opt.value = o.value;
            opt.text = o.text;
            opt.selected = o.value === atual;
            sel.appendChild(opt);
          }
        });
        // Enter no filtro não deve submeter o formulário do wizard.
        busca.addEventListener("keydown", (e) => {
          if (e.key === "Enter") e.preventDefault();
        });
      });

      // ── Atributos escolhíveis da raça: re-render tira o já usado das outras ──
      root.querySelectorAll<HTMLSelectElement>("select[name^='raca_mod-']").forEach((sel) => {
        sel.addEventListener("change", () => {
          this.applyFormData(this._gatherFormData());
          void this.render();
        });
      });

      // ── Poderes e magias: marcar já reflete no contador e na elegibilidade ──
      // Sem isto o estado só era lido ao trocar de passo: o contador ficava em
      // 0/3 com três marcadas, e o Poder B não liberava ao escolher o Poder A.
      const sincronizarEscolhas = (prefixo: "poder-" | "magia-", campo: "poderes" | "magias") => {
        const caixas = root.querySelectorAll<HTMLInputElement>(`input[name^="${prefixo}"]`);
        caixas.forEach((caixa) => {
          caixa.addEventListener("change", () => {
            // Poder repetível (Orar ×2) tem o id N vezes no estado; a caixa
            // marcada mantém as cópias, desmarcar tira todas.
            const atual = this._state[campo] as string[];
            const marcados = Array.from(caixas)
              .filter((c) => c.checked)
              .flatMap((c) => {
                const n = atual.filter((id) => id === c.value).length;
                return Array(Math.max(1, n)).fill(c.value) as string[];
              });
            this._state.apply({ [campo]: marcados } as Parameters<typeof this._state.apply>[0]);
            this._errors = [];
            void this.render();
          });
        });
      };
      sincronizarEscolhas("poder-", "poderes");
      sincronizarEscolhas("magia-", "magias");

      // ── Escolas do bardo/druida ("Escolha três escolas de magia") ────────
      const caixasEscola = root.querySelectorAll<HTMLInputElement>('input[name^="escola-"]');
      caixasEscola.forEach((caixa) => {
        caixa.addEventListener("change", () => {
          const marcadas = Array.from(caixasEscola).filter((c) => c.checked).map((c) => c.value);
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, classe_escolas: marcadas },
          });
          this._errors = [];
          void this.render();
        });
      });

      // ── Idade & Complicações (HA cap. 4) ──────────────────────────────────
      const salvarEscolha = (chave: string, valor: unknown) => {
        const esc = { ...this._state.escolhasPorItem, [chave]: valor };
        // Sem nível do grupo gravado (estado antigo), deduz do nível atual menos
        // os extras da faixa em vigor — senão cada troca de faixa somava de novo.
        const grupo =
          (esc["nivel_grupo"] as number | undefined) ??
          Math.max(1, this._state.nivel - faixaDoPersonagem(this._state).niveisExtras);
        esc["nivel_grupo"] = grupo;
        this._state.apply({
          escolhasPorItem: esc,
          nivel: nivelEfetivo(grupo, { config: this._state.config, escolhasPorItem: esc }),
        });
        this._errors = [];
        void this.render();
      };
      root.querySelectorAll<HTMLInputElement>('input[name="idade_faixa"]').forEach((r) => {
        r.addEventListener("change", () => salvarEscolha("idade_faixa", r.value));
      });
      root.querySelector<HTMLInputElement>('input[name="idade_ja_vi_coisas"]')?.addEventListener("change", (e) => {
        salvarEscolha("idade_ja_vi_coisas", (e.target as HTMLInputElement).checked);
      });
      const caixasCompl = root.querySelectorAll<HTMLInputElement>('input[name^="compl_idade-"]');
      caixasCompl.forEach((c) => {
        c.addEventListener("change", () => {
          salvarEscolha("complicacoes_idade", Array.from(caixasCompl).filter((x) => x.checked).map((x) => x.value));
        });
      });
      root.querySelector<HTMLSelectElement>('select[name="complicacao"]')?.addEventListener("change", (e) => {
        salvarEscolha("complicacao", (e.target as HTMLSelectElement).value);
      });

      // ── Raças Abertas: cada modificador fixo vai para um atributo ─────────
      root.querySelectorAll<HTMLSelectElement>("select.t20w-raca-aberta").forEach((sel) => {
        sel.addEventListener("change", () => {
          const idx = sel.dataset["idx"]!;
          const dist = { ...((this._state.escolhasPorItem["raca_aberta"] as Record<string, string>) ?? {}) };
          // Atributo já usado por outro valor? Troca em vez de duplicar.
          const dono = Object.keys(dist).find((k) => k !== idx && sel.value && dist[k] === sel.value);
          if (dono) dist[dono] = dist[idx] ?? "";
          dist[idx] = sel.value;
          this._state.apply({ escolhasPorItem: { ...this._state.escolhasPorItem, raca_aberta: dist } });
          this._errors = [];
          void this.render();
        });
      });

      // ── Sub-escolhas dependentes do caminho (linhagem, tipo de dano) ─────
      root.querySelectorAll<HTMLSelectElement>("select[name='subescolha']").forEach((sel) => {
        sel.addEventListener("change", () => {
          const chave = sel.dataset["chave"];
          if (!chave) return;
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, [chave]: sel.value },
          });
          this._errors = [];
          void this.render();
        });
      });

      // ── Caminho radios → save + re-render ────────────────────────────────
      const caminhoInputs = root.querySelectorAll<HTMLInputElement>('input[name="classe_caminho"]');
      caminhoInputs.forEach((inp) => {
        inp.addEventListener("change", () => {
          this._state.apply({
            escolhasPorItem: {
              ...this._state.escolhasPorItem,
              classe_caminho: inp.value,
            },
          });
          void this.render();
        });
      });

      // ── Poder search + category filter ──────────────────────────────────
      const poderSearch = root.querySelector<HTMLInputElement>("#t20w-poder-search");
      const poderCat = root.querySelector<HTMLSelectElement>("#t20w-poder-cat");
      const applyPoderFilter = () => {
        const q = (poderSearch?.value ?? "").toLowerCase();
        const cat = poderCat?.value ?? "";
        root.querySelectorAll<HTMLElement>(".t20w-poder-row").forEach((item) => {
          const name = (item.dataset["poderName"] ?? "").toLowerCase();
          const c = item.dataset["poderCat"] ?? "";
          const matchName = name.includes(q);
          const matchCat = !cat || c === cat;
          item.style.display = matchName && matchCat ? "" : "none";
        });
      };
      if (poderSearch) poderSearch.addEventListener("input", applyPoderFilter);
      if (poderCat) poderCat.addEventListener("change", applyPoderFilter);

      // ── Equip search ───────────────────────────────────────────────────
      // Itens iniciais com escolha (origem "X ou Y", arma simples do kit…).
      root.querySelectorAll<HTMLSelectElement>("select.t20w-item-inicial").forEach((sel) => {
        sel.addEventListener("change", () => {
          const chave = sel.dataset["chave"]!;
          const atual = { ...((this._state.escolhasPorItem["itens_iniciais"] as Record<string, string>) ?? {}) };
          atual[chave] = sel.value;
          // Trocou a opção de primeiro nível? A sub-escolha antiga não vale mais.
          if (!chave.endsWith("_item")) delete atual[`${chave}_item`];
          this._state.apply({ escolhasPorItem: { ...this._state.escolhasPorItem, itens_iniciais: atual } });
          void this.render();
        });
      });

      const equipSearch = root.querySelector<HTMLInputElement>("#t20w-equip-search");
      if (equipSearch) {
        equipSearch.addEventListener("input", (e) => {
          this._state.apply({
            escolhasPorItem: {
              ...this._state.escolhasPorItem,
              equip_search: (e.target as HTMLInputElement).value,
            },
          });
          void this.render();
        });
      }

      // ── Magia search ───────────────────────────────────────────────────
      const magiaSearch = root.querySelector<HTMLInputElement>("#t20w-magia-search");
      if (magiaSearch) {
        magiaSearch.addEventListener("input", (e) => {
          this._state.apply({
            escolhasPorItem: {
              ...this._state.escolhasPorItem,
              magia_search: (e.target as HTMLInputElement).value,
            },
          });
          void this.render();
        });
      }

      // ── Perícias live dedup — save picks + re-render on any change ──────
      const periciaInputs = root.querySelectorAll<HTMLInputElement>(
        'input[name^="per_esc-"], input[name^="per_int-"], input[name^="per_raca-"], input[name^="per_obrig-"]'
      );
      if (periciaInputs.length > 0) {
        periciaInputs.forEach((inp) => {
          inp.addEventListener("change", () => {
            this._savePericiasPicks(root);
            void this.render();
          });
        });
      }
    }

    /** Reads all pericias picks from current DOM and saves to state (for live dedup). */
    _savePericiasPicks(html: HTMLElement): void {
      const perObrig: string[][] = [];
      const perEsc: string[] = [];
      const perInt: string[] = [];
      const perRaca: string[] = [];

      html.querySelectorAll<HTMLInputElement>('input[type="radio"][name^="per_obrig-"]:checked').forEach((inp) => {
        const m = /^per_obrig-(\d+)$/.exec(inp.name);
        if (m) {
          const idx = parseInt(m[1], 10);
          (perObrig[idx] ??= []).push(inp.value);
        }
      });
      html.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="per_esc-"]:checked').forEach((inp) => {
        perEsc.push(inp.value);
      });
      html.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="per_int-"]:checked').forEach((inp) => {
        perInt.push(inp.value);
      });
      html.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="per_raca-"]:checked').forEach((inp) => {
        perRaca.push(inp.value);
      });

      this._state.apply({
        escolhasPorItem: {
          ...this._state.escolhasPorItem,
          pericias: {
            obrigatorias: perObrig.map((g) => (g ?? []).filter(Boolean)),
            escolhas: perEsc,
            extras_int: perInt,
            raca: perRaca,
          },
        },
      });
    }

    _gatherFormData(): FormData {
      const fd = new FormData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const root = (this as any).element as HTMLElement;
      root.querySelectorAll("input, select, textarea").forEach((el) => {
        const input = el as HTMLInputElement;
        if (!input.name) return;
        if (input.type === "checkbox" || input.type === "radio") {
          if (input.checked) fd.append(input.name, input.value);
        } else {
          fd.append(input.name, input.value);
        }
      });
      return fd;
    }

    async _onClickAction(event: MouseEvent, target: HTMLElement): Promise<void> {
      event.preventDefault();
      const action = target.dataset["action"];
      if (action === "next") {
        this.applyFormData(this._gatherFormData());
        void this.nextStep();
      } else if (action === "back") {
        this.applyFormData(this._gatherFormData());
        this.prevStep();
      } else if (action === "goStep") {
        const s = target.dataset["step"] as WizardStep;
        if (s) this.goToStep(s);
      } else if (action === "create") {
        const faltando = pendencias(this._state as unknown as EngineState);
        if (faltando.length > 0) {
          this._errors = faltando;
          this.render();
          return;
        }
        void ActorWriter.create(this._state).then(() => {
          rascunho.apagar();
          this.close();
        });
      } else if (action === "attrDec") {
        const attr = target.dataset["attr"] as string;
        if (!attr) return;
        this.applyFormData(this._gatherFormData());
        const min = -1;
        const current = this._state.atributosBase[attr as keyof typeof this._state.atributosBase] ?? 0;
        if (current > min) {
          this._state.apply({
            atributosBase: { ...this._state.atributosBase, [attr]: current - 1 },
          });
          void this.render();
        }
      } else if (action === "attrInc") {
        const attr = target.dataset["attr"] as string;
        if (!attr) return;
        this.applyFormData(this._gatherFormData());
        const max = 4;
        const current = this._state.atributosBase[attr as keyof typeof this._state.atributosBase] ?? 0;
        if (current < max) {
          this._state.apply({
            atributosBase: { ...this._state.atributosBase, [attr]: current + 1 },
          });
          void this.render();
        }
      } else if (action === "equipTab") {
        const categoria = target.dataset["categoria"];
        if (categoria) {
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, equip_categoria: categoria },
          });
          void this.render();
        }
      } else if (action === "abrirConfig") {
        openConfigApp();
      } else if (action === "poderMais" || action === "poderMenos") {
        const id = target.dataset["id"];
        if (!id) return;
        const lista = [...this._state.poderes];
        if (action === "poderMais") lista.push(id);
        else lista.splice(lista.lastIndexOf(id), 1);
        this._state.apply({ poderes: lista });
        this._errors = [];
        void this.render();
      } else if (action === "equipAdd" || action === "equipRemove" || action === "equipRemoveAll") {
        const id = target.dataset["id"];
        if (!id) return;
        const delta = action === "equipAdd" ? 1 : action === "equipRemove" ? -1 : -Infinity;
        const atual = this._state.equipamento.find((e) => e.itemId === id)?.qty ?? 0;
        const qty = Math.max(0, atual + delta);
        const semEle = this._state.equipamento.filter((e) => e.itemId !== id);
        this._state.apply({ equipamento: qty > 0 ? [...semEle, { itemId: id, qty }] : semEle });
        void this.render();
      } else if (action === "rollAtributos") {
        const metodo = this._state.metodoAtributos;
        const esc = { ...this._state.escolhasPorItem };
        const rolar = async (formula: string): Promise<number> => {
          // @ts-expect-error Roll is a Foundry global
          const roll = await new Roll(formula).roll({ async: true });
          return (roll as { total: number }).total;
        };

        if (metodo === "valkaria") {
          // HA p.281: 7d6, cada dado inteiro no atributo que o jogador quiser.
          const dados: number[] = [];
          for (let i = 0; i < VALKARIA.quantidade; i++) dados.push(await rolar(VALKARIA.formula));
          const dist: Array<Atributo | undefined> = [];
          this._state.apply({
            escolhasPorItem: { ...esc, valkaria_dados: dados, valkaria_dist: dist },
            atributosBase: atributosValkaria(dados, dist),
          });
          await this.render();
          return;
        }

        const espec = especRolagem(metodo);
        if (!espec) return;
        const totais: number[] = [];
        for (let i = 0; i < espec.quantidade; i++) totais.push(await rolar(espec.formula));
        let pool = poolDaRolagem(espec, totais);
        // "Caso seus atributos não somem pelo menos 6, role novamente o menor
        // valor. Repita até somarem 6 ou mais." (LB p.17)
        let guarda = 0;
        while (espec.somaMinima && precisaRerolar(pool) && guarda++ < 50) {
          pool = [...pool];
          pool[indiceDoMenor(pool)] = espec.converter(await rolar(espec.formula));
        }
        // Ordem rolada é o padrão; o jogador redistribui nos selects.
        const dist: Distribuicao = {};
        ATRIBUTOS.forEach((a, i) => { dist[a] = i; });
        this._state.apply({
          escolhasPorItem: { ...esc, atributos_pool: pool, atributos_dist: dist },
          atributosBase: atributosDistribuidos(pool, dist),
        });
        await this.render();
      }
    }
  };
}

/** Open (or re-focus) the wizard. Must call defineWizardApp() first (done in init hook). */
export function openWizard(): void {
  if (!_WizardAppClass) {
    console.error(
      `${MODULE_ID} | openWizard: WizardApp not defined yet — call defineWizardApp() in init`
    );
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst = _instance as any;
  if (!inst || !inst.rendered) {
    _instance = new _WizardAppClass();
    restaurarRascunho(_instance);
    aplicarConfig((_instance as any)._state as WizardState);
  }
  (_instance as any).render(true);
}

/** Retoma o rascunho salvo, se houver e se o usuário quiser. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function restaurarRascunho(app: any): void {
  let salvo: { estado?: string; passo?: WizardStep } | undefined;
  try {
    salvo = rascunho.ler();
  } catch {
    return;
  }
  if (!salvo?.estado) return;

  let estado: WizardState;
  try {
    estado = WizardState.deserialize(salvo.estado);
  } catch {
    rascunho.apagar();
    return;
  }

  const nome = estado.nome?.trim() || "sem nome";
  const retomar = window.confirm(
    `Você tem uma ficha em andamento ("${nome}"). Retomar de onde parou?

Cancelar começa do zero.`
  );
  if (!retomar) {
    rascunho.apagar();
    return;
  }
  app._state = estado;
  if (salvo.passo && STEP_ORDER.includes(salvo.passo)) app._currentStep = salvo.passo;
}
