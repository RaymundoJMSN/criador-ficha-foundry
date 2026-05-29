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

  // @ts-expect-error fvtt-types ApplicationV2/HandlebarsApplicationMixin incomplete for v13
  _WizardAppClass = class WizardApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "t20w-wizard",
      window: { title: "T20W: Criar Personagem" },
      position: { width: 720, height: 600 },
    };

    static PARTS = {
      shell: { template: TPL("shell") },
      nivel: { template: TPL("nivel") },
      atributos: { template: TPL("atributos") },
      raca: { template: TPL("raca") },
      origem: { template: TPL("origem") },
      classe: { template: TPL("classe") },
      pericias: { template: TPL("pericias") },
      divindade: { template: TPL("divindade") },
      poderes: { template: TPL("poderes") },
      magias: { template: TPL("magias") },
      equipamento: { template: TPL("equipamento") },
      revisao: { template: TPL("revisao") },
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
      if (formData.has("racaId")) patch["racaId"] = racaId;
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
        case WizardStep.Origem:
          stepCtx = prepareOrigemContext(state, errors);
          break;
        case WizardStep.Classe: {
          const classes = CompendiumIndex.getAll("classe") as IndexedClasse[];
          stepCtx = prepareClasseContext(state, classes, errors);
          break;
        }
        case WizardStep.Pericias: {
          const classe = CompendiumIndex.getAll("classe").find(
            (c) => c.id === state.classeId
          ) as IndexedClasse | undefined;
          const intMod = state.atributosBase.int ?? 0;
          stepCtx = preparePericiaContext(state, classe, intMod, errors);
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
          const classeItem = CompendiumIndex.getAll("classe").find(
            (c) => c.id === state.classeId
          );
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
        ...(stepCtx as object),
      };
    }

    _onClickAction(event: MouseEvent, target: HTMLElement): void {
      event.preventDefault();
      const action = target.dataset["action"];
      if (action === "next") void this.nextStep();
      else if (action === "back") this.prevStep();
      else if (action === "goStep") {
        const s = target.dataset["step"] as WizardStep;
        if (s) this.goToStep(s);
      } else if (action === "create") {
        if (!this._state.isComplete()) {
          this._errors = [
            "Preencha todos os campos obrigatórios antes de criar o personagem.",
          ];
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
    console.error(`${MODULE_ID} | openWizard: WizardApp not defined yet — call defineWizardApp() in init`);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inst = _instance as any;
  if (!inst || !inst.rendered) {
    _instance = new _WizardAppClass();
  }
  (_instance as any).render(true);
}
