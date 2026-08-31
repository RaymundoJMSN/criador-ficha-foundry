import { describe, it, expect } from "vitest";
import { resolverPoder } from "../../src/compendium/resolver.js";

/** Nomes reais do pack `tormenta20.poderes` (v1.5.015). */
const PACK = [
  { name: "Ambidestria (Guerreiro)" },
  { name: "Ambidestria (Caçador)" },
  { name: "Fúria" },
  { name: "Ataque Furtivo" },
  { name: "Ataque Especial" },
  { name: "Magias (Clérigo)" },
  { name: "Magias (Arcanista)" },
  { name: "Virtude Paladinesca: Temperança" },
  { name: "Postura de Combate: Torre Inabalável" },
  { name: "Linhagem Dracônica Básica" },
  { name: "Sorte do Louco" },
  { name: "Olho de Dragão" },
  { name: "Abençoado", system: { descricao: "Você soma seu Carisma…" } },
  { name: "Abençoado" },
  { name: "Obra-Prima" },
  { name: "Magia Sagrada/Profana" },
  { name: "Evasão (Ladino)" },
  { name: "Evasão (Bucaneiro)" },
];

const via = (slug: string, classe = "") => resolverPoder(slug, classe, PACK)?.via ?? "AUSENTE";
const nome = (slug: string, classe = "") => resolverPoder(slug, classe, PACK)?.item.name ?? null;

describe("resolverPoder", () => {
  it("casa nome idêntico", () => {
    expect(nome("ataque_especial")).toBe("Ataque Especial");
    expect(via("ataque_especial")).toBe("exato");
  });

  it("desempata poder compartilhado pelo qualificador de classe", () => {
    expect(nome("ambidestria", "guerreiro")).toBe("Ambidestria (Guerreiro)");
    expect(nome("ambidestria", "cacador")).toBe("Ambidestria (Caçador)");
    expect(via("ambidestria", "guerreiro")).toBe("classe");
  });

  it("sem classe, poder compartilhado fica ambíguo e não resolve", () => {
    expect(nome("ambidestria")).toBeNull();
  });

  it("habilidade parametrizada cai no prefixo", () => {
    expect(nome("furia_+2", "barbaro")).toBe("Fúria");
    expect(nome("ataque_furtivo_10d6", "ladino")).toBe("Ataque Furtivo");
    expect(nome("ataque_especial_8", "guerreiro")).toBe("Ataque Especial");
    expect(via("furia_+2", "barbaro")).toBe("prefixo");
  });

  it("marcador de círculo vira a habilidade Magias da classe", () => {
    expect(nome("magias_2_circulo", "clerigo")).toBe("Magias (Clérigo)");
    expect(nome("magias", "arcanista")).toBe("Magias (Arcanista)");
    expect(via("magias_2_circulo", "clerigo")).toBe("prefixo+classe");
  });

  it("resolve grupo com dois-pontos", () => {
    expect(nome("virtude_temperanca", "paladino")).toBe("Virtude Paladinesca: Temperança");
    expect(nome("postura_torre_inabalavel", "cavaleiro")).toBe(
      "Postura de Combate: Torre Inabalável"
    );
    expect(via("virtude_temperanca", "paladino")).toBe("grupo");
  });

  it("resolve mesma palavra em ordem diferente", () => {
    expect(nome("linhagem_basica_draconica", "arcanista")).toBe("Linhagem Dracônica Básica");
    expect(via("linhagem_basica_draconica", "arcanista")).toBe("tokens");
  });

  it("usa o override quando nenhuma regra alcança", () => {
    expect(nome("sorte_de_nimb", "bucaneiro")).toBe("Sorte do Louco");
    expect(nome("olho_do_dragao", "inventor")).toBe("Olho de Dragão");
    expect(via("sorte_de_nimb", "bucaneiro")).toBe("override");
  });

  it("entre itens de mesmo nome, prefere o que tem descrição", () => {
    expect(resolverPoder("abencado", "paladino", PACK)?.item.system?.descricao).toContain(
      "Carisma"
    );
  });

  it("hífen e barra viram separador (não somem)", () => {
    expect(nome("obra_prima", "inventor")).toBe("Obra-Prima");
    expect(nome("magia_sagrada_profana", "clerigo")).toBe("Magia Sagrada/Profana");
  });

  it("conteúdo não instalado devolve null, sem inventar item", () => {
    expect(resolverPoder("agrilhoar_os_caidos", "arcanista", PACK)).toBeNull();
    expect(resolverPoder("", "guerreiro", PACK)).toBeNull();
  });
});
