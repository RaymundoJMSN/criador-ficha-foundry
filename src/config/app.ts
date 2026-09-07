import { MODULE_ID } from "../constants.js";
import { CompendiumIndex } from "../compendium/index.js";
import { listMetodos } from "../rules/atributos.js";
import { CONFIG_PADRAO, gravarConfig, lerConfig, type ConfigCriacao } from "./config.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

let ConfigApp: any = null;

/** Tela "Regras da mesa" (só o mestre). Chamar no init, depois do defineWizardApp. */
export function defineConfigApp(): any {
  if (ConfigApp) return ConfigApp;
  const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

  ConfigApp = class extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "t20w-config",
      tag: "form",
      classes: ["t20w-config"],
      window: { title: "Criador de Ficha — Regras da mesa", icon: "fas fa-scroll", resizable: true },
      position: { width: 620, height: "auto" },
      form: { handler: ConfigApp_onSubmit, closeOnSubmit: true },
    };

    static PARTS = {
      form: { template: `modules/${MODULE_ID}/templates/config.hbs` },
    };

    async _prepareContext(): Promise<unknown> {
      const c = lerConfig();
      const nomes = (tipo: "race" | "classe") =>
        [...new Set(CompendiumIndex.getAll(tipo).map((i) => i.name))].sort((a, b) => a.localeCompare(b));
      return {
        c,
        metodos: [
          { id: "livre", nome: "Jogador escolhe", selected: c.metodoAtributos === "livre" },
          ...listMetodos().map((m) => ({ id: m.id, nome: `${m.nome} (${m.categoria})`, selected: m.id === c.metodoAtributos })),
        ],
        racas: nomes("race").map((n) => ({ nome: n, on: c.racasPermitidas.includes(n) })),
        classes: nomes("classe").map((n) => ({ nome: n, on: c.classesPermitidas.includes(n) })),
        dinheiroFixo: c.dinheiro === "fixo",
      };
    }
  };
  return ConfigApp;
}

async function ConfigApp_onSubmit(_event: Event, form: HTMLFormElement, formData: any): Promise<void> {
  const o = formData.object as Record<string, unknown>;
  const marcados = (prefixo: string) =>
    Object.entries(o)
      .filter(([k, v]) => k.startsWith(prefixo) && v === true)
      .map(([k]) => k.slice(prefixo.length));
  const config: ConfigCriacao = {
    ...CONFIG_PADRAO,
    metodoAtributos: String(o["metodoAtributos"] ?? "livre"),
    pontosCompra: Number(o["pontosCompra"]) || 10,
    dinheiro: o["dinheiro"] === "fixo" ? "fixo" : "padrao",
    dinheiroFixo: Number(o["dinheiroFixo"]) || 0,
    racasPermitidas: marcados("raca-"),
    classesPermitidas: marcados("classe-"),
    complicacoes: o["complicacoes"] === true,
    complicacaoIdade: o["complicacaoIdade"] === true,
    idadesVariadas: o["idadesVariadas"] === true,
    racasAbertas: o["racasAbertas"] === true,
    devocoesAbertas: o["devocoesAbertas"] === true,
  };
  await gravarConfig(config);
  (ui as any).notifications?.info("Regras da mesa salvas.");
  void form;
}

export function openConfigApp(): void {
  if (!ConfigApp) defineConfigApp();
  new ConfigApp().render(true);
}
