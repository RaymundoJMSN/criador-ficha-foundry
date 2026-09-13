/**
 * Gera DOIS módulos do Foundry com o que falta nos compêndios instalados:
 *
 *   t20-magias-dragao-brasil  → as 17 magias do Almanaque Dragão Brasil
 *   t20-poderes-que-faltam    → os poderes que nenhum pack traz (Herança de Drashantyr)
 *
 *   node scripts/gerar-modulos.mjs
 *
 * Os módulos são escritos direto em `X:/FoundryVTT/Data/modules/<id>` (module.json
 * + pack em LevelDB). Fonte dos dados: `magias-t20/dataset.json` (o dump do Grimório
 * que alimenta magias.raynathus.com.br) — texto da Jambo, por isso nada disso entra
 * no git; o que o repositório versiona é este gerador.
 *
 * ── Como automação funciona no Tormenta20 (tirado dos itens do sistema) ──
 * Tudo é Active Effect no item; o que muda é a flag `tormenta20`:
 *  - APRIMORAMENTO: `{ onuse: true, self: true, custo: "2" }`, `disabled: true`,
 *    `transfer: false`. O nome do efeito é o texto do aprimoramento e as mudanças
 *    usam as chaves da LINHA da magia — `execucao`, `alcance`, `alvo`, `area`,
 *    `duracao`, `resistencia`, `dano` — em modo 5 (troca). Quando o aprimoramento
 *    SOMA ("aumenta o dano em +2d6"), vai `aumenta: true` e modo 0 com o incremento.
 *  - EFEITO MECÂNICO: chave real da ficha em modo 2 (soma) —
 *    `system.attributes.defesa.bonus`, `system.tracos.resistencias.fogo.value`,
 *    `system.attributes.pm.bonus.total`, `system.attributes.movement.fly`.
 *  - PASSIVO de poder/raça: `transfer: true` (vai para a ficha junto do item).
 *  - TEMPORÁRIO de cena: `transfer: false` + `flags.tormenta20.durationScene`
 *    e `duration.rounds: 999` (é assim que Armadura Arcana dá +5 Defesa).
 *
 * ── Formato do pack (LevelDB, v11+) ──
 *   !folders!<id>                     a pasta
 *   !items!<id>                       o item — e `item.effects` é a LISTA DE IDS
 *                                     dos efeitos (não os documentos, nem vazio:
 *                                     sem os ids o Foundry carrega o item SEM
 *                                     aprimoramento nenhum)
 *   !items.effects!<item>.<efeito>    cada Active Effect
 */
import { rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOUNDRY_CODE = process.env.FOUNDRY_CODE ?? "X:/FoundryVTT/Code";
const FOUNDRY_DATA = process.env.FOUNDRY_DATA ?? "X:/FoundryVTT/Data";
const DATASET = process.env.MAGIAS_DATASET ?? "X:/Soltos/magias-t20/dataset.json";

/** PM da magia pelo círculo (LB p.104). */
const PM_POR_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

const GRUPO = { Arcana: "arc", Divina: "div", Universal: "uni" };
const ESCOLA = {
  Abjuração: "abj",
  Adivinhação: "adv",
  Convocação: "con",
  Encantamento: "enc",
  Evocação: "evo",
  Ilusão: "ilu",
  Necromancia: "nec",
  Transmutação: "tra",
};
const EXECUCAO = { padrao: "action", completa: "full", movimento: "move", reacao: "reaction", livre: "free", longa: "hour" };
const ALCANCE = { pessoal: "self", toque: "touch", curto: "short", medio: "medium", longo: "long", ilimitado: "any" };
const DURACAO = { instantanea: "inst", "1rodada": "round", cena: "scene", sustentada: "sust", "1dia": "day", permanente: "perm", outro: "special" };

/**
 * Ícone e dano de cada magia que falta. O dataset só guarda UM dano; as que causam
 * dois tipos ("4d8 de ácido mais 4d8 de veneno") vêm anotadas aqui. `veneno` não é
 * tipo de rolagem no sistema — a segunda parte fica sem tipo.
 */
const MAGIAS = {
  "armadura-gelida": { img: "armadura-arcana" },
  "aura-restauradora": { img: "circulo-da-restauracao" },
  "bencao-da-dragoa-rainha": {
    img: "bencao",
    // "Você recebe deslocamento de voo 18m" — o resto (imunidades) é texto.
    passivo: [{ key: "system.attributes.movement.fly", mode: 5, value: "18" }],
  },
  chuva: { img: "controlar-clima" },
  "detonacao-congelante": { img: "erupcao-glacial", dano: [["2d6", "frio"]] },
  "disparo-gelido": { img: "raio-polar", dano: [["2d8+2", "frio"]] },
  "geiser-caustico": { img: "flecha-acida", dano: [["2d6", "acido"]] },
  "halito-peconhento": { img: "miasma-mefitico", dano: [["4d8", "acido"], ["4d8", ""]] },
  "impacto-fulminante": { img: "relampago", dano: [["4d6", "eletricidade"], ["4d6", "impacto"]] },
  necrofogo: { img: "explosao-de-chamas", dano: [["3d6", "fogo"], ["3d6", "trevas"]] },
  "nuvem-tempestuosa": { img: "nevoa", dano: [["2d8", "eletricidade"]] },
  "pantano-vitriolico": { img: "controlar-agua", dano: [["5d8", "acido"]] },
  "raio-de-plasma": { img: "raio-solar", dano: [["10d8", "fogo"]] },
  "toque-algido": { img: "erupcao-glacial", dano: [["6d8", "frio"]] },
  "toque-congelante": { img: "toque-chocante", dano: [["2d8+2", "frio"]] },
  "velocidade-do-relampago": { img: "velocidade", dano: [["6d8", "eletricidade"]] },
  "ventania-mistica": { img: "sopro-das-uivantes" },
};

/** Mudança extra em aprimoramento cujo efeito é número na ficha. */
const APRIMORAMENTO_EXTRA = {
  // Armadura Gélida, +2 PM: "a armadura também concede +5 na Defesa".
  "armadura-gelida": { "+5 na Defesa": [{ key: "system.attributes.defesa.bonus", mode: 2, value: "5" }] },
};

/** Poderes que faltam no compêndio (texto do livro em textos.json). */
const PODERES = [
  {
    slug: "heranca_de_drashantyr",
    nome: "Herança de Drashantyr",
    pasta: "Deuses de Arton",
    subtipo: "Suraggel",
    img: "systems/tormenta20/icons/racas/suraggel.webp",
    fonte: "T20 - Deuses de Arton (pág. 36)",
    // "+1 PM e redução de ácido, eletricidade, fogo, frio, luz e trevas 5."
    changes: [
      { key: "system.attributes.pm.bonus.total", mode: 2, value: "1" },
      ...["acido", "eletricidade", "fogo", "frio", "luz", "trevas"].map((t) => ({
        key: `system.tracos.resistencias.${t}.value`,
        mode: 2,
        value: "5",
      })),
    ],
  },
];

/** Id de 16 caracteres estável por slug — rodar de novo não duplica item. */
function idDe(prefixo, slug) {
  let h = 0x811c9dc5;
  for (const c of slug) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (prefixo + h.toString(36) + slug.replace(/[^a-z0-9]/g, "")).padEnd(16, "0").slice(0, 16);
}

const stats = () => ({
  systemId: "tormenta20",
  systemVersion: "1.5.015",
  coreVersion: "13.351",
  createdTime: null,
  modifiedTime: null,
  lastModifiedBy: null,
  compendiumSource: null,
  duplicateSource: null,
  exportSource: null,
});

function efeitoBase(id, nome, img, changes, flags, extra = {}) {
  return {
    _id: id,
    name: nome,
    img,
    type: "base",
    changes: changes.map((c) => ({ priority: null, ...c })),
    disabled: true,
    transfer: false,
    duration: { startTime: null, seconds: null, combat: null, rounds: null, turns: null, startRound: null, startTurn: null },
    description: "",
    origin: null,
    tint: "#ffffff",
    statuses: [],
    sort: 0,
    flags: { tormenta20: flags },
    system: {},
    _stats: stats(),
    ...extra,
  };
}

/** Aprimoramento → Active Effect (ver o cabeçalho: onuse/custo/aumenta). */
function efeitoDoAprimoramento(magiaSlug, apr, i, itemId) {
  const changes = [];
  let aumenta = false;
  for (const d of apr.deltas ?? []) {
    switch (d.tipo) {
      case "duracao->":
        changes.push({ key: "duracao", mode: 5, value: String(d.valor) });
        break;
      case "execucao->":
        changes.push({ key: "execucao", mode: 5, value: String(d.valor) });
        break;
      case "alcance->":
        changes.push({ key: "alcance", mode: 5, value: String(d.valor) });
        break;
      case "alvo->":
        changes.push({ key: "alvo", mode: 5, value: String(d.valor) });
        break;
      case "area->":
        changes.push({ key: "area", mode: 5, value: String(d.valor) });
        break;
      case "resistencia->":
        changes.push({ key: "resistencia", mode: 5, value: String(d.valor) });
        break;
      case "alvos+":
        changes.push({ key: "alvo", mode: 2, value: String(d.valor) });
        aumenta = true;
        break;
      case "dano+":
        changes.push({ key: "dano", mode: 0, value: String(d.valor) });
        aumenta = true;
        break;
      default:
        break; // "substitui"/"efeito-novo": só texto, o efeito é o próprio aprimoramento
    }
  }
  for (const [trecho, extras] of Object.entries(APRIMORAMENTO_EXTRA[magiaSlug] ?? {})) {
    if (apr.texto.includes(trecho)) changes.push(...extras);
  }
  const flags = { onuse: true, self: true, aumenta, durationScene: false };
  if (!apr.truque) flags.custo = String(apr.pm);
  return efeitoBase(idDe("apr", `${magiaSlug}${i}`), apr.texto.trim(), "icons/svg/upgrade.svg", changes, flags, {
    origin: `Item.${itemId}`,
  });
}

function magiaItem(m, pastaId) {
  const meta = MAGIAS[m.slug];
  const id = idDe("mag", m.slug);
  const area = m.alvo?.tipo === "area" ? m.alvo.bruto : "";
  const dano = meta.dano ?? (m.dano ? [[m.dano.dados, m.dano.tipo ?? ""]] : []);
  const efeitos = m.aprimoramentos.map((a, i) => efeitoDoAprimoramento(m.slug, a, i, id));
  if (meta.passivo) {
    efeitos.push(
      efeitoBase(idDe("pas", m.slug), m.nome, `systems/tormenta20/icons/magias/${meta.img}.webp`, meta.passivo, { onuse: false, durationScene: true }, {
        disabled: false,
        duration: { startTime: null, seconds: null, combat: null, rounds: 999, turns: null, startRound: null, startTurn: null },
        origin: `Item.${id}`,
      })
    );
  }
  const item = {
    _id: id,
    name: m.nome,
    type: "magia",
    img: `systems/tormenta20/icons/magias/${meta.img}.webp`,
    // A LISTA DE IDS é o que liga os aprimoramentos ao item dentro do pack.
    effects: efeitos.map((e) => e._id),
    folder: pastaId,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: stats(),
    system: {
      description: { value: `<p>${m.descricao}</p>`, chat: "", unidentified: "" },
      source: `T20 - ${m.publicacao}`,
      ativacao: { execucao: EXECUCAO[m.execucao.cat] ?? "action", custo: PM_POR_CIRCULO[m.circulo], qtd: "", condicao: "", special: "" },
      duracao: { value: 0, units: DURACAO[m.duracao.cat] ?? "special", special: "" },
      target: { value: null, width: null, units: "", type: "" },
      range: { value: null, units: "" },
      consume: { type: "", target: "", amount: null, mpMultiplier: false },
      efeito: "",
      alcance: ALCANCE[m.alcance.cat] ?? "short",
      alvo: area ? "" : (m.alvo?.bruto ?? ""),
      area,
      resistencia: { pericia: "", atributo: "", bonus: null, txt: m.resistencia.bruto ?? "" },
      rolls: dano.length ? [{ name: "Dano", key: "dano0", type: "dano", parts: dano.map(([f, t]) => [f, t, ""]), versatil: "" }] : [],
      tipo: GRUPO[m.grupo] ?? "arc",
      circulo: String(m.circulo),
      preparada: false,
      escola: ESCOLA[m.escola] ?? "evo",
      chatFlavor: "",
      origin: "",
      tags: [],
      chatGif: "",
    },
  };
  return { item, efeitos };
}

function poderItem(p, textos, pastaId) {
  const id = idDe("pod", p.slug);
  const texto = textos[p.slug] ?? "";
  if (!texto) throw new Error(`sem texto do livro para ${p.slug} (rode "npm run textos")`);
  // Passivo de item: `transfer: true` leva o efeito para a ficha com o poder.
  const efeitos = [
    efeitoBase(idDe("pef", p.slug), p.nome, p.img, p.changes, { onuse: false, durationScene: false }, {
      disabled: false,
      transfer: true,
      origin: `Item.${id}`,
    }),
  ];
  return {
    item: {
      _id: id,
      name: p.nome,
      type: "poder",
      img: p.img,
      effects: efeitos.map((e) => e._id),
      folder: pastaId,
      sort: 0,
      ownership: { default: 0 },
      flags: {},
      _stats: stats(),
      system: {
        description: { value: `<p>${texto}</p>`, chat: "", unidentified: "" },
        source: p.fonte,
        ativacao: { execucao: "passive", custo: 0, qtd: "", condicao: "", special: "" },
        duracao: { value: 0, units: "inst", special: "" },
        target: { value: null, width: null, units: "", type: "" },
        range: { value: null, units: "" },
        consume: { type: "", target: "", amount: null, mpMultiplier: false },
        efeito: "",
        requisitos: "",
        tipo: "racial",
        subtipo: p.subtipo,
        rolls: [],
        tags: [],
        chatFlavor: "",
        chatGif: "",
      },
    },
    efeitos,
  };
}

const pasta = (id, nome, sort, mae = null) => ({
  _id: id,
  name: nome,
  type: "Item",
  description: "",
  folder: mae,
  sorting: "a",
  sort,
  color: null,
  flags: {},
  _stats: stats(),
});

/** Escreve um módulo inteiro: module.json + pack em LevelDB. */
async function escreverModulo({ id, titulo, descricao, pack, rotulo, pastas, docs }) {
  const raiz = join(FOUNDRY_DATA, "modules", id);
  const destino = join(raiz, "packs", pack);
  // O Foundry segura o LOCK do pack enquanto o mundo está aberto — regerar por
  // cima corrompe. Melhor parar e avisar.
  if (existsSync(join(destino, "LOCK"))) {
    try {
      rmSync(join(destino, "LOCK"));
    } catch {
      throw new Error(`o pack "${pack}" está aberto no Foundry — feche o mundo (ou o Foundry) e rode de novo`);
    }
  }
  if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });

  writeFileSync(
    join(raiz, "module.json"),
    JSON.stringify(
      {
        id,
        title: titulo,
        description: descricao,
        version: "1.0.0",
        compatibility: { minimum: "13", verified: "13" },
        relationships: {
          requires: [{ id: "tormenta20", type: "system", compatibility: { minimum: "1.5.0" } }],
        },
        packs: [
          {
            name: pack,
            label: rotulo,
            path: `packs/${pack}`,
            type: "Item",
            system: "tormenta20",
            ownership: { PLAYER: "OBSERVER", ASSISTANT: "OWNER" },
            flags: {},
          },
        ],
        authors: [{ name: "RaymundoJMSN" }],
        flags: {},
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const { ClassicLevel } = await import(pathToFileURL(join(FOUNDRY_CODE, "resources/app/node_modules/classic-level/index.js")).href);
  const db = new ClassicLevel(destino, { valueEncoding: "json" });
  await db.open();
  const lote = db.batch();
  for (const f of pastas) lote.put(`!folders!${f._id}`, f);
  let nEfeitos = 0;
  for (const { item, efeitos } of docs) {
    lote.put(`!items!${item._id}`, item);
    for (const e of efeitos) lote.put(`!items.effects!${item._id}.${e._id}`, e);
    nEfeitos += efeitos.length;
  }
  await lote.write();
  await db.close();
  console.log(`${raiz}: ${docs.length} itens, ${nEfeitos} efeitos, ${pastas.length} pasta(s)`);
}

// ── Magias do Almanaque Dragão Brasil ──────────────────────────────────────
const dataset = JSON.parse(await readFile(DATASET, "utf8"));
const magias = dataset.magias.filter((m) => MAGIAS[m.slug]);
const faltando = Object.keys(MAGIAS).filter((s) => !magias.some((m) => m.slug === s));
if (faltando.length) throw new Error(`magias fora do dataset: ${faltando.join(", ")}`);

/**
 * Três níveis: tradição → círculo → escola ("D2 Abjuração"). Só nasce pasta que
 * tem magia dentro — nada de pasta vazia.
 */
const TRADICAO = { arc: ["Arcanas", "A"], div: ["Divina", "D"], uni: ["Universal", "U"] };
const pastasMagia = [];
const pastaDaMagia = new Map();
const feitas = new Map();
const criar = (chave, nome, sort, mae) => {
  if (!feitas.has(chave)) {
    const f = pasta(idDe("fld", chave), nome, sort, mae);
    feitas.set(chave, f);
    pastasMagia.push(f);
  }
  return feitas.get(chave);
};
for (const m of magias) {
  const trad = GRUPO[m.grupo] ?? "arc";
  const [nomeTrad, letra] = TRADICAO[trad];
  const escola = m.escola;
  const raiz = criar(trad, nomeTrad, ["arc", "div", "uni"].indexOf(trad), null);
  const circulo = criar(`${trad}${m.circulo}`, `${m.circulo}º Círculo`, m.circulo, raiz._id);
  const folha = criar(`${trad}${m.circulo}${ESCOLA[escola]}`, `${letra}${m.circulo} ${escola}`, m.circulo, circulo._id);
  pastaDaMagia.set(m.slug, folha._id);
}
await escreverModulo({
  id: "t20-magias-dragao-brasil",
  titulo: "T20 — Magias do Almanaque Dragão Brasil",
  descricao:
    "As 17 magias do Almanaque Dragão Brasil que não vêm no sistema nem no Suplementos de Arton, " +
    "com linha completa, dano por tipo e os aprimoramentos como efeito.",
  pack: "magias-dragao-brasil",
  rotulo: "Magias — Almanaque Dragão Brasil",
  pastas: pastasMagia,
  docs: magias.map((m) => magiaItem(m, pastaDaMagia.get(m.slug))),
});

// ── Poderes que faltam ─────────────────────────────────────────────────────
const textos = JSON.parse(await readFile(resolve(HERE, "../src/data/textos.json"), "utf8")).poderes ?? {};
const pastasPoder = new Map();
for (const p of PODERES) {
  if (!pastasPoder.has(p.pasta)) {
    pastasPoder.set(p.pasta, pasta(idDe("pst", p.pasta), p.pasta, pastasPoder.size));
  }
}
await escreverModulo({
  id: "t20-poderes-que-faltam",
  titulo: "T20 — Poderes que faltam",
  descricao: "Poderes dos livros que nenhum compêndio instalado traz, com os efeitos já automatizados.",
  pack: "poderes-que-faltam",
  rotulo: "Poderes que faltam",
  pastas: [...pastasPoder.values()],
  docs: PODERES.map((p) => poderItem(p, textos, pastasPoder.get(p.pasta)._id)),
});
