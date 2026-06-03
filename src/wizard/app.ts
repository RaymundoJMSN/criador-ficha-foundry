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
import { getRaceAttributeTotals } from "../rules/subescolhas.js";
import { toSlug, toNomeSlug } from "../compendium/slug.js";

/** Final Int = base + racial (fixed + chosen). Drives the perícia Int bonus. */
function finalInt(state: WizardState): number {
  const choices = (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];
  const totals = getRaceAttributeTotals(state.racaNome || state.racaId, choices);
  return (state.atributosBase.int ?? 0) + (totals.int ?? 0);
}
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
  IndexedEquipamento,
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
      wizard: { template: TPL("wizard") },
    };

    _state = new WizardState();
    _currentStep: WizardStep = WizardStep.Nivel;
    _errors: string[] = [];

    goToStep(step: WizardStep): void {
      this._currentStep = step;
      this._errors = [];
      this.render();
    }

    async nextStep(): Promise<void> {
      // Equipamento: block if overspent
      if (this._currentStep === WizardStep.Equipamento) {
        const allEquip = [
          ...CompendiumIndex.getAll("equipamento"),
          ...CompendiumIndex.getAll("arma"),
          ...CompendiumIndex.getAll("consumivel"),
        ] as IndexedEquipamento[];
        const equipCtx = prepareEquipamentoContext(this._state, allEquip, []);
        if (!equipCtx.canProceed) {
          this._errors = ["Você excedeu o orçamento disponível. Remova itens do carrinho."];
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
      if (formData.has("nivel")) patch["nivel"] = nivel;
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
      const divindadePoder = formData.get("divindade_poder") as string | null;
      if (divindadePoder !== null) {
        patch["escolhasPorItem"] = {
          ...(patch["escolhasPorItem"] as Record<string, unknown> ?? this._state.escolhasPorItem),
          divindade_poder: divindadePoder,
        };
      }
      const classeCaminho = formData.get("classe_caminho") as string | null;
      if (classeCaminho) {
        patch["escolhasPorItem"] = {
          ...(patch["escolhasPorItem"] as Record<string, unknown> ?? this._state.escolhasPorItem),
          classe_caminho: classeCaminho,
        };
      }
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
          stepCtx = preparePoderesContext(state, poderes, errors, resolvePoderNomePoderes);
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
          ] as IndexedEquipamento[];
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

    async _onRender(_context: unknown, _options: unknown): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const root = (this as any).element as HTMLElement;

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

      // ── Method select → reset atributosBase + re-render ───────────────
      const sel = root.querySelector<HTMLSelectElement>("[name='metodoAtributos']");
      if (sel) {
        sel.addEventListener("change", () => {
          const fd = this._gatherFormData();
          // Reset all attribute values when switching method
          this._state.apply({
            atributosBase: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
          });
          this.applyFormData(fd);
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
            escolhasPorItem: { ...this._state.escolhasPorItem, divindade_poder: undefined },
          });
          this.applyFormData(this._gatherFormData());
          this.render();
        });
      }

      // ── Divindade conceded power radio ──────────────────────────────────
      // Restore checked state from state (radios are rendered without checked attr)
      const savedPoder = this._state.escolhasPorItem["divindade_poder"] as string | undefined;
      if (savedPoder) {
        const poderRadio = root.querySelector<HTMLInputElement>(
          `input[name="divindade_poder"][value="${CSS.escape(savedPoder)}"]`
        );
        if (poderRadio) poderRadio.checked = true;
      }
      root.querySelectorAll<HTMLInputElement>("input[name='divindade_poder']").forEach((radio) => {
        radio.addEventListener("change", (e) => {
          const val = (e.target as HTMLInputElement).value;
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, divindade_poder: val },
          });
        });
      });

      // ── Origem pick-2 radio → save to escolhasPorItem ───────────────────
      root.querySelectorAll<HTMLInputElement>("[name='origem_poder_escolha']").forEach((radio) => {
        radio.addEventListener("change", (e) => {
          const val = (e.target as HTMLInputElement).value;
          this._state.apply({
            escolhasPorItem: { ...this._state.escolhasPorItem, origem_poder: val },
          });
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
        if (!this._state.isComplete()) {
          this._errors = ["Preencha todos os campos obrigatórios antes de criar o personagem."];
          this.render();
          return;
        }
        void ActorWriter.create(this._state).then(() => this.close());
      } else if (action === "attrDec") {
        const attr = target.dataset["attr"] as string;
        if (!attr) return;
        const isCompra = this._state.metodoAtributos === "compra_pontos";
        const min = isCompra ? -1 : -5;
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
        const isCompra = this._state.metodoAtributos === "compra_pontos";
        const max = isCompra ? 4 : 10;
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
      } else if (action === "equipAdd") {
        const id = target.dataset["id"];
        if (id && !this._state.equipamento.some((e) => e.itemId === id)) {
          this._state.apply({
            equipamento: [...this._state.equipamento, { itemId: id, qty: 1 }],
          });
          void this.render();
        }
      } else if (action === "equipRemove") {
        const id = target.dataset["id"];
        if (id) {
          this._state.apply({
            equipamento: this._state.equipamento.filter((e) => e.itemId !== id),
          });
          void this.render();
        }
      } else if (action === "rollDinheiro") {
        if (this._state.nivel === 1) {
          // @ts-expect-error Roll is a Foundry global
          const roll = await new Roll("4d6").roll({ async: true });
          this._state.apply({
            escolhasPorItem: {
              ...this._state.escolhasPorItem,
              dinheiro_rolado: (roll as { total: number }).total,
            },
          });
          await this.render();
        }
      } else if (action === "rollAtributos") {
        const method = this._state.metodoAtributos;
        const attrs = ["for", "des", "con", "int", "sab", "car"] as const;

        if (method === "valkaria") {
          const vals = [4, 3, 2, 2, 1, 0];
          const patch = { ...this._state.atributosBase };
          attrs.forEach((a, i) => { patch[a] = vals[i]!; });
          this._state.apply({ atributosBase: patch });
        } else if (method === "khalmyr") {
          const vals = [3, 3, 2, 2, 2, 1];
          const patch = { ...this._state.atributosBase };
          attrs.forEach((a, i) => { patch[a] = vals[i]!; });
          this._state.apply({ atributosBase: patch });
        } else if (method === "epica") {
          const patch = { ...this._state.atributosBase };
          attrs.forEach((a) => { patch[a] = 4; });
          this._state.apply({ atributosBase: patch });
        } else if (method === "nimb") {
          const patch = { ...this._state.atributosBase };
          attrs.forEach((a) => { patch[a] = 0; });
          this._state.apply({ atributosBase: patch });
        } else if (method === "rolagem_padrao") {
          const patch = { ...this._state.atributosBase };
          for (const a of attrs) {
            // @ts-expect-error Roll is a Foundry global
            const roll = await new Roll("4d6kh3").roll({ async: true });
            patch[a] = (roll as { total: number }).total;
          }
          this._state.apply({ atributosBase: patch });
        } else if (method === "classica") {
          const patch = { ...this._state.atributosBase };
          for (const a of attrs) {
            // @ts-expect-error Roll is a Foundry global
            const roll = await new Roll("3d6").roll({ async: true });
            patch[a] = (roll as { total: number }).total;
          }
          this._state.apply({ atributosBase: patch });
        }
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
  }
  (_instance as any).render(true);
}
