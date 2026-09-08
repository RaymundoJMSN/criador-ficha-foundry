/**
 * Um campo só para buscar E escolher.
 *
 * Antes havia um "Filtrar…" em cima de cada dropdown longo — dois campos para
 * uma coisa. Aqui o <select> continua no formulário (escondido; o FormData lê
 * dele normalmente) e ganha por cima um input com a lista filtrável: digitou,
 * filtra; clicou ou deu Enter, escolhe; o select recebe o valor e dispara
 * `change` como se o jogador tivesse mexido nele.
 */
const semAcento = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Opcao {
  value: string;
  text: string;
  grupo: string;
  disabled: boolean;
}

export function montarCombo(sel: HTMLSelectElement): void {
  const opcoes: Opcao[] = Array.from(sel.options).map((o) => ({
    value: o.value,
    text: o.text,
    grupo: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : "",
    disabled: o.disabled,
  }));
  const textoDe = (value: string): string => opcoes.find((o) => o.value === value)?.text ?? "";

  const wrap = document.createElement("div");
  wrap.className = "t20w-combo";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "t20w-combo-input";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = textoDe("") || "Digite para buscar…";
  const lista = document.createElement("div");
  lista.className = "t20w-combo-lista";
  lista.hidden = true;

  sel.parentElement?.insertBefore(wrap, sel);
  wrap.append(input, lista, sel);
  sel.classList.add("t20w-combo-select");

  let ativo = -1;
  let digitou = false;
  let visiveis: Opcao[] = [];

  const mostrarValor = (): void => {
    input.value = sel.value ? textoDe(sel.value) : "";
  };
  const fechar = (): void => {
    lista.hidden = true;
    ativo = -1;
  };
  const escolher = (value: string): void => {
    if (opcoes.find((o) => o.value === value)?.disabled) return;
    sel.value = value;
    mostrarValor();
    fechar();
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const render = (): void => {
    const t = digitou ? semAcento(input.value.trim()) : "";
    visiveis = opcoes.filter((o) => !t || !o.value || semAcento(o.text).includes(t));
    lista.replaceChildren();
    let grupoAtual = "";
    visiveis.forEach((o, i) => {
      if (o.grupo && o.grupo !== grupoAtual) {
        grupoAtual = o.grupo;
        const g = document.createElement("div");
        g.className = "t20w-combo-grupo";
        g.textContent = o.grupo;
        lista.appendChild(g);
      }
      const el = document.createElement("div");
      el.className =
        "t20w-combo-item" +
        (o.value && o.value === sel.value ? " t20w-combo-atual" : "") +
        (i === ativo ? " t20w-combo-ativo" : "") +
        (o.value ? "" : " t20w-combo-vazio") +
        (o.disabled ? " t20w-combo-desab" : "");
      el.textContent = o.text;
      // mousedown (não click): o blur do input fecharia a lista antes do click.
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        escolher(o.value);
      });
      lista.appendChild(el);
    });
    lista.hidden = visiveis.length === 0;
  };
  const abrir = (): void => {
    digitou = false;
    ativo = -1;
    render();
  };

  mostrarValor();
  input.addEventListener("focus", () => {
    input.select();
    abrir();
  });
  input.addEventListener("click", () => {
    if (lista.hidden) abrir();
  });
  input.addEventListener("input", () => {
    digitou = true;
    ativo = -1;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (lista.hidden) {
        abrir();
        return;
      }
      const n = visiveis.length;
      if (!n) return;
      ativo = e.key === "ArrowDown" ? (ativo + 1) % n : (ativo - 1 + n) % n;
      render();
      lista.querySelector<HTMLElement>(".t20w-combo-ativo")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      // Enter não pode submeter o formulário do wizard.
      e.preventDefault();
      if (lista.hidden) return;
      const alvo = ativo >= 0 ? visiveis[ativo] : visiveis.find((o) => Boolean(o.value));
      if (alvo) escolher(alvo.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      mostrarValor();
      fechar();
    }
  });
  input.addEventListener("blur", () => {
    mostrarValor();
    fechar();
  });
}
