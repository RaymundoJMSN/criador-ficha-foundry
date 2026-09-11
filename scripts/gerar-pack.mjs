/**
 * Compêndio próprio do módulo: o que falta nos compêndios instalados.
 *
 *   node scripts/gerar-pack.mjs
 *
 * Hoje são as 17 magias do Almanaque Dragão Brasil que nem o sistema nem o
 * "Suplementos de Arton" trazem, e a Herança de Drashantyr (Deuses de Arton,
 * a única das 22 heranças planares que ficou de fora do pacote).
 *
 * Fonte dos dados: `magias-t20/dataset.json` (o dump do Grimório que alimenta
 * magias.raynathus.com.br) — texto da Jambo, então `packs/` fica FORA do git,
 * igual a textos.json. O que o repositório versiona é este gerador: estrutura,
 * ícones e automação.
 *
 * ── Como automação funciona no Tormenta20 (tirado dos itens do sistema) ──
 * Tudo é Active Effect no item; o que muda é a flag `tormenta20`:
 *  - APRIMORAMENTO: `{ onuse: true, self: true, custo: "2" }`, `disabled: true`,
 *    `transfer: false`. O nome do efeito é o texto do aprimoramento e as
 *    mudanças usam as chaves da LINHA da magia — `execucao`, `alcance`, `alvo`,
 *    `area`, `duracao`, `resistencia`, `dano` — em modo 5 (troca). Quando o
 *    aprimoramento SOMA em vez de trocar ("aumenta o dano em +2d6"), vai
 *    `aumenta: true` e a mudança em modo 0 com só o incremento.
 *  - EFEITO MECÂNICO: chave real da ficha em modo 2 (soma) —
 *    `system.attributes.defesa.bonus`, `system.tracos.resistencias.fogo.value`,
 *    `system.attributes.pm.bonus.total`, `system.attributes.movement.fly`.
 *  - PASSIVO de poder/raça: `transfer: true` (vai para a ficha junto do item).
 *  - TEMPORÁRIO de cena: `transfer: false` + `flags.tormenta20.durationScene`
 *    e `duration.rounds: 999` (é assim que Armadura Arcana dá +5 Defesa).
 *
 * O pack é LevelDB, como todo compêndio do v11+: `!items!<id>` para o item,
 * `!items.effects!<item>.<efeito>` para cada AE e `!folders!<id>` para a pasta.
 */
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOUNDRY_CODE = process.env.FOUNDRY_CODE ?? "X:/FoundryVTT/Code";
const DATASET = process.env.MAGIAS_DATASET ?? "X:/Soltos/magias-t20/dataset.json";
const DESTINO = resolve(HERE, "../packs/t20w-extras");

const PASTA_MAGIAS = "t20wmagiasdb0001";
const PASTA_PODERES = "t20wpoderes00001";

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
 * Ícone e dano de cada magia que falta. O dataset só guarda UM dano; as que
 * causam dois tipos ("4d8 de ácido mais 4d8 de veneno") vêm anotadas aqui.
 * `veneno` não é tipo de rolagem no sistema — a segunda parte fica sem tipo.
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
  systemVersion: "1.4.214",
  coreVersion: "13.344",
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
function efeitoDoAprimoramento(magiaSlug, apr, i, itemId, img) {
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
    img: "icons/svg/upgrade.svg",
  });
}

function magiaItem(m) {
  const meta = MAGIAS[m.slug];
  const id = idDe("mag", m.slug);
  const area = m.alvo?.tipo === "area" ? m.alvo.bruto : "";
  const dano = meta.dano ?? (m.dano ? [[m.dano.dados, m.dano.tipo ?? ""]] : []);
  const efeitos = m.aprimoramentos.map((a, i) => efeitoDoAprimoramento(m.slug, a, i, id, meta.img));
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
    folder: PASTA_MAGIAS,
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

function poderItem(p, textos) {
  const id = idDe("pod", p.slug);
  const texto = textos[p.slug] ?? "";
  if (!texto) throw new Error(`sem texto do livro para ${p.slug} (rode "npm run textos")`);
  return {
    item: {
      _id: id,
      name: p.nome,
      type: "poder",
      img: p.img,
      folder: PASTA_PODERES,
      sort: 0,
      ownership: { default: 0 },
      flags: {},
      _stats: stats(),
      system: {
        description: { value: `<p>${texto}</p>`, chat: "", unidentified: "" },
        source: p.fonte,
        ativacao: { execucao: "passive", custo: 0, qtd: "", condicao: "", special: "" },
        duracao: { value: 0, units: "", special: "" },
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
    // Passivo de item: `transfer: true` leva o efeito para a ficha com o poder.
    efeitos: [
      efeitoBase(idDe("pef", p.slug), p.nome, p.img, p.changes, { onuse: false, durationScene: false }, {
        disabled: false,
        transfer: true,
        origin: `Item.${id}`,
      }),
    ],
  };
}

const pasta = (id, nome, sort) => ({
  _id: id,
  name: nome,
  type: "Item",
  description: "",
  folder: null,
  sorting: "a",
  sort,
  color: null,
  flags: {},
  _stats: stats(),
});

const dataset = JSON.parse(await readFile(DATASET, "utf8"));
const textos = JSON.parse(await readFile(resolve(HERE, "../src/data/textos.json"), "utf8")).poderes ?? {};
const magias = dataset.magias.filter((m) => MAGIAS[m.slug]);
const faltando = Object.keys(MAGIAS).filter((s) => !magias.some((m) => m.slug === s));
if (faltando.length) throw new Error(`magias fora do dataset: ${faltando.join(", ")}`);

const { ClassicLevel } = await import(pathToFileURL(join(FOUNDRY_CODE, "resources/app/node_modules/classic-level/index.js")).href);
if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
const db = new ClassicLevel(DESTINO, { valueEncoding: "json" });
await db.open();
const lote = db.batch();
lote.put(`!folders!${PASTA_MAGIAS}`, pasta(PASTA_MAGIAS, "Magias — Almanaque Dragão Brasil", 0));
lote.put(`!folders!${PASTA_PODERES}`, pasta(PASTA_PODERES, "Poderes — Deuses de Arton", 100));
let nEfeitos = 0;
for (const m of magias) {
  const { item, efeitos } = magiaItem(m);
  lote.put(`!items!${item._id}`, item);
  for (const e of efeitos) lote.put(`!items.effects!${item._id}.${e._id}`, e);
  nEfeitos += efeitos.length;
}
for (const p of PODERES) {
  const { item, efeitos } = poderItem(p, textos);
  lote.put(`!items!${item._id}`, item);
  for (const e of efeitos) lote.put(`!items.effects!${item._id}.${e._id}`, e);
  nEfeitos += efeitos.length;
}
await lote.write();
await db.close();
console.log(`${DESTINO}: ${magias.length} magias + ${PODERES.length} poder(es), ${nEfeitos} efeitos`);
