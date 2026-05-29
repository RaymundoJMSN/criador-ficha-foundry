export interface WizardStateData {
  nivel: number;
  nome: string;
  metodoAtributos: string;
  atributosBase: Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;
  racaId: string;
  origemId: string;
  classeId: string;
  subclasseId: string;
  divindadeId: string;
  periciasTreinadas: string[];
  poderes: string[];
  poderesAutoGrant: string[];
  magias: string[];
  equipamento: { itemId: string; qty: number }[];
  dinheiroRestante: number;
  escolhasPorItem: Record<string, unknown>;
  detalhes: Record<string, string>;
}

const DEFAULT_STATE: WizardStateData = {
  nivel: 1,
  nome: "",
  metodoAtributos: "compra_pontos",
  atributosBase: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
  racaId: "",
  origemId: "",
  classeId: "",
  subclasseId: "",
  divindadeId: "",
  periciasTreinadas: [],
  poderes: [],
  poderesAutoGrant: [],
  magias: [],
  equipamento: [],
  dinheiroRestante: 0,
  escolhasPorItem: {},
  detalhes: {},
};

const REQUIRED_FIELDS: (keyof WizardStateData)[] = ["nome", "racaId", "origemId", "classeId"];

export class WizardState implements WizardStateData {
  nivel!: number;
  nome!: string;
  metodoAtributos!: string;
  atributosBase!: Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;
  racaId!: string;
  origemId!: string;
  classeId!: string;
  subclasseId!: string;
  divindadeId!: string;
  periciasTreinadas!: string[];
  poderes!: string[];
  poderesAutoGrant!: string[];
  magias!: string[];
  equipamento!: { itemId: string; qty: number }[];
  dinheiroRestante!: number;
  escolhasPorItem!: Record<string, unknown>;
  detalhes!: Record<string, string>;

  constructor(initial?: Partial<WizardStateData>) {
    Object.assign(this, structuredClone(DEFAULT_STATE));
    if (initial) Object.assign(this, initial);
  }

  apply(patch: Partial<WizardStateData>): void {
    Object.assign(this, patch);
  }

  isComplete(): boolean {
    return REQUIRED_FIELDS.every((f) => {
      const val = this[f];
      return typeof val === "string" ? val.trim().length > 0 : true;
    });
  }

  serialize(): string {
    const data: WizardStateData = {
      nivel: this.nivel,
      nome: this.nome,
      metodoAtributos: this.metodoAtributos,
      atributosBase: { ...this.atributosBase },
      racaId: this.racaId,
      origemId: this.origemId,
      classeId: this.classeId,
      subclasseId: this.subclasseId,
      divindadeId: this.divindadeId,
      periciasTreinadas: [...this.periciasTreinadas],
      poderes: [...this.poderes],
      poderesAutoGrant: [...this.poderesAutoGrant],
      magias: [...this.magias],
      equipamento: this.equipamento.map((e) => ({ ...e })),
      dinheiroRestante: this.dinheiroRestante,
      escolhasPorItem: { ...this.escolhasPorItem },
      detalhes: { ...this.detalhes },
    };
    return JSON.stringify(data);
  }

  static deserialize(json: string): WizardState {
    const data = JSON.parse(json) as Partial<WizardStateData>;
    return new WizardState(data);
  }
}
