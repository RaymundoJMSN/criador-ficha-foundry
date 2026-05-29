import { MODULE_ID } from "../constants.js";

export function registerLauncher(): void {
  // renderActorDirectory fires each time the Actors tab renders in v13.
  // The button is appended at the bottom of the sidebar tab, below the actor list.
  Hooks.on("renderActorDirectory", (_app: unknown, html: HTMLElement) => {
    // Avoid injecting twice on hot-reload
    if (html.querySelector(".t20w-launcher-footer")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t20w-open-wizard";
    btn.style.cssText = "width: 100%; margin-top: 4px;";
    btn.innerHTML = `<i class="fas fa-hat-wizard"></i> ${game.i18n!.localize("T20W.OpenWizard")}`;
    btn.addEventListener("click", () => {
      ui.notifications!.info(game.i18n!.localize("T20W.Launcher.WIP"));
    });

    const footer = document.createElement("div");
    footer.className = "t20w-launcher-footer";
    footer.style.cssText = "padding: 8px 4px 4px;";
    footer.appendChild(btn);

    // Append to the sidebar tab root — renders below the actor list
    html.appendChild(footer);
  });
}
