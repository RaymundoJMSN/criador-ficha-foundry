import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registerLauncher } from "./ui/launcher.js";
import { defineWizardApp } from "./wizard/app.js";
import { registrarClassesDoCompendio, classesRegistradas } from "./rules/classe.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);

  if (!document.getElementById("t20w-wizard-styles")) {
    const style = document.createElement("style");
    style.id = "t20w-wizard-styles";
    style.textContent = `
  /* Radios desenhados à mão viravam rosquinha (o inset comia o miolo) e ficavam
     de tamanhos diferentes dos checkboxes. accent-color faz o nativo, certo. */
  .t20w-step input[type="radio"],
  .t20w-step input[type="checkbox"] {
    accent-color: #f90;
    width: 15px;
    height: 15px;
    min-width: 15px;
    margin: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .t20w-step input:disabled,
  .t20w-step input:disabled + span,
  .t20w-step label:has(input:disabled) {
    cursor: not-allowed;
  }
  .t20w-step label:has(input:disabled) {
    opacity: 0.45;
  }
  /* Opção de escolha: o texto quebra linha em vez de estourar a caixa.
     <option> de <select> não quebra — por isso opção longa (a alternativa da
     Memória Póstuma tem 130 caracteres) vazava para fora do quadro. */
  .t20w-opcao {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255,255,255,0.04);
    border-radius: 3px;
    font-size: 0.88em;
    line-height: 1.35;
    cursor: pointer;
  }
  .t20w-opcao span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .t20w-opcao input {
    margin-top: 2px;
  }
  .t20w-opcao:hover {
    background: rgba(255,255,255,0.08);
  }
  .t20w-busca-select {
    width: 100%;
    padding: 4px 8px;
    margin-bottom: 4px;
    background: rgba(255,255,255,0.08);
    border: 1px solid #555;
    color: inherit;
    border-radius: 3px;
  }
  .t20w-disabled {
    opacity: 0.4;
    pointer-events: none;
  }
`;
    document.head.appendChild(style);
  }

  // Define WizardApp here — Foundry globals (ApplicationV2, HandlebarsApplicationMixin)
  // are available inside hooks but NOT at module evaluation time.
  defineWizardApp();
  registerLauncher();
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | ready — building compendium index`);
  await CompendiumIndex.build();
  console.log(`${MODULE_ID} | index built — ${CompendiumIndex.totalCount} items across all packs`);

  // Classes fora do Livro Básico (Samurai, Heróis de Arton…) tiram a regra de
  // perícia do próprio item do compêndio.
  registrarClassesDoCompendio(CompendiumIndex.getAll("classe"));
  console.log(`${MODULE_ID} | ${classesRegistradas()} classe(s) do compêndio registradas`);
});
