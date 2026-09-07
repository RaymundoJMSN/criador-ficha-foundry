import { MODULE_ID } from "./constants.js";
import { CompendiumIndex } from "./compendium/index.js";
import { registrarNomesDePoder } from "./rules/magias.js";
import { registerLauncher } from "./ui/launcher.js";
import { defineWizardApp } from "./wizard/app.js";
import { registrarClassesDoCompendio, classesRegistradas } from "./rules/classe.js";
import { CONFIG_PADRAO, SETTING_CONFIG } from "./config/config.js";
import { defineConfigApp } from "./config/app.js";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);

  // module.json declara styles/wizard.css, mas o servidor só relê o manifesto
  // ao reiniciar; em dev garante o link na mão.
  const href = `modules/${MODULE_ID}/styles/wizard.css`;
  if (!document.querySelector(`link[href$="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  // Define WizardApp here — Foundry globals (ApplicationV2, HandlebarsApplicationMixin)
  // are available inside hooks but NOT at module evaluation time.
  defineWizardApp();
  registerLauncher();

  // Regras da mesa: setting de mundo (todo cliente lê) + tela só do mestre.
  const ConfigApp = defineConfigApp();
  // @ts-expect-error settings namespace tipado por módulo no fvtt-types
  game.settings.register(MODULE_ID, SETTING_CONFIG, {
    scope: "world",
    config: false,
    type: Object,
    default: { ...CONFIG_PADRAO },
  });
  // @ts-expect-error settings namespace tipado por módulo no fvtt-types
  game.settings.registerMenu(MODULE_ID, "regras", {
    name: "Regras da mesa",
    label: "Configurar criação de personagem",
    hint: "Método de atributos, dinheiro inicial, raças/classes liberadas e regras opcionais de Heróis de Arton.",
    icon: "fas fa-scroll",
    type: ConfigApp,
    restricted: true,
  });
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | ready — building compendium index`);
  await CompendiumIndex.build();
  console.log(`${MODULE_ID} | index built — ${CompendiumIndex.totalCount} items across all packs`);

  // Classes fora do Livro Básico (Samurai, Heróis de Arton…) tiram a regra de
  // perícia do próprio item do compêndio.
  registrarClassesDoCompendio(CompendiumIndex.getAll("classe"));
  // Poder escolhido é id de compêndio; a cota de magias (Orar, Conhecimento
  // Mágico…) precisa do slug — que vem do nome.
  registrarNomesDePoder((id) => CompendiumIndex.getById("poder", id)?.name);
  console.log(`${MODULE_ID} | ${classesRegistradas()} classe(s) do compêndio registradas`);
});
