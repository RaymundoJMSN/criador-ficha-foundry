// @ts-check
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const T20DB = resolve("E:/rayna/Documents/Claude/Projects/Ideias e RPG/T20-DB/data");
const OUT = resolve("E:/rayna/Documents/Claude/Projects/Modulo Foundry Ficha/src/data");

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

console.log("Done.");
