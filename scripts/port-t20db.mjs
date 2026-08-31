// @ts-check
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
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
        // Alguns itens vêm como string solta ("traje da corte") e outros como
        // objeto; normalizar aqui evita que a UI descarte os primeiros.
        itens_iniciais: (o.itens_iniciais ?? []).map((it) =>
          typeof it === "string" ? { item: it } : it
        ),
        beneficios: {
          pericias: o.beneficios?.pericias ?? [],
          poderes: o.beneficios?.poderes ?? [],
          poder_unico_id: o.beneficios?.poder_unico_id ?? null,
          // "um poder de combate a sua escolha" (Capanga, Gladiador, Guarda,
          // Soldado) e "um poder da Tormenta" (Assistente de Laboratório).
          poderes_categoria_livre: o.beneficios?.poderes_categoria_livre ?? [],
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
  const titulo = (t) =>
    String(t)
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  // `modificadores_atributo` tem quatro formas. Ler só "fixo" e "escolha" deixava
  // Osteon e Lefou (ambos "misto") sem nenhum atributo racial na ficha.
  //   fixo        → fixos[]
  //   escolha     → escolhas[]
  //   misto       → fixos[] + escolhas[]  (Osteon: Con -1 e +1 em três outros)
  //   alternativo → cada alternativa é uma raça própria no compêndio
  //                 (Suraggel vira os itens "Aggelus" e "Sulfure")
  function fixosDe(lista) {
    return (lista ?? []).map((b) => ({ atributo: b.atributo, valor: b.valor }));
  }
  function escolhasDe(lista) {
    return (lista ?? []).map((e) => ({
      valor: e.valor,
      quantidade: e.quantidade,
      atributos_diferentes: e.atributos_diferentes ?? false,
      // Sem isto, Lefou aceitaria +1 em Carisma — que é justamente o proibido.
      atributos_disponiveis: e.atributos_disponiveis ?? null,
      observacao: e.observacao ?? null,
    }));
  }

  /**
   * Escolhas que uma habilidade racial impõe. Três formas no T20-DB:
   *   - `efeitos[].escolha`            → escolha direta (perícia, tipo de dano, magia)
   *   - `efeitos[].escolha_de_efeitos` → ramos ("treine 1 perícia OU ganhe 1 poder")
   *   - `habilidade.alternativa`       → mais um ramo ("ser osteon de outra raça")
   * Aqui viram uma forma só: uma escolha com ramos, cada ramo dizendo o que pedir.
   */
  function pedidoDoEfeito(efeito, escolha) {
    const tipo = escolha?.tipo ?? "";
    if (Array.isArray(escolha?.opcoes) && escolha.opcoes.length > 0) {
      return {
        tipo: "lista",
        quantidade: escolha.quantidade ?? 1,
        opcoes: escolha.opcoes.map((o) => ({
          id: typeof o === "string" ? o : o.id,
          rotulo:
            typeof o === "string"
              ? titulo(o)
              : `${titulo(o.id)}${o.tipo_dano ? ` (${o.tipo_dano})` : ""}`,
        })),
      };
    }
    if (tipo === "magia") {
      return { tipo: "magia", quantidade: escolha.quantidade ?? 1, circulo: escolha.filtro?.circulo ?? 1 };
    }
    if (tipo.includes("pericia")) {
      // bonus_pericia dá +N na perícia; treinar_pericia deixa treinado.
      const bonus = efeito?.tipo === "bonus_pericia" ? (efeito.valor ?? 0) : 0;
      return {
        tipo: "pericia",
        quantidade: escolha.quantidade ?? 1,
        bonus,
        filtro: tipo === "pericia_oficio_especifico" ? "oficio" : null,
      };
    }
    return null;
  }

  function pedidoDaOpcao(o) {
    if (o.tipo === "treinar_pericia") return { tipo: "pericia", quantidade: o.quantidade ?? 1, bonus: 0 };
    if (o.tipo === "ganhar_poder")
      return { tipo: "poder", quantidade: o.quantidade ?? 1, categoria: o.categoria ?? "geral" };
    if (o.tipo === "bonus_pericia")
      return { tipo: "pericia", quantidade: o.quantidade ?? 1, bonus: o.valor ?? 2 };
    if (o.tipo === "misto") {
      const partes = (o.componentes ?? []).map(pedidoDaOpcao).filter(Boolean);
      return partes.length > 0 ? { tipo: "misto", partes } : null;
    }
    if (o.tipo === "herdar_habilidade_outra_raca")
      return { tipo: "habilidade_outra_raca", quantidade: 1, excluir: o.restricoes?.raca_excluida ?? [] };
    return null;
  }

  function rotuloDoPedido(pedido) {
    if (!pedido) return "Escolha";
    if (pedido.tipo === "pericia")
      return pedido.bonus
        ? `+${pedido.bonus} em ${pedido.quantidade} perícia(s)`
        : `Treinar ${pedido.quantidade} perícia(s)`;
    if (pedido.tipo === "poder") return `Ganhar 1 poder de ${pedido.categoria}`;
    if (pedido.tipo === "habilidade_outra_raca") return "Herdar 1 habilidade de outra raça";
    if (pedido.tipo === "magia") return `Aprender 1 magia de ${pedido.circulo}º círculo`;
    if (pedido.tipo === "misto") return pedido.partes.map(rotuloDoPedido).join(" + ");
    return "Escolha";
  }

  function escolhasDeHabilidades(r) {
    const escolhas = [];
    for (const hab of r.habilidades_raca ?? []) {
      // Versátil (humano) e Híbrido (kliren) entram como `treinar_pericia` e já
      // viram cota de perícia no passo Perícias. Repetir aqui daria o dobro.
      // ponytail: a alternativa do humano (trocar 1 perícia por 1 poder geral)
      // fica de fora enquanto as duas contagens não forem unificadas.
      if ((hab.efeitos ?? []).some((e) => e.tipo === "treinar_pericia")) continue;

      const ramos = [];
      let direto = null;

      for (const ef of hab.efeitos ?? []) {
        if (ef.tipo === "escolha_de_efeitos") {
          for (const o of ef.opcoes ?? []) {
            const pedido = pedidoDaOpcao(o);
            if (pedido) ramos.push({ id: o.id ?? o.tipo, rotulo: o.rotulo ?? rotuloDoPedido(pedido), pedido });
          }
        } else if (ef.escolha) {
          direto = pedidoDoEfeito(ef, ef.escolha) ?? direto;
        }
      }

      const alt = hab.alternativa;
      if (alt) {
        if (Array.isArray(alt.opcoes)) {
          for (const o of alt.opcoes) {
            const pedido = pedidoDaOpcao(o);
            if (pedido) ramos.push({ id: o.id ?? o.tipo, rotulo: o.rotulo ?? rotuloDoPedido(pedido), pedido });
          }
        } else {
          for (const ef of alt.efeitos ?? []) {
            const pedido = pedidoDaOpcao(ef);
            if (pedido) ramos.push({ id: "alternativa", rotulo: alt.descricao ?? "Alternativa", pedido });
          }
        }
      }

      // Com ramos, o "direto" é sempre o primeiro ramo repetido — descartar.
      if (ramos.length > 0) direto = null;
      if (ramos.length === 0 && !direto) continue;

      // Perícia treinada sem bônus já é resolvida no passo Perícias
      // (getRaceSkillBonus + picks.raca). Repetir aqui contaria duas vezes.
      const soTreinoDePericia =
        !direto || (direto.tipo === "pericia" && !direto.bonus);
      const ramosSoTreino =
        ramos.length > 0 && ramos.every((x) => x.pedido.tipo === "pericia" && !x.pedido.bonus);
      if ((ramos.length === 0 && soTreinoDePericia && direto) || ramosSoTreino) continue;

      escolhas.push({
        chave: `raca_${hab.id ?? escolhas.length}`,
        habilidade: hab.nome ?? titulo(hab.id ?? ""),
        label: hab.descricao_curta ?? hab.nome ?? "Escolha",
        ramos,
        direto,
      });
    }
    return escolhas;
  }

  function beneficiosDeHabilidades(r) {
    const bonus_pericias = [];
    const treinar_pericias = [];
    for (const hab of r.habilidades_raca ?? []) {
      for (const ef of hab.efeitos ?? []) {
        if (ef.tipo === "bonus_pericia" && Array.isArray(ef.pericias)) {
          bonus_pericias.push(...ef.pericias.map((p) => ({ pericia: p, valor: ef.valor ?? 0 })));
        }
        if (ef.tipo === "treinar_pericia") {
          treinar_pericias.push({
            tipo: ef.escolha?.tipo ?? "especificada",
            quantidade: ef.escolha?.quantidade ?? 1,
          });
        }
      }
    }
    return { bonus_pericias, treinar_pericias };
  }

  const racas = [];
  for (const f of readdirSync(racasDir)) {
    if (!f.endsWith(".json")) continue;
    const r = readJson(join(racasDir, f));
    const mod = r.modificadores_atributo ?? {};
    const comum = {
      escolhas: escolhasDeHabilidades(r),
      descricao: r.descricao ?? null,
      tamanho: r.tamanho ?? null,
      deslocamento: r.deslocamento?.terrestre ?? null,
      ...beneficiosDeHabilidades(r),
    };

    if (mod.tipo === "alternativo") {
      for (const alt of mod.alternativas ?? []) {
        racas.push({
          id: alt.id,
          nome: alt.nome ?? alt.id.charAt(0).toUpperCase() + alt.id.slice(1),
          raca_base: r.id,
          ...comum,
          descricao: alt.descricao ?? comum.descricao,
          atributos_fixos: fixosDe(alt.fixos),
          atributos_escolha: escolhasDe(alt.escolhas),
        });
      }
      continue;
    }

    racas.push({
      id: r.id,
      nome: r.nome,
      raca_base: null,
      ...comum,
      atributos_fixos: mod.tipo === "fixo" || mod.tipo === "misto" ? fixosDe(mod.fixos) : [],
      atributos_escolha:
        mod.tipo === "escolha" || mod.tipo === "misto" ? escolhasDe(mod.escolhas) : [],
    });
  }

  racas.sort((a, b) => a.id.localeCompare(b.id));
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

    // Progressão de magia: o poder "Magias (<classe>)" carrega círculo por nível
    // e quantas magias o personagem conhece. É a fonte melhor — inclui o 1º
    // círculo do nv1, que a tabela de `classes/*.json` omite para clérigo/druida.
    const circulos = {};
    let magias = null;
    try {
      const magiasPoder = readJson(join(T20DB, "poderes/classe", classeId, `magias_${classeId}.json`));
      for (const ef of magiasPoder.efeitos ?? []) {
        if (ef.subtipo === "circulo_por_nivel") {
          for (const row of ef.valor ?? []) circulos[String(row.nivel)] = row.circulo;
        }
        if (ef.subtipo === "magias_conhecidas") {
          magias = {
            inicio: ef.valor?.inicio ?? 0,
            por_nivel: ef.valor?.por_nivel ?? 0,
            por_nivel_par: ef.valor?.por_nivel_par ?? 0,
            por_nivel_impar: ef.valor?.por_nivel_impar ?? 0,
          };
        }
      }
    } catch {
      // classe não conjuradora
    }

    // Fallback: tabela do arquivo da classe (só marca upgrades de círculo).
    if (Object.keys(circulos).length === 0) {
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
    }

    // Correção contra o Livro Básico. O T20-DB copiou o padrão do bardo/druida
    // para o clérigo, mas LB cap. 4 (Clérigo, "Magias") diz: "Você começa com
    // três magias de 1º círculo" e "A cada nível, aprende uma magia".
    if (classeId === "clerigo" && magias) {
      magias = { inicio: 3, por_nivel: 1, por_nivel_par: 0, por_nivel_impar: 0 };
    }

    result[classeId] = {
      pericias_inatas: classeData.pericias_inatas ?? [],
      pericias_escolha,
      pericias_numero,
      pv_por_nivel: classeData.pv_por_nivel ?? null,
      pm_por_nivel: classeData.pm_por_nivel ?? null,
      tabela,
      circulos,
      magias,
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
  const titulo = (s) =>
    String(s)
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  // Uma opção pode abrir outra escolha: Feiticeiro → linhagem → (Dracônica) tipo de dano.
  function subEscolha(def, chave) {
    if (!def) return null;
    return {
      chave,
      label: def.label ?? titulo(def.tipo ?? "Escolha"),
      opcoes: (def.opcoes ?? []).map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const nome = typeof o === "string" ? titulo(o) : (o.nome ?? titulo(o.id));
        const aninhada =
          typeof o === "string" ? null : subEscolha(o.exige_sub_escolha, `${chave}_${id}`);
        return { id, nome, sub: aninhada };
      }),
    };
  }

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
      if (opcoes.length === 0) continue;
      return opcoes.map((o) => ({
        // slug = o que toNomeSlug() produz para "Caminho do Arcanista: Mago"
        slug: `${p.id}_${o.id}`,
        id: o.id,
        nome: o.nome ?? titulo(o.id),
        atributoChave: o.atributo_chave_magia ?? null,
        sub: subEscolha(o.sub_escolha_obrigatoria, `classe_${o.sub_escolha_obrigatoria?.tipo ?? "sub"}`),
      }));
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

// textos.json é gerado à parte (scripts/gerar-textos.mjs, precisa dos PDFs) e
// não vai pro git — mas o bundle importa o arquivo, então garanta que exista.
{
  const alvo = join(OUT, "textos.json");
  if (!existsSync(alvo)) {
    writeJson(alvo, { origens: {}, racas: {}, classes: {} });
    console.log("  (vazio — rode `npm run textos` para preencher com os PDFs)");
  }
}

console.log("Done.");
