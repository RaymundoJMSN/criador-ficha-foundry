import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registerLauncher } from "./ui/launcher.js";
import { defineWizardApp } from "./wizard/app.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);

  if (!document.getElementById("t20w-wizard-styles")) {
    const style = document.createElement("style");
    style.id = "t20w-wizard-styles";
    style.textContent = `
  .t20w-radio-group input[type="radio"],
  .t20w-step input[type="radio"] {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    min-width: 16px;
    border: 2px solid rgba(255,255,255,0.45);
    border-radius: 50%;
    cursor: pointer;
    background: transparent;
    vertical-align: middle;
  }
  .t20w-radio-group input[type="radio"]:checked,
  .t20w-step input[type="radio"]:checked {
    border-color: #f90;
    background: #f90;
    box-shadow: inset 0 0 0 4px rgba(10,10,20,0.85);
  }
  .t20w-radio-group input[type="radio"]:hover:not(:checked),
  .t20w-step input[type="radio"]:hover:not(:checked) {
    border-color: rgba(255,255,255,0.75);
  }
  .t20w-step input[type="checkbox"] {
    accent-color: #f90;
    cursor: pointer;
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
});
