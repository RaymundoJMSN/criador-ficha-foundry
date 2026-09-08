/**
 * Site do Criador de Ficha: o MESMO módulo do Foundry, rodando sobre o shim.
 * No fim, em vez de criar o ator no mundo, oferece o JSON para importar.
 *
 * Extras do site: login por nome (sem senha), rascunho e ficha salvos no
 * servidor do t20-ficha-online (`/api/criador/personagens`), painel "Meus
 * personagens" para reabrir, baixar de novo e apagar.
 */
import { instalarShim, HooksShim, toast, gravarRascunho, limparRascunho, type ActorShim, type PackDump } from "./shim";
import "./site.css";

const MODULE_ID = "t20-ficha-wizard";
const base = new URL(import.meta.env.BASE_URL, location.href).href;
const API = new URL("../api/criador/personagens", base).href;

interface Resumo {
  id: string;
  nome: string;
  resumo: string;
  passo: string | null;
  temFicha: boolean;
  atualizadoEm: number;
}

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`t20w-site.${k}`) ?? "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      if (v) localStorage.setItem(`t20w-site.${k}`, v);
      else localStorage.removeItem(`t20w-site.${k}`);
    } catch {
      /* sem storage */
    }
  },
};

let jogador = ls.get("jogador");
let atualId = ls.get("personagemAtual");
let avisouSemNome = false;
let timerSalvar: ReturnType<typeof setTimeout> | undefined;
let pendente: { nome: string; resumo: string; estado: string; passo?: string; ficha?: unknown } | null = null;

const novoId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const q = (): string => `?jogador=${encodeURIComponent(jogador)}`;

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${caminho}`, { headers: { "content-type": "application/json" }, ...init });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
  return (await r.json()) as T;
}

/* ── salvar no servidor (debounce) ─────────────────────────────────────── */

function agendarSalvar(): void {
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(() => void salvarAgora(), 1500);
}
async function salvarAgora(): Promise<void> {
  if (!pendente) return;
  if (!jogador) {
    if (!avisouSemNome) {
      avisouSemNome = true;
      toast("Digite seu nome no alto para salvar o personagem no site (por enquanto fica só neste navegador).", "warn");
    }
    return;
  }
  if (!atualId) {
    atualId = novoId();
    ls.set("personagemAtual", atualId);
  }
  const corpo = { jogador, ...pendente };
  pendente = null;
  try {
    await api(`/${atualId}${q()}`, { method: "PUT", body: JSON.stringify(corpo) });
    el("t20w-salvo").textContent = `salvo ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    void carregarLista();
  } catch (err) {
    el("t20w-salvo").textContent = "não salvou no servidor";
    console.warn("salvar:", err);
  }
}

function resumoDoEstado(estado: string): { nome: string; resumo: string } {
  try {
    const e = JSON.parse(estado) as { nome?: string; racaNome?: string; classeNome?: string; nivel?: number };
    return {
      nome: e.nome?.trim() || "Sem nome",
      resumo: [e.racaNome, e.classeNome, e.nivel ? `nível ${e.nivel}` : ""].filter(Boolean).join(" · "),
    };
  } catch {
    return { nome: "Sem nome", resumo: "" };
  }
}

/** O wizard gravou (ou apagou) o rascunho: espelha no servidor. */
function aoMudarRascunho(valor: { estado?: string; passo?: string } | null): void {
  if (!valor?.estado) {
    // "recomeçar": o próximo salvamento é um personagem novo.
    atualId = "";
    ls.set("personagemAtual", "");
    return;
  }
  pendente = { ...resumoDoEstado(valor.estado), estado: valor.estado, passo: valor.passo };
  agendarSalvar();
}

/* ── ficha pronta ──────────────────────────────────────────────────────── */

function oferecerDownload(nome: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const a = el<HTMLAnchorElement>("t20w-baixar");
  if (a.href.startsWith("blob:")) URL.revokeObjectURL(a.href);
  a.href = URL.createObjectURL(blob);
  a.download = `${nome.replace(/[^\w\-]+/g, "_") || "personagem"}.json`;
}

function fichaPronta(actor: ActorShim): void {
  const ficha = actor.toObject();
  oferecerDownload(actor.name, JSON.stringify(ficha, null, 2));
  el("t20w-pronto-nome").textContent = actor.name;
  el("t20w-pronto-resumo").textContent = `${actor.items.length} itens · nível ${actor.nivel}`;
  el<HTMLDialogElement>("t20w-pronto").showModal();
  toast(`Ficha de ${actor.name} pronta para baixar.`);
  // Guarda a ficha final junto do personagem salvo (baixa de novo pelo painel).
  if (pendente) pendente.ficha = ficha;
  else {
    const flag = ls.get(`flag.${MODULE_ID}.rascunho`);
    const estado = flag ? (JSON.parse(flag) as { estado?: string }).estado : "";
    pendente = { ...resumoDoEstado(estado ?? ""), nome: actor.name, estado: estado ?? "{}", ficha };
  }
  void salvarAgora();
}

/* ── painel "Meus personagens" ─────────────────────────────────────────── */

async function carregarLista(): Promise<void> {
  const ul = el("t20w-lista");
  if (!jogador) {
    ul.innerHTML = `<li class="t20w-hint">Digite seu nome para ver seus personagens.</li>`;
    return;
  }
  try {
    const lista = await api<Resumo[]>(q());
    if (lista.length === 0) {
      ul.innerHTML = `<li class="t20w-hint">Nenhum personagem salvo ainda.</li>`;
      return;
    }
    ul.replaceChildren(
      ...lista.map((p) => {
        const li = document.createElement("li");
        li.className = p.id === atualId ? "atual" : "";
        li.innerHTML = `<div class="t20w-lista-nome"><strong></strong><span class="t20w-hint"></span></div>
          <div class="t20w-lista-acoes">
            <button type="button" data-acao="abrir">Abrir</button>
            <button type="button" data-acao="baixar" ${p.temFicha ? "" : "disabled title='Ainda não gerou a ficha'"}>⬇ JSON</button>
            <button type="button" data-acao="apagar" class="perigo">Apagar</button>
          </div>`;
        li.querySelector("strong")!.textContent = p.nome;
        li.querySelector("span")!.textContent = ` ${p.resumo}${p.passo ? ` · em ${p.passo}` : ""} · ${new Date(p.atualizadoEm).toLocaleDateString("pt-BR")}`;
        li.querySelector("[data-acao='abrir']")!.addEventListener("click", () => abrirPersonagem(p.id));
        li.querySelector("[data-acao='baixar']")!.addEventListener("click", () => void baixarFicha(p.id));
        li.querySelector("[data-acao='apagar']")!.addEventListener("click", () => void apagarPersonagem(p));
        return li;
      })
    );
  } catch (err) {
    ul.innerHTML = `<li class="t20w-hint">Não consegui falar com o servidor (${String((err as Error).message)}).</li>`;
  }
}

function abrirPersonagem(id: string): void {
  const u = new URL(location.href);
  u.searchParams.set("personagem", id);
  location.href = u.href;
}

async function baixarFicha(id: string): Promise<void> {
  try {
    const p = await api<{ nome: string; ficha: string | null }>(`/${id}${q()}`);
    if (!p.ficha) return toast("Esse personagem ainda não gerou a ficha.", "warn");
    oferecerDownload(p.nome, p.ficha);
    el<HTMLAnchorElement>("t20w-baixar").click();
  } catch (err) {
    toast(`Não baixou: ${String((err as Error).message)}`, "error");
  }
}

async function apagarPersonagem(p: Resumo): Promise<void> {
  if (!window.confirm(`Apagar "${p.nome}" do site? Não dá para desfazer.`)) return;
  try {
    await api(`/${p.id}${q()}`, { method: "DELETE" });
    if (p.id === atualId) {
      atualId = "";
      ls.set("personagemAtual", "");
    }
    void carregarLista();
  } catch (err) {
    toast(`Não apagou: ${String((err as Error).message)}`, "error");
  }
}

function novoPersonagem(): void {
  limparRascunho();
  atualId = "";
  ls.set("personagemAtual", "");
  location.href = base;
}

/* ── boot ──────────────────────────────────────────────────────────────── */

function mostrarItem(doc: Record<string, unknown>): void {
  const sys = (doc["system"] as Record<string, unknown> | undefined) ?? {};
  const desc = ((sys["description"] as { value?: string } | undefined)?.value ?? "").replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1");
  el("t20w-item-titulo").textContent = String(doc["name"] ?? "");
  el("t20w-item-corpo").innerHTML = desc || "<p><em>Sem descrição.</em></p>";
  el<HTMLDialogElement>("t20w-item").showModal();
}

async function carregarJson<T>(caminho: string): Promise<T> {
  const r = await fetch(new URL(caminho, base));
  if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
  return (await r.json()) as T;
}

async function boot(): Promise<void> {
  const status = el("t20w-status");
  const nomeInput = el<HTMLInputElement>("t20w-jogador");
  nomeInput.value = jogador;
  nomeInput.addEventListener("change", () => {
    jogador = nomeInput.value.trim().slice(0, 60);
    ls.set("jogador", jogador);
    avisouSemNome = false;
    void carregarLista();
    if (pendente) agendarSalvar();
  });
  el("t20w-meus").addEventListener("click", () => {
    const painel = el("t20w-painel");
    painel.hidden = !painel.hidden;
    if (!painel.hidden) void carregarLista();
  });
  el("t20w-novo").addEventListener("click", novoPersonagem);
  el("t20w-fechar-pronto").addEventListener("click", () => el<HTMLDialogElement>("t20w-pronto").close());
  el("t20w-fechar-item").addEventListener("click", () => el<HTMLDialogElement>("t20w-item").close());

  // ?personagem=<id>: reabre um personagem salvo (o wizard retoma o rascunho).
  const pedido = new URL(location.href).searchParams.get("personagem");
  let autoConfirmar = false;
  if (pedido && jogador) {
    try {
      const p = await api<{ estado: string; passo: string | null }>(`/${pedido}${q()}`);
      gravarRascunho({ estado: p.estado, passo: p.passo ?? undefined });
      atualId = pedido;
      ls.set("personagemAtual", pedido);
      autoConfirmar = true;
    } catch (err) {
      toast(`Não abri o personagem: ${String((err as Error).message)}`, "error");
    }
    history.replaceState(null, "", base);
  }

  status.textContent = "Carregando compêndios…";
  const [dados, lang] = await Promise.all([
    carregarJson<{ packs: PackDump[] }>("data/compendio.json"),
    carregarJson<Record<string, string>>(`modules/${MODULE_ID}/lang/pt-BR.json`),
  ]);
  instalarShim({ base, dados, lang, onFichaPronta: fichaPronta, onAbrirItem: mostrarItem, onRascunho: aoMudarRascunho, autoConfirmar });

  await import("../src/module");
  await HooksShim.call("init");
  await HooksShim.call("ready");
  const { openWizard } = await import("../src/wizard/app");

  status.textContent = "";
  const abrir = el<HTMLButtonElement>("t20w-abrir");
  abrir.disabled = false;
  abrir.addEventListener("click", () => openWizard());
  void carregarLista();
  openWizard();
}

boot().catch((err: unknown) => {
  console.error(err);
  el("t20w-status").textContent = `Não carregou: ${String((err as Error)?.message ?? err)}`;
});
