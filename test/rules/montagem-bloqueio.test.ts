import { describe, it, expect } from "vitest";
import { introRepetida, opcaoBloqueada, ehRadio } from "../../src/rules/montagem.js";

const INTRO =
  "Se escolher uma maravilha mecânica, você recebe uma dos poderes a seguir. Uma vez por patamar, você pode escolher uma maravilha mecânica no lugar de um poder de classe.";

describe("introRepetida", () => {
  it("acha a introdução que a maioria das opções repete (Mashin)", () => {
    const opcoes = [
      `${INTRO} Quando sofre dano de ácido, você pode gastar 2 PM…`,
      `${INTRO} Você possui uma arma acoplada ao seu corpo.`,
      "Você pode gastar uma ação de movimento e 2 PM para fazer uma arma causar +1d6.",
      `${INTRO} Escolha uma de suas perícias treinadas. Você recebe +2 nessa perícia.`,
    ];
    expect(introRepetida(opcoes)).toBe(INTRO);
  });

  it("descrições diferentes não viram introdução", () => {
    expect(
      introRepetida([
        "Você recebe visão no escuro e +2 em Percepção e Vontade.",
        "Você possui duas armas naturais de garra, uma em cada mão.",
        "Você pode lançar uma magia de 1º círculo de adivinhação a sua escolha.",
      ])
    ).toBe("");
  });
});

describe("opcaoBloqueada", () => {
  const passo = (extra: Record<string, unknown> = {}) => ({
    id: "maravilha",
    nome: "Maravilha Mecânica",
    escolher: 1,
    opcional: true,
    opcoes: [
      { id: "a", nome: "A" },
      { id: "b", nome: "B" },
      { id: "c", nome: "C" },
    ],
    ...extra,
  }) as never;

  it("passo opcional de uma escolha trava as outras depois da primeira", () => {
    const p = passo();
    const marcadas = [{ id: "a", nome: "A" }] as never[];
    expect(opcaoBloqueada(p, { id: "a", nome: "A" } as never, marcadas)).toBe(false);
    expect(opcaoBloqueada(p, { id: "b", nome: "B" } as never, marcadas)).toBe(true);
  });

  it("radio (uma escolha obrigatória) nunca trava: o jogador troca de opção", () => {
    const p = passo({ opcional: false });
    expect(ehRadio(p)).toBe(true);
    expect(opcaoBloqueada(p, { id: "b", nome: "B" } as never, [{ id: "a", nome: "A" }] as never[])).toBe(false);
  });
});
