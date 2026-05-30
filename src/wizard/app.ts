import { MODULE_ID } from "../constants.js";
import { WizardState } from "./state.js";
import { WizardStep, STEP_ORDER, STEP_META } from "../rules/steps.js";
import { CompendiumIndex } from "../compendium/index.js";
import { validate } from "../rules/engine.js";
import { prepareNivelContext } from "./steps/nivel.js";
import { prepareAtributosContext } from "./steps/atributos.js";
import { prepareRacaContext } from "./steps/raca.js";
import { prepareOrigemContext } from "./steps/origem.js";
import { prepareClasseContext } from "./steps/classe.js";
import { preparePericiaContext } from "./steps/pericias.js";
import { getRaceSkillBonus } from "../rules/raca.js";
import { toSlug } from "../compendium/slug.js";
import { prepareDivindadeContext } from "./steps/divindade.js";
import { preparePoderesContext } from "./steps/poderes.js";
import { prepareMagiasContext } from "./steps/magias.js";
import { prepareEquipamentoContext } from "./steps/equipamento.js";
import { prepareRevisaoContext } from "./steps/revisao.js";
import { ActorWriter } from "../actor/writer.js";
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
  // @ts-expect-error fvtt-types foundry.applications.api not fully typed for v13
  const AppV2 = foundry.applications.api.ApplicationV2;
  // @ts-expect-error fvtt-types foundry.applications.api not fully typed for v13
  const HbsMixin = foundry.applications.api.HandlebarsApplicationMixin;

  // @ts-expect-error class expression with dynamic base
  _WizardAppClass = class WizardApp extends HbsMixin(AppV2) {
    static DEFAULT_OPTIONS = {
      id: "t20w-wizard",
      window: { title: "T20W: Criar Personagem" },
      position: { width: 720, height: 600 },
    };

    // Single PART — avoids @partial-block / sibling-PART layout issues
    static PARTS = {
      wizard: { template: TPL("wizard") },
    };

    _state = new WizardState();
    _currentStep: WizardStep = WizardStep.Nivel;
    _errors: string[] = [];

    get state(): WizardState {
      return this._state;
    }

    goToStep(step: WizardStep): void {
      this._currentStep = step;
      this._errors = [];
      this.render();
    }

    async nextStep(): Promise<void> {
      const result = validate(this._currentStep, this._state as Parameters<typeof validate>[1]);
      if (!result.valid) {
        this._errors = result.errors;
        this.render();
        return;
      }
      const idx = STEP_ORDER.indexOf(this._currentStep);
      if (idx < STEP_ORDER.length - 1) {
        this._currentStep = STEP_ORDER[idx + 1];
        this._errors = [];
        this.render();
      }
    }

    prevStep(): void {
      const idx = STEP_ORDER.indexOf(this._currentStep);
      if (idx > 0) {
        this._currentStep = STEP_ORDER[idx - 1];
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

      const periciasTreinadas: string[] = [];
      for (const [key] of formData.entries()) {
        if ((key as string).startsWith("pericia-")) {
          periciasTreinadas.push((key as string).replace("pericia-", ""));
        }
      }

      const poderes: string[] = [];
      for (const [key] of formData.entries()) {
        if ((key as string).startsWith("poder-")) {
          poderes.push((key as string).replace("poder-", ""));
        }
      }

      const magias: string[] = [];
      for (const [key] of formData.entries()) {
        if ((key as string).startsWith("magia-")) {
          magias.push((key as string).replace("magia-", ""));
        }
      }

      const patch: Record<string, unknown> = { atributosBase };
      if (formData.has("nivel")) patch["nivel"] = nivel;
      if (formData.has("nome")) patch["nome"] = nome;
      if (formData.has("metodoAtributos")) patch["metodoAtributos"] = metodoAtributos;
      if (formData.has("racaId")) {
        patch["racaId"] = racaId;
        const racaItem = CompendiumIndex.getAll("race").find((r) => r.id === racaId);
        patch["racaNome"] = racaItem?.name ?? "";
      }
      if (formData.has("origemId")) patch["origemId"] = origemId;
      if (formData.has("classeId")) patch["classeId"] = classeId;
      if (formData.has("divindadeId")) patch["divindadeId"] = divindadeId;
      if (periciasTreinadas.length > 0) patch["periciasTreinadas"] = periciasTreinadas;
      if (poderes.length > 0) patch["poderes"] = poderes;
      if (magias.length > 0) patch["magias"] = magias;

      this._state.apply(patch as Parameters<typeof this._state.apply>[0]);
    }

    async _prepareContext(_options: unknown): Promise<unknown> {
      const step = this._currentStep;
      const state = this._state;
      const errors = this._errors;

      const stepIdx = STEP_ORDER.indexOf(step);
      const steps = STEP_ORDER.map((s, i) => ({
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
          stepCtx = prepareRacaContext(state, racas, errors);
          break;
        }
        case WizardStep.Origem: {
          const poderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
          const resolvePoderNome = (slug: string): string | null =>
            poderes.find((p) => toSlug(p.name) === slug)?.name ?? null;
          stepCtx = prepareOrigemContext(state, errors, resolvePoderNome);
          break;
        }
        case WizardStep.Classe: {
          const classes = CompendiumIndex.getAll("classe") as IndexedClasse[];
          stepCtx = prepareClasseContext(state, classes, errors);
          break;
        }
        case WizardStep.Pericias: {
          const classe = CompendiumIndex.getAll("classe").find((c) => c.id === state.classeId) as
            | IndexedClasse
            | undefined;
          const intMod = state.atributosBase.int ?? 0;
          const racialBonus = getRaceSkillBonus(state.racaNome || state.racaId);
          stepCtx = preparePericiaContext(state, classe, intMod, errors, racialBonus);
          break;
        }
        case WizardStep.Divindade:
          stepCtx = prepareDivindadeContext(state, errors);
          break;
        case WizardStep.Poderes: {
          const poderes = CompendiumIndex.getAll("poder") as IndexedPoder[];
          stepCtx = preparePoderesContext(state, poderes, errors);
          break;
        }
        case WizardStep.Magias: {
          const magias = CompendiumIndex.getAll("magia") as IndexedMagia[];
          stepCtx = prepareMagiasContext(state, magias, errors);
          break;
        }
        case WizardStep.Equipamento: {
          const allEquip = [
            ...CompendiumIndex.getAll("equipamento"),
            ...CompendiumIndex.getAll("arma"),
            ...CompendiumIndex.getAll("consumivel"),
          ];
          stepCtx = prepareEquipamentoContext(state, allEquip, errors);
          break;
        }
        case WizardStep.Revisao: {
          const racaItem = CompendiumIndex.getAll("race").find((r) => r.id === state.racaId);
          const classeItem = CompendiumIndex.getAll("classe").find((c) => c.id === state.classeId);
          stepCtx = prepareRevisaoContext(
            state,
            racaItem?.name ?? state.racaId,
            classeItem?.name ?? state.classeId,
            errors
          );
          break;
        }
      }

      return {
        currentStep: step,
        steps,
        showBack: stepIdx > 0,
        showNext: stepIdx < STEP_ORDER.length - 1,
        showCreate: stepIdx === STEP_ORDER.length - 1,
        // Boolean switches for wizard.hbs single-template approach
        showNivel: step === WizardStep.Nivel,
        showAtributos: step === WizardStep.Atributos,
        showRaca: step === WizardStep.Raca,
        showOrigem: step === WizardStep.Origem,
        showClasse: step === WizardStep.Classe,
        showPericias: step === WizardStep.Pericias,
        showDivindade: step === WizardStep.Divindade,
        showPoderes: step === WizardStep.Poderes,
        showMagias: step === WizardStep.Magias,
        showEquipamento: step === WizardStep.Equipamento,
        showRevisao: step === WizardStep.Revisao,
        ...(stepCtx as object),
      };
    }

    _onRender(_context: unknown, _options: unknown): void {
      // @ts-expect-error element not typed
      const root = this.element as HTMLElement;

      // ── Dynamic point buy ──────────────────────────────────────────────
      const COST: Record<number, number> = { [-1]: -1, 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 };
      const BUDGET = 10;

      const updatePointBuy = () => {
        let spent = 0;
        root.querySelectorAll<HTMLInputElement>("[name^='attr-']").forEach((inp) => {
          const val = parseInt(inp.value, 10);
          const cost = COST[val] ?? 0;
          const row = inp.closest("tr");
          if (row) {
            const cell = row.querySelector("td:last-child");
            if (cell) cell.textContent = String(isNaN(val) || !(val in COST) ? "?" : cost);
          }
          spent += isNaN(val) ? 0 : (COST[val] ?? 0);
        });
        const remaining = BUDGET - spent;
        const foot = root.querySelector<HTMLElement>(".t20w-attrs tfoot td:last-child");
        if (foot) {
          foot.textContent = String(remaining);
          foot.style.color = remaining < 0 ? "#f55" : "";
        }
      };

      root.querySelectorAll<HTMLInputElement>("[name^='attr-']").forEach((inp) => {
        inp.addEventListener("input", updatePointBuy);
      });
      updatePointBuy();

      // ── Method select → re-render ───────────────────────────────────────
      const sel = root.querySelector<HTMLSelectElement>("[name='metodoAtributos']");
      if (sel) {
        sel.addEventListener("change", () => {
          this.applyFormData(this._gatherFormData());
          // @ts-expect-error render not typed
          this.render();
        });
      }

      // ── Select dropdowns → re-render on change to show detail card ──────
      for (const name of ["racaId", "origemId", "classeId", "divindadeId"]) {
        const dropdown = root.querySelector<HTMLSelectElement>(`[name="${name}"]`);
        if (dropdown) {
          dropdown.addEventListener("change", () => {
            this.applyFormData(this._gatherFormData());
            // @ts-expect-error render not typed
            this.render();
          });
        }
      }

      // ── Origem pick-2 radio → save to escolhasPorItem ───────────────────
      root.querySelectorAll<HTMLInputElement>("[name='origem_poder_escolha']").forEach((radio) => {
        radio.addEventListener("change", (e) => {
          const val = (e.target as HTMLInputElement).value;
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, origem_poder: val },
          });
        });
      });

      // ── Poder search filter ──────────────────────────────────────────────
      const poderSearch = root.querySelector<HTMLInputElement>("#t20w-poder-search");
      if (poderSearch) {
        poderSearch.addEventListener("input", () => {
          const q = poderSearch.value.toLowerCase();
          root.querySelectorAll<HTMLElement>(".t20w-poder-row").forEach((item) => {
            const name = (item.dataset["poderName"] ?? "").toLowerCase();
            item.style.display = name.includes(q) ? "" : "none";
          });
        });
      }
    }

    _gatherFormData(): FormData {
      const fd = new FormData();
      // @ts-expect-error element not typed on untyped base
      const root = this.element as HTMLElement;
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

    _onClickAction(event: MouseEvent, target: HTMLElement): void {
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
        if (!this._state.isComplete()) {
          this._errors = ["Preencha todos os campos obrigatórios antes de criar o personagem."];
          this.render();
          return;
        }
        void ActorWriter.create(this._state).then(() => this.close());
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
  }
  (_instance as any).render(true);
}
