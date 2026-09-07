import { toNomeSlug } from "../compendium/slug.js";
import { slotsDePoder, habilidadesAte } from "./progressao.js";

/**
 * Multiclasse (LB p.35): "Quando sobe de nível, você pode escolher outra
 * classe… Zaled é um arcanista de 3º nível, um paladino de 1º nível e um
 * personagem de 4º nível." A classe do 1º nível é a principal (dá perícias e
 * proficiências; PV inicial); as outras só somam níveis, habilidades, poderes
 * e PM. `escolhasPorItem.multiclasse` = [{classeId, classeNome, niveis}].
 */
export interface ClasseNivel {
  classeId: string;
  classeNome: string;
  classeSlug: string;
  niveis: number;
  principal: boolean;
  /** Chave em `escolhasPorItem` do caminho desta classe. */
  caminhoChave: string;
}

export interface EstadoClasses {
  nivel: number;
  classeId: string;
  classeNome?: string;
  escolhasPorItem: Record<string, unknown>;
}

interface Extra {
  classeId: string;
  classeNome: string;
  niveis: number;
}

/** Classes extras válidas: com nome, nível ≥ 1 e diferentes da principal e entre si. */
export function classesExtras(s: EstadoClasses): Extra[] {
  const bruto = (s.escolhasPorItem["multiclasse"] as Extra[] | undefined) ?? [];
  const vistas = new Set<string>([s.classeId]);
  const out: Extra[] = [];
  for (const e of bruto) {
    if (!e?.classeId || !e.classeNome || vistas.has(e.classeId)) continue;
    vistas.add(e.classeId);
    out.push({ classeId: e.classeId, classeNome: e.classeNome, niveis: Math.max(1, Math.floor(Number(e.niveis) || 1)) });
  }
  return out;
}

/** Todas as classes com seus níveis; a principal vem primeiro com o que sobra. */
export function classesDoPersonagem(s: EstadoClasses): ClasseNivel[] {
  const extras = classesExtras(s);
  const dosExtras = extras.reduce((n, e) => n + e.niveis, 0);
  const principal: ClasseNivel = {
    classeId: s.classeId,
    classeNome: s.classeNome ?? "",
    classeSlug: toNomeSlug(s.classeNome ?? ""),
    niveis: Math.max(1, s.nivel - dosExtras),
    principal: true,
    caminhoChave: "classe_caminho",
  };
  return [
    principal,
    ...extras.map((e) => ({
      classeId: e.classeId,
      classeNome: e.classeNome,
      classeSlug: toNomeSlug(e.classeNome),
      niveis: e.niveis,
      principal: false,
      caminhoChave: `classe_caminho_${toNomeSlug(e.classeNome)}`,
    })),
  ];
}

export function temMulticlasse(s: EstadoClasses): boolean {
  return classesExtras(s).length > 0;
}

/** Nível na classe — o que os pré-requisitos "X níveis de guerreiro" comparam. */
export function niveisNaClasse(s: EstadoClasses, classeSlug: string): number {
  return classesDoPersonagem(s).find((c) => c.classeSlug === classeSlug)?.niveis ?? 0;
}

/** {slug: níveis} para o motor de pré-requisitos. */
export function niveisPorClasse(s: EstadoClasses): Record<string, number> {
  return Object.fromEntries(classesDoPersonagem(s).map((c) => [c.classeSlug, c.niveis]));
}

export function caminhoDe(s: EstadoClasses, c: ClasseNivel): string {
  return (s.escolhasPorItem[c.caminhoChave] as string | undefined) ?? "";
}

/** Vagas de poder somadas por classe ("as habilidades de um arcanista de 3º e de um paladino de 1º"). */
export function slotsDePoderTotal(s: EstadoClasses): number {
  return classesDoPersonagem(s).reduce((n, c) => n + slotsDePoder(c.classeNome || c.classeId, c.niveis), 0);
}

/** Habilidades automáticas de cada classe no seu nível. */
export function habilidadesDeTodas(s: EstadoClasses): Array<{ classe: ClasseNivel; slug: string }> {
  return classesDoPersonagem(s).flatMap((classe) =>
    habilidadesAte(classe.classeNome || classe.classeId, classe.niveis).map((slug) => ({ classe, slug }))
  );
}

/** Erros da montagem multiclasse (sobra pelo menos 1 nível para a principal). */
export function errosMulticlasse(s: EstadoClasses): string[] {
  const bruto = (s.escolhasPorItem["multiclasse"] as Extra[] | undefined) ?? [];
  const out: string[] = [];
  const dosExtras = classesExtras(s).reduce((n, e) => n + e.niveis, 0);
  if (dosExtras >= s.nivel) out.push(`Os níveis das outras classes (${dosExtras}) têm de somar menos que o nível ${s.nivel}.`);
  if (bruto.some((e) => e?.classeId && e.classeId === s.classeId)) out.push("A classe principal não entra de novo na multiclasse.");
  const ids = bruto.map((e) => e?.classeId).filter(Boolean);
  if (new Set(ids).size !== ids.length) out.push("Cada classe só entra uma vez.");
  if (bruto.some((e) => e && !e.classeId)) out.push("Escolha a classe da linha da multiclasse ou remova a linha.");
  return out;
}
