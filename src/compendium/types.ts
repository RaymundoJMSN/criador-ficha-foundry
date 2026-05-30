import type { ItemType } from "../constants.js";

export interface IndexedBase {
  id: string;
  name: string;
  img: string;
  packId: string; // e.g. "tormenta20.racas"
  type: ItemType;
}

export interface IndexedRace extends IndexedBase {
  type: "race";
  system: {
    atributos?: Record<string, unknown>;
  };
}

export interface IndexedClasse extends IndexedBase {
  type: "classe";
  system: {
    pvPorNivel?: number;
    pmPorNivel?: number;
    descricao?: string;
    niveis?: unknown;
    pericias?: {
      inatas?: string[];
      escolhas?: string[];
      numero?: number;
      value?: string[];
    };
  };
}

export interface IndexedPoder extends IndexedBase {
  type: "poder";
  system: {
    tipo?: string;
    subtipo?: string;
    descricao?: string;
  };
}

export interface IndexedMagia extends IndexedBase {
  type: "magia";
  system: {
    circulo?: number; // 1–5
    escola?: string; // "abj"|"adv"|"con"|"enc"|"evo"|"ilu"|"nec"|"tra"
    tipo?: string; // "arc" | "div"
  };
}

export interface IndexedEquipamento extends IndexedBase {
  type: "equipamento" | "arma" | "consumivel" | "tesouro";
  system: {
    preco?: number;
    peso?: number;
    tipo?: string;
  };
}

export type AnyIndexed =
  | IndexedRace
  | IndexedClasse
  | IndexedPoder
  | IndexedMagia
  | IndexedEquipamento;

/** Maps ItemType keys to their corresponding IndexedX type. */
export type TypeToIndexed = {
  race: IndexedRace;
  classe: IndexedClasse;
  poder: IndexedPoder;
  magia: IndexedMagia;
  equipamento: IndexedEquipamento;
  arma: IndexedEquipamento;
  consumivel: IndexedEquipamento;
  tesouro: IndexedEquipamento;
};
