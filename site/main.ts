/**
 * Site do Criador de Ficha: o MESMO módulo do Foundry, rodando sobre o shim.
 * No fim, em vez de criar o ator no mundo, oferece o JSON para importar.
 */
import { instalarShim, HooksShim, toast, type ActorShim, type PackDump } from "./shim";
import "./site.css";

const MODULE_ID = "t20-ficha-wizard";
const base = new URL(import.meta.env.BASE_URL, location.href).href;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function mostrarItem(doc: Record<string, unknown>): void {
  const sys = (doc["system"] as Record<string, unknown> | undefined) ?? {};
  const desc = ((sys["description"] as { value?: string } | undefined)?.value ?? "").replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1");
  el("t20w-item-titulo").textContent = String(doc["name"] ?? "");
  el("t20w-item-corpo").innerHTML = desc || "<p><em>Sem descrição.</em></p>";
  el<HTMLDialogElement>("t20w-item").showModal();
}

function fichaPronta(actor: ActorShim): void {
  const json = JSON.stringify(actor.toObject(), null, 2);
  const nome = actor.name.replace(/[^\w\-]+/g, "_") || "personagem";
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el<HTMLAnchorElement>("t20w-baixar");
  a.href = url;
  a.download = `${nome}.json`;
  el("t20w-pronto-nome").textContent = actor.name;
  el("t20w-pronto-resumo").textContent = `${actor.items.length} itens · nível ${actor.nivel}`;
  el<HTMLDialogElement>("t20w-pronto").showModal();
  toast(`Ficha de ${actor.name} pronta para baixar.`);
}

async function carregarJson<T>(caminho: string): Promise<T> {
  const r = await fetch(new URL(caminho, base));
  if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
  return (await r.json()) as T;
}

async function boot(): Promise<void> {
  const status = el("t20w-status");
  status.textContent = "Carregando compêndios…";
  const [dados, lang] = await Promise.all([
    carregarJson<{ packs: PackDump[] }>("data/compendio.json"),
    carregarJson<Record<string, string>>(`modules/${MODULE_ID}/lang/pt-BR.json`),
  ]);
  instalarShim({ base, dados, lang, onFichaPronta: fichaPronta, onAbrirItem: mostrarItem });

  // O módulo registra os hooks ao ser importado — depois dos globais existirem.
  await import("../src/module");
  await HooksShim.call("init");
  await HooksShim.call("ready");
  const { openWizard } = await import("../src/wizard/app");

  status.textContent = "";
  const abrir = el<HTMLButtonElement>("t20w-abrir");
  abrir.disabled = false;
  abrir.addEventListener("click", () => openWizard());
  el("t20w-fechar-pronto").addEventListener("click", () => el<HTMLDialogElement>("t20w-pronto").close());
  el("t20w-fechar-item").addEventListener("click", () => el<HTMLDialogElement>("t20w-item").close());
  openWizard();
}

boot().catch((err: unknown) => {
  console.error(err);
  el("t20w-status").textContent = `Não carregou: ${String((err as Error)?.message ?? err)}`;
});
