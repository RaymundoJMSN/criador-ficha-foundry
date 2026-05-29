import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registerLauncher } from "./ui/launcher.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerLauncher();
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | ready — building compendium index`);
  await CompendiumIndex.build();
  console.log(`${MODULE_ID} | index built — ${CompendiumIndex.totalCount} items across all packs`);
});
