import { MODULE_ID } from "../constants.js";

export function registerLauncher(): void {
  // renderActorDirectory fires each time the Actors tab renders in v13.
  // The button is injected into .header-actions before the default Create button.
  Hooks.on("renderActorDirectory", (_app: unknown, html: HTMLElement) => {
    // Avoid injecting twice on hot-reload
    if (html.querySelector(".t20w-open-wizard")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t20w-open-wizard";
    btn.innerHTML = `<i class="fas fa-hat-wizard"></i> ${game.i18n!.localize("T20W.OpenWizard")}`;
    btn.addEventListener("click", () => {
      ui.notifications!.info(game.i18n!.localize("T20W.Launcher.WIP"));
    });

    const actions = html.querySelector(".header-actions");
    if (actions) {
      actions.prepend(btn);
    } else {
      // Fallback: Foundry may use different structure in future builds
      console.warn(`${MODULE_ID} | .header-actions not found in ActorDirectory — cannot inject button`);
    }
  });
}
