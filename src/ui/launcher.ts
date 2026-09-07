import { MODULE_ID } from "../constants.js";
import { openWizard } from "../wizard/app.js";
import { openConfigApp } from "../config/app.js";

export function registerLauncher(): void {
  Hooks.on("renderActorDirectory", (_app: unknown, html: HTMLElement) => {
    if (html.querySelector(".t20w-launcher-footer")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t20w-open-wizard";
    btn.style.cssText = "width: 100%; margin-top: 4px;";
    btn.innerHTML = `<i class="fas fa-hat-wizard"></i> ${game.i18n!.localize("T20W.OpenWizard")}`;
    btn.addEventListener("click", () => {
      openWizard();
    });

    const footer = document.createElement("div");
    footer.className = "t20w-launcher-footer";
    footer.style.cssText = "padding: 8px 4px 4px;";
    footer.appendChild(btn);

    // Só o mestre configura as regras da mesa.
    if (game.user?.isGM) {
      const cfg = document.createElement("button");
      cfg.type = "button";
      cfg.className = "t20w-open-config";
      cfg.style.cssText = "width: 100%; margin-top: 4px; font-size: 0.85em;";
      cfg.innerHTML = `<i class="fas fa-scroll"></i> Regras da mesa`;
      cfg.addEventListener("click", () => openConfigApp());
      footer.appendChild(cfg);
    }

    html.appendChild(footer);
  });
}
