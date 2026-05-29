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
}

// 6. poderes-por-nivel.json — poder count per class per level
{
  const src = readJson(join(T20DB, "regras/progressao_classes.json"));
  const result = {};
  for (const [classeId, classeData] of Object.entries(src.classes ?? {})) {
    const porNivel = {};
    const tabela = classeData.tabela_progressao ?? {};
    for (const [nivel, dados] of Object.entries(tabela)) {
      const escolhas = dados.escolhas ?? [];
      const poderesDaClasse = escolhas.filter(
        (e) => e.tipo === "poder_classe" || e.tipo === "poder_geral"
      ).length;
      if (poderesDaClasse > 0) porNivel[nivel] = poderesDaClasse;
    }
    result[classeId] = porNivel;
  }
  writeJson(join(OUT, "poderes-por-nivel.json"), result);
}

// 7. slug-map.json — empty override map
{
  writeJson(join(OUT, "slug-map.json"), {});
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

    result[classeId] = {
      pericias_inatas: classeData.pericias_inatas ?? [],
      pericias_escolha,
      pericias_numero,
      pv_por_nivel: classeData.pv_por_nivel ?? null,
      pm_por_nivel: classeData.pm_por_nivel ?? null,
    };
  }
  writeJson(join(OUT, "progressao_classes.json"), result);
}

console.log("Done.");
