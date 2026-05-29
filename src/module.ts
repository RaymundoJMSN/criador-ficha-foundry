import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registerLauncher } from "./ui/launcher.js";
import { defineWizardApp } from "./wizard/app.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
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
