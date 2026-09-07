/**
 * Nome aleatório da Tabela 1-24 de Heróis de Arton (Nomes de Personagens), por
 * raça. A tabela vem em `textos.json` (gerado local, gitignorado — é texto da
 * Jambo); sem ela o botão simplesmente não aparece.
 */
import textosRaw from "../data/textos.json";
import { chaveDaRaca } from "./montagem.js";

const NOMES = ((textosRaw as { nomes?: Record<string, string[]> }).nomes ?? {}) as Record<string, string[]>;

export function temNomes(): boolean {
  return Object.values(NOMES).some((l) => l.length > 0);
}

/** Sorteia da lista da raça; raça sem tabela (ou sem raça) sorteia entre todas. */
export function sortearNome(
  racaNome: string,
  tabelas: Record<string, string[]> = NOMES,
  sorteio: () => number = Math.random
): string | null {
  const daRaca = tabelas[chaveDaRaca(racaNome.split(" (")[0] ?? racaNome)];
  const lista = daRaca && daRaca.length > 0 ? daRaca : Object.values(tabelas).flat();
  if (lista.length === 0) return null;
  return lista[Math.min(lista.length - 1, Math.floor(sorteio() * lista.length))] ?? null;
}
