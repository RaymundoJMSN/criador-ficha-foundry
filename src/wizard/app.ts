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
import type { IndexedClasse, IndexedRace } from "../compendium/types.js";

const TPL = (name: string) =>
  `modules/${MODULE_ID}/templates/wizard/${name}.hbs`;

// @ts-expect-error fvtt-types ApplicationV2/HandlebarsApplicationMixin incomplete for v13
export class WizardApp extends HandlebarsApplicationMixin(ApplicationV2) {
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
  };

  private _state = new WizardState();
  private _currentStep: WizardStep = WizardStep.Nivel;
  private _errors: string[] = [];

  goToStep(step: WizardStep): void {
    this._currentStep = step;
    this._errors = [];
    // @ts-expect-error render not typed on untyped base
    this.render();
  }

  async nextStep(): Promise<void> {
    const result = validate(this._currentStep, this._state as Parameters<typeof validate>[1]);
    if (!result.valid) {
      this._errors = result.errors;
      // @ts-expect-error render not typed on untyped base
      this.render();
      return;
    }
    const idx = STEP_ORDER.indexOf(this._currentStep);
    if (idx < STEP_ORDER.length - 1) {
      this._currentStep = STEP_ORDER[idx + 1];
      this._errors = [];
      // @ts-expect-error render not typed on untyped base
      this.render();
    }
  }

  prevStep(): void {
    const idx = STEP_ORDER.indexOf(this._currentStep);
    if (idx > 0) {
      this._currentStep = STEP_ORDER[idx - 1];
      this._errors = [];
      // @ts-expect-error render not typed on untyped base
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

    const atributosBase = { ...this._state.atributosBase };
    for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
      const v = formData.get(`attr-${attr}`);
      if (v !== null) atributosBase[attr] = parseInt(v as string, 10);
    }

    const periciasTreinadas: string[] = [];
    // @ts-expect-error FormData.entries() not typed in this TS target
    for (const [key] of formData.entries()) {
      if ((key as string).startsWith("pericia-")) {
        periciasTreinadas.push((key as string).replace("pericia-", ""));
      }
    }

    const patch: Partial<WizardState> = { atributosBase };
    if (formData.has("nivel")) (patch as Record<string, unknown>)["nivel"] = nivel;
    if (formData.has("nome")) (patch as Record<string, unknown>)["nome"] = nome;
    if (formData.has("metodoAtributos"))
      (patch as Record<string, unknown>)["metodoAtributos"] = metodoAtributos;
    if (formData.has("racaId")) (patch as Record<string, unknown>)["racaId"] = racaId;
    if (formData.has("origemId")) (patch as Record<string, unknown>)["origemId"] = origemId;
    if (formData.has("classeId")) (patch as Record<string, unknown>)["classeId"] = classeId;
    if (periciasTreinadas.length > 0)
      (patch as Record<string, unknown>)["periciasTreinadas"] = periciasTreinadas;

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
    }
  }
}

let _instance: WizardApp | null = null;

export function openWizard(): void {
  // @ts-expect-error rendered not typed on untyped base
  if (!_instance || !_instance.rendered) {
    _instance = new WizardApp();
  }
  // @ts-expect-error render not typed on untyped base
  _instance.render(true);
}
