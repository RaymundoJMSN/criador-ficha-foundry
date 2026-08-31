// @ts-check
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url)); // scripts/
// T20-DB is a sibling project under .../Projects/. Override with T20DB_ROOT env.
const T20DB_ROOT = process.env.T20DB_ROOT ?? resolve(HERE, "../../Ideias e RPG/T20-DB");
const T20DB = join(T20DB_ROOT, "data");
const OUT = resolve(HERE, "../src/data");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`✓ ${path}`);
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

// 1. atributos.json — point buy + method list
{
  const src = readJson(join(T20DB, "atributos/atributos.json"));
  const compra = src.metodos_definicao.find((m) => m.id === "compra_pontos");
  writeJson(join(OUT, "atributos.json"), {
    compra_pontos: compra.compra_pontos,
    metodos: src.metodos_definicao.map((m) => ({
      id: m.id,
      nome: m.nome,
      tipo: m.tipo,
      categoria: m.categoria,
    })),
    tabela_conversao_padrao: src.tabela_conversao_padrao,
  });
}

// 2. dinheiro.json — initial money per level
{
  const src = readJson(join(T20DB, "regras/equipamento_inicial.json"));
  writeJson(join(OUT, "dinheiro.json"), {
    por_nivel: src.dinheiro_inicial_por_nivel,
    nivel_1_dado: "4d6",
  });
}

// 3. origens.json — all origens consolidated
{
  const origemDir = join(T20DB, "origens");
  const origens = readdirSync(origemDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const o = readJson(join(origemDir, f));
      return {
        id: o.id,
        nome: o.nome,
        itens_iniciais: o.itens_iniciais ?? [],
        beneficios: {
          pericias: o.beneficios?.pericias ?? [],
          poderes: o.beneficios?.poderes ?? [],
          poder_unico_id: o.beneficios?.poder_unico_id ?? null,
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "origens.json"), origens);
}

// 4. divindades.json — all divindades consolidated
{
  const divDir = join(T20DB, "divindades");
  const divindades = readdirSync(divDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const d = readJson(join(divDir, f));
      return {
        id: d.id,
        nome: d.nome,
        devotos_aceitos: d.devotos_aceitos,
        poderes_concedidos: d.poderes_concedidos ?? [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "divindades.json"), divindades);
}

// 5. prereqs.json — slug → pre_requisitos[] from all poder files
{
  const poderFiles = walkDir(join(T20DB, "poderes"));
  const prereqs = {};
  for (const f of poderFiles) {
    try {
      const p = readJson(f);
      if (p.id && Array.isArray(p.pre_requisitos) && p.pre_requisitos.length > 0) {
        prereqs[p.id] = p.pre_requisitos;
      }
    } catch {
      // skip malformed
    }
  }
  writeJson(join(OUT, "prereqs.json"), prereqs);

  // 5b. poder-subcategoria.json — slug → subcategoria. Só os pré-requisitos
  // `poder_subcategoria`/`poder_tipo` precisam disso (contar poderes de um grupo).
  const subcats = {};
  for (const f of poderFiles) {
    try {
      const p = readJson(f);
      if (p.id && p.subcategoria) subcats[p.id] = p.subcategoria;
    } catch {
      // skip malformed
    }
  }
  writeJson(join(OUT, "poder-subcategoria.json"), subcats);
}

// 8. racas.json — all raças consolidated
{
  const racasDir = join(T20DB, "racas");
  const racas = readdirSync(racasDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const r = readJson(join(racasDir, f));

      // Fixed attribute bonuses (tipo === "fixo")
      const atributos_fixos =
        r.modificadores_atributo?.tipo === "fixo"
          ? (r.modificadores_atributo.fixos ?? []).map((b) => ({
              atributo: b.atributo,
              valor: b.valor,
            }))
          : [];

      // Choosable attribute bonuses (tipo === "escolha")
      const atributos_escolha =
        r.modificadores_atributo?.tipo === "escolha"
          ? (r.modificadores_atributo.escolhas ?? []).map((e) => ({
              valor: e.valor,
              quantidade: e.quantidade,
              atributos_diferentes: e.atributos_diferentes ?? false,
              observacao: e.observacao ?? null,
            }))
          : [];

      // Bonus pericias from habilidades_raca effects
      const bonus_pericias = [];
      for (const hab of r.habilidades_raca ?? []) {
        for (const ef of hab.efeitos ?? []) {
          if (ef.tipo === "bonus_pericia" && Array.isArray(ef.pericias)) {
            bonus_pericias.push(...ef.pericias.map((p) => ({ pericia: p, valor: ef.valor ?? 0 })));
          }
        }
      }

      // Bonus skill training (treinar_pericia) from habilidades_raca effects
      const treinar_pericias = [];
      for (const hab of r.habilidades_raca ?? []) {
        for (const ef of hab.efeitos ?? []) {
          if (ef.tipo === "treinar_pericia") {
            treinar_pericias.push({
              tipo: ef.escolha?.tipo ?? "especificada",
              quantidade: ef.escolha?.quantidade ?? 1,
            });
          }
        }
      }

      return {
        id: r.id,
        nome: r.nome,
        descricao: r.descricao ?? null,
        tamanho: r.tamanho ?? null,
        deslocamento: r.deslocamento?.terrestre ?? null,
        atributos_fixos,
        atributos_escolha,
        bonus_pericias,
        treinar_pericias,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(join(OUT, "racas.json"), racas);
}

// 9. progressao_classes.json — skills + pv/pm per class
{
  const src = readJson(join(T20DB, "regras/progressao_classes.json"));
  const result = {};
  for (const [classeId, classeData] of Object.entries(src.classes ?? {})) {
    // Flatten pericias_escolha into a single options list + number to pick
    const escolhaBlocos = classeData.pericias_escolha ?? [];
    const pericias_escolha = escolhaBlocos.flatMap((b) => b.opcoes ?? []);
    const pericias_numero = escolhaBlocos.reduce((sum, b) => sum + (b.quantidade ?? 0), 0);

    // Level axis: automatic class abilities + how many power picks each level grants.
    // This is the only place that knows WHEN something is gained — writer, poderes
    // and magias all derive from it (see rules/progressao.ts).
    const tabelaSrc = classeData.tabela_progressao ?? {};
    const tabela = {};
    for (const [nivel, dados] of Object.entries(tabelaSrc)) {
      const automaticos = (dados.automaticos ?? [])
        .filter((a) => a.tipo === "habilidade_classe")
        .map((a) => a.poder_id);
      const escolhas = (dados.escolhas ?? []).filter(
        (e) => e.tipo === "poder_classe" || e.tipo === "poder_geral"
      ).length;
      if (automaticos.length > 0 || escolhas > 0) tabela[nivel] = { automaticos, escolhas };
    }

    // Spell circle unlocks live in the per-class file, not in regras/.
    const circulos = {};
    try {
      const rich = readJson(join(T20DB, "classes", `${classeId}.json`));
      for (const row of rich.tabela_progressao ?? []) {
        for (const h of row.habilidades ?? []) {
          const m = /^magias_(\d+)_circulo$/.exec(h);
          if (m) circulos[String(row.nivel)] = Number(m[1]);
        }
      }
    } catch {
      // class without a rich file — no spell progression
    }

    result[classeId] = {
      pericias_inatas: classeData.pericias_inatas ?? [],
      pericias_escolha,
      pericias_numero,
      pv_por_nivel: classeData.pv_por_nivel ?? null,
      pm_por_nivel: classeData.pm_por_nivel ?? null,
      tabela,
      circulos,
    };
  }
  writeJson(join(OUT, "progressao_classes.json"), result);
}

// 10. classes.json — canonical per-class rules (rich source: data/classes/*.json)
//     This is the AUTHORITATIVE perícia/pv/pm/progression source. Foundry's
//     classe item carries NO rules — only the item to attach to the actor.
{
  const normPericia = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  // Multipath choices (Arcanista → Bruxo/Mago/Feiticeiro) live in the class's
  // "Caminho do X" poder file, as opcoes[]. The slug we emit is what
  // toNomeSlug() produces for the Foundry item name ("Caminho do Arcanista: Mago").
  function caminhosDaClasse(classeId) {
    const dir = join(T20DB, "poderes", "classe", classeId);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      return [];
    }
    for (const f of files) {
      if (!f.startsWith("caminho")) continue;
      const p = readJson(join(dir, f));
      const opcoes = p.opcoes ?? [];
      if (opcoes.length > 0) return opcoes.map((o) => `${p.id}_${o.id}`);
    }
    return [];
  }

  const dir = join(T20DB, "classes");
  const result = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const c = readJson(join(dir, file));
    const car = c.caracteristicas ?? {};
    const per = car.pericias ?? {};
    const pv = car.pontos_de_vida ?? {};
    const pm = car.pontos_de_mana ?? {};

    const escolhasRaw = per.escolhas ?? {};
    result[c.id] = {
      nome: c.nome ?? c.id,
      pericias: {
        fixas: (per.fixas ?? []).map(normPericia),
        escolhas_obrigatorias: (per.escolhas_obrigatorias ?? []).map((g) => ({
          quantidade: g.quantidade ?? 1,
          opcoes: (g.opcoes ?? []).map(normPericia),
        })),
        escolhas: {
          quantidade: escolhasRaw.quantidade ?? 0,
          opcoes: (escolhasRaw.opcoes ?? []).map(normPericia),
        },
      },
      pv: {
        inicial: pv.inicial ?? null,
        por_nivel: pv.por_nivel ?? null,
        soma_atributo_inicial: pv.soma_atributo_inicial ?? null,
        soma_atributo_por_nivel: pv.soma_atributo_por_nivel ?? null,
      },
      pm: { por_nivel: pm.por_nivel ?? 0 },
      proficiencias: car.proficiencias ?? [],
      habilidades_classe_ids: c.habilidades_classe_ids ?? [],
      poderes_classe_ids: c.poderes_classe_ids ?? [],
      caminhos: caminhosDaClasse(c.id),
    };
  }
  writeJson(join(OUT, "classes.json"), result);
}

console.log("Done.");
