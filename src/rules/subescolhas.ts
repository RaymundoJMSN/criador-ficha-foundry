/**
 * Sub-choice resolver — stub for Plan 3.
 * Handles: specialist school, familiar, choosable modifiers,
 * sorcerer lineage, duende constructor, origin pick-2.
 */
export interface SubescolhaContext {
  itemId: string;
  classeId: string;
  racaId: string;
  nivel: number;
}

/**
 * Resolves sub-choices for a given item (race, class, power, origin).
 * Stub: returns empty array until Plan 3 implements full resolution.
 */
export function resolveSubescolhas(
  _context: SubescolhaContext
): Array<{ key: string; label: string; options: string[] }> {
  // TODO (Plan 3): implement specialist, familiar, modifier choices, lineage, etc.
  return [];
}
