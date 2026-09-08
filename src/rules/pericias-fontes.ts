import type { WizardState } from "../wizard/state.js";
import { validarBeneficios } from "./origem.js";
import { beneficiosDeOrigemPermitidos } from "./idade.js";
import { periciasDeEscolhasRaciais } from "./raca.js";
import { periciasTreinadasDaMontagem } from "./montagem.js";

export interface PericiaDeFonte {
  slug: string;
  /** Rótulo curto para a tela ("origem", "raça"). */
  fonte: string;
}

/**
 * Perícias que o personagem JÁ tem sem gastar escolha do passo Perícias:
 * benefício de origem, habilidade racial e montagem da raça. Fonte única — o
 * passo Perícias mostra como treinada e o mapper grava na ficha.
 */
export function periciasDeOutrasFontes(state: WizardState): PericiaDeFonte[] {
  const out: PericiaDeFonte[] = [];
  const vistas = new Set<string>();
  const add = (slug: string, fonte: string): void => {
    if (!slug || vistas.has(slug)) return;
    vistas.add(slug);
    out.push({ slug, fonte });
  };

  if (state.origemId) {
    const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [];
    for (const p of validarBeneficios(state.origemId, escolhidos, beneficiosDeOrigemPermitidos(state)).pericias) {
      add(p, "origem");
    }
  }
  const racaRef = state.racaNome || state.racaId;
  if (racaRef) {
    for (const p of periciasDeEscolhasRaciais(racaRef, state.escolhasPorItem).treinadas) add(p, "raça");
    for (const p of periciasTreinadasDaMontagem(racaRef, state.escolhasPorItem)) add(p, "raça");
  }
  return out;
}
