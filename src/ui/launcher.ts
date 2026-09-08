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
      // Sem a permissão "Criar novos Atores" o Actor.create falha lá no fim.
      if (!game.user?.can("ACTOR_CREATE")) {
        ui.notifications?.warn("Você não tem permissão para criar atores neste mundo. Peça ao mestre (Configurações → Permissões → Criar novos Atores).");
        return;
      }
      openWizard();
    });

    const footer = document.createElement("div");
    footer.className = "t20w-launcher-footer";
    footer.style.cssText = "padding: 8px 4px 4px;";
    footer.appendChild(btn);

    // Ficha feita no site (t20.raynathus.com.br/criar): o JSON baixado vira ator.
    const imp = document.createElement("button");
    imp.type = "button";
    imp.className = "t20w-import-ficha";
    imp.style.cssText = "width: 100%; margin-top: 4px; font-size: 0.85em;";
    imp.innerHTML = `<i class="fas fa-file-import"></i> Importar ficha`;
    imp.addEventListener("click", () => {
      if (!game.user?.can("ACTOR_CREATE")) {
        ui.notifications?.warn("Você não tem permissão para criar atores neste mundo.");
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", async () => {
        const arquivo = input.files?.[0];
        if (!arquivo) return;
        try {
          const dados = JSON.parse(await arquivo.text()) as { name?: string; type?: string; folder?: unknown; _id?: unknown; items?: Array<Record<string, unknown>> };
          // Ids de pasta/ator do site não existem neste mundo; efeitos que vieram
          // como id solto (despejo antigo) derrubariam a validação.
          delete dados.folder;
          delete dados._id;
          // `system.pericias.<code>` parcial substitui o SkillData inteiro e a
          // perícia entra sem nome e com Força: sai do create e volta por update.
          const sys = (dados as { system?: { pericias?: Record<string, Record<string, unknown>> } }).system;
          const pericias = sys?.pericias;
          if (sys) delete sys.pericias;
          for (const it of dados.items ?? []) {
            delete it["folder"];
            it["effects"] = ((it["effects"] as unknown[] | undefined) ?? []).filter((e) => typeof e === "object" && e !== null);
          }
          if (dados.type !== "character" || !Array.isArray(dados.items)) throw new Error("não é uma ficha de personagem");
          const actor = (await Actor.create(dados as never)) as
            | { name: string; sheet?: { render(f: boolean): void }; update(d: Record<string, unknown>): Promise<unknown> }
            | undefined;
          if (actor && pericias) {
            const up: Record<string, unknown> = {};
            for (const [code, campos] of Object.entries(pericias)) {
              for (const [campo, valor] of Object.entries(campos ?? {})) up[`system.pericias.${code}.${campo}`] = valor;
            }
            if (Object.keys(up).length > 0) await actor.update(up);
          }
          actor?.sheet?.render(true);
          ui.notifications?.info(`Ficha importada: ${actor?.name ?? dados.name}`);
        } catch (err) {
          ui.notifications?.error(`Não importou: ${(err as Error).message}`);
        }
      });
      input.click();
    });
    footer.appendChild(imp);

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
