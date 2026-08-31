"""Extrai o texto dos PDFs oficiais para um cache local.

    python scripts/extrair-pdfs.py

Por que PDF e não o markdown de `tormenta-livros`: a conversão em markdown é de
comunidade e tem erro de transcrição. Conferido caso a caso — a joia do
Aristocrata é T$ 300 no PDF e no T20-DB, mas T$ 100 no markdown; a tabela do
Nobre no markdown é de uma impressão anterior (Gritar Ordens no 5º nível, sem
Palavras Afiadas), enquanto PDF, T20-DB e compêndio concordam entre si.
O PDF é o livro; o markdown serve para ler, não para conferir número.

O cache fica em `scripts/.cache-pdf/` e é gitignorado — é texto da Jambo.
Caminho dos PDFs por `T20_PDFS`.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

PADRAO_PDFS = r"E:\rayna\Documents\Claude\Projects\Element Self-Host\stack\arauto\books"
PDFS = Path(os.environ.get("T20_PDFS", PADRAO_PDFS))
CACHE = Path(__file__).resolve().parent / ".cache-pdf"

# Nome do arquivo → id do livro usado pelo conferidor.
LIVROS = {
    "T20 - Livro Básico.pdf": "tormenta20-core",
    "T20 - Heróis de Arton.pdf": "herois-arton",
    "T20 - Deuses de Arton.pdf": "deuses-arton",
    "T20 - Ameaças de Arton.pdf": "ameacas-arton",
    "T20 - Guia de Deuses Menores.pdf": "deuses-menores",
    "T20 - Guia de NPCs.pdf": "guia-npcs",
}


def normalizar(texto: str) -> str:
    """Junta as hifenizações de fim de linha e colapsa espaço.

    O PDF é diagramado em colunas estreitas, então "conjura-\\nção" e
    "aventu-\\nras" aparecem partidos no meio da palavra o tempo todo.
    """
    texto = texto.replace("\u00ad", "")
    texto = re.sub(r"-\s*\n\s*", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def main() -> int:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF não instalado: pip install pymupdf", file=sys.stderr)
        return 1

    if not PDFS.is_dir():
        print(f"PDFs não encontrados em {PDFS}. Ajuste T20_PDFS.", file=sys.stderr)
        return 1

    CACHE.mkdir(exist_ok=True)
    total = 0
    for arquivo, livro in LIVROS.items():
        caminho = PDFS / arquivo
        if not caminho.exists():
            print(f"  (pulando {arquivo} — não está na pasta)")
            continue
        doc = fitz.open(caminho)
        paginas = [
            {"pagina": n + 1, "texto": normalizar(doc[n].get_text())}
            for n in range(doc.page_count)
        ]
        doc.close()
        destino = CACHE / f"{livro}.json"
        destino.write_text(
            json.dumps({"livro": livro, "arquivo": arquivo, "paginas": paginas}, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"  ok {livro}: {len(paginas)} páginas")
        total += len(paginas)

    print(f"{total} páginas em {CACHE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
