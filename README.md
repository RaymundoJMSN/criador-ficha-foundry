# Criador de Ficha — Tormenta20 (Foundry VTT v13)

Módulo para o sistema **Tormenta20** que cria um personagem completo, de
nível 1 a 20, em passos guiados: nível, atributos, raça, origem, classe (com
multiclasse), perícias, divindade, poderes, magias, equipamento e revisão.
Tudo o que entra na ficha vem dos compêndios instalados e das regras dos
livros — nada é chutado.

## O que ele faz

- **Nível 1–20** com as habilidades de classe certas para o nível, cota de
  poderes acumulada, círculos e cota de magias por classe e caminho.
- **Multiclasse** (LB p.35): várias classes com níveis; a principal dá perícias,
  proficiências e o PV inicial.
- **Atributos** por compra de pontos, rolagem padrão/clássica/épica, Valkaria,
  Khalmyr e Nimb (Heróis de Arton p.280–281), com distribuição pelo jogador.
- **Raças** do Livro Básico, Heróis de Arton e as que só existem no compêndio
  (Moreau, Kallyanach, Vampiro…), com escolhas raciais (Versátil, Memória
  Póstuma, Deformidade…) e **montagem por passos** para as raças que se
  constroem: Duende (natureza, tamanho, presentes, tabu), Kallyanach (bênçãos),
  Golens Despertos (chassi, fonte de energia, tamanho), Mashin, Kobolds.
- Listas em ordem alfabética e um campo só para buscar e escolher.
- **Origens** com o texto inteiro do livro, os dois benefícios e itens iniciais
  de verdade ("estojo de disfarces ou gazua", ração ×10, T$ em dado).
- **Divindades** do Panteão e os **deuses menores** do Guia, com a lista de
  devotos aceitos e os poderes concedidos.
- **Poderes** com pré-requisitos conferidos (atributo, perícia, nível, poder,
  habilidade, devoção…), inclusive os lidos do texto do item para os poderes
  dos suplementos; só entram os gerais e os da própria classe e raça; poderes
  repetíveis, habilidades com opção ("Bênção da Justiça: Égide/Montaria"),
  **sub-escolhas** (Aspirante a Herói: qual atributo; Foco em Arma: qual arma)
  e **distinções** (HA cap. 2).
- **Magias** por tradição e círculo, escolas do bardo/druida, teto por círculo,
  filtros por escola e tradição, magias vindas de poderes (Orar, Dedo Verde,
  Centelha Mágica abrindo a outra tradição…).
- **Divindades** incluem o Panteão como um todo (clérigo e frade) e um botão
  sorteia o nome pela tabela de Heróis de Arton.
- **Equipamento**: kit do 1º nível (LB p.146), loja com quantidade, T$ pela
  Tabela 3-1.
- **Regras da mesa** (só o mestre): nível inicial, método de atributos travado,
  Pontos Variados, T$ fixo, raças/classes liberadas, Complicações, Idades
  Variadas, Raças Abertas, Devoções Abertas, Distinções.
- Ficha nasce com retrato da raça, Active Effects dos itens e um aviso no chat.

## Site

O mesmo criador roda no navegador em `t20.raynathus.com.br/criar/`: no fim ele
entrega um JSON, e o botão **Importar ficha (JSON do site)** na aba Atores do
Foundry cria o personagem. É o mesmo código do módulo sobre um shim do Foundry
(`site/`), então tudo que muda aqui muda lá. `npm run export:compendio` gera o
despejo dos compêndios (fora do git), `npm run build:site` monta e
`npm run deploy:site` publica. Com o nome informado, o site guarda os
personagens no servidor ("Meus personagens": reabrir, baixar de novo, apagar).

## Instalação

Foundry VTT → Módulos → Instalar módulo → colar a URL do manifesto:

```
https://github.com/RaymundoJMSN/criador-ficha-foundry/releases/latest/download/module.json
```

Requer o sistema **Tormenta20 (1.5.015+)** e o Foundry **v13**. Os módulos de
suplementos (Heróis de Arton, Deuses de Arton, Ameaças…) são opcionais: o
criador lista o que estiver instalado.

## Uso

Na aba **Atores** aparece o botão **Criar Personagem**. O mestre vê também
**Regras da mesa**, que define o que vale para todo mundo (também em
Configurações → Criador de Ficha). O progresso fica salvo como rascunho: fechar
e reabrir retoma de onde parou.

## Desenvolvimento

```bash
npm install
npm run build        # dist/module.js
npm test             # vitest (regras puras + integração com os compêndios)
npm run typecheck
npm run port         # regenera src/data a partir do T20-DB
npm run port:pdf     # tabelas de classe dos PDFs (+ conferidor contra o T20-DB)
npm run port:deuses  # deuses menores do Guia
```

As regras numéricas vivem em `src/data/*.json`, geradas de fontes verificadas
contra os livros. Os textos dos livros (descrições) ficam fora do repositório
(`src/data/textos.json` é gerado localmente e ignorado pelo git): o conteúdo é
da Jambo Editora.

## Licença

MIT. Tormenta20 é marca da Jambo Editora; este módulo não distribui texto dos
livros.
