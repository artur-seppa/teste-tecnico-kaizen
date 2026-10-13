# Relatório de entrega

**Candidato:** Artur Reiman
**Data de entrega:**
**Tempo aproximado dedicado:**

---

## 1. Subindo o projeto

Como subi a aplicação, e o que foi mais difícil ou confuso.

Backend: `npm install`, criar o `.env`, `npm run db:init`, `npm run dev` (porta
3001). Frontend: `npm install`, `npm run dev` (Vite na 5173, com proxy de
`/api` para o backend). O ERP respondeu em `/health` de primeira.

Quatro pontos de atrito:

1. **Três nomes para as mesmas duas variáveis.** As credenciais chegaram por
   e-mail como `SIAC_URL` e `SIAC_TOKEN`; o README fala em `SIAC_URL`; o
   `.env.example` e o `config.js` usam `ERP_URL` e `ERP_TOKEN`. Quem copia do
   e-mail ou segue o README define variáveis que ninguém lê — e, no estado
   original, a aplicação **subia assim mesmo** usando os valores embutidos no
   código, então o erro não aparecia (ver ponto 3 e Problema 1).
2. **O README não diz que as credenciais precisam ser pedidas.** Ele cita
   `SIAC_URL` como se já estivesse disponível, e o `.env.example` só diz "cole
   aqui". Nada nos dois indica a quem pedir. Para quem não reparou no e-mail, o
   único lugar onde os valores existiam era hardcoded no `config.js` — foi
   assim que os encontrei, lendo o código, não pela configuração.

   Sugestão: o README deveria registrar que `SIAC_URL` e `SIAC_TOKEN` são
   credenciais enviadas por e-mail e, na falta delas, devem ser pedidas ao
   responsável pelo teste — além de usar o mesmo nome que o código lê. Como o
   README é o enunciado, não o alterei; coloquei essa indicação no
   `.env.example`, que é o arquivo que o projeto de fato manda copiar.
3. **A aplicação sobe sem `.env` nenhum**, usando segredo e token embutidos.
   Isso esconde o erro de configuração em vez de expô-lo — é o oposto do
   fail-fast que o `ARQUITETURA.md` descreve.
4. **`better-sqlite3` e `esbuild` precisaram de `npm approve-scripts`.** O npm
   desta máquina bloqueia install scripts por padrão; sem aprovar, o módulo
   nativo não compila e o backend não sobe. É específico do meu ambiente, não
   do projeto.

Arquivos que precisei criar e não vinham no repositório:

- **`backend/.env`** — a partir do `.env.example`, com `JWT_SEGREDO` gerado por
  `npm run segredo:gerar`.
- **`.gitignore`** na raiz — o repositório não tinha nenhum. Ver Problema 2.


---

## 2. Chamados reportados

Um bloco por chamado. **Causa** é o que estava errado no código, não o sintoma
que o cliente descreveu. As linhas citadas em **Causa** são do arquivo **como
recebido**, antes da correção; onde o texto fala do estado entregue, a linha é
a do arquivo de hoje.

### KZN-312 — Total do carrinho vem maior que a soma das peças

| | |
|---|---|
| **Causa** | `carrinhoService.js:85` somava `valor_total` de **todos** os itens, inclusive os marcados `disponivel: false`. A intenção de não somar indisponível já existia no arquivo — o caminho "produto sumiu do catálogo" (`:41`) devolve `valor_total: 0` —, mas não valia para o item sem estoque (`:64`), que mantém o valor cheio. Não é decisão de produto: são dois caminhos de indisponibilidade com tratamento divergente dentro da mesma função. |
| **Como reproduzi** | `ARR-7002` (Radiador de Agua sem Ar, R$ 684,00, estoque 0) é o item do chamado — o valor bate exatamente com o relato do atendimento. Pela interface ele é inalcançável: `adicionarItem` barra com `409 ESTOQUE_INSUFICIENTE`. O cenário só nasce de um jeito: a peça entra quando há estoque e a baixa vem depois. Simulei inserindo a linha direto em `carrinho_itens`, que é o estado em que o banco ficaria. Com 2× ARR-7001 e 3× ARR-7003 ao lado, as linhas somavam R$ 507,10 e o rodapé exibia R$ 1.191,10. |
| **Arquivos alterados** | `backend/src/services/carrinhoService.js` |
| **Como validei a correção** | Teste de unidade do service com o ERP mockado (`test/carrinhoService.test.js`), mais verificação contra o banco e o ERP reais. Confirmei que o teste **falha** quando reverto a correção — 4 dos 19 testes de backend de então ficam vermelhos. |

O que me surpreendeu e as decisões que precisei tomar.

O que me fez tratar isso como defeito, e não como decisão de produto, foi o botão: `pronto_para_checkout` já era `false` e "Fechar pedido" já vinha desabilitado. Ou seja, **R$ 1.191,10 não era o preço de nenhum pedido que existisse** — o pedido possível custava R$ 507,10. O número em destaque descrevia uma compra impossível.

Duas decisões que o enunciado não responde:

- **Linha com estoque parcial sai inteira do total** (pediu 5, tem 2 → zero no total). É o mesmo critério que `pronto_para_checkout` já usa para bloquear a linha. A alternativa — somar as 2 que existem — descreveria um carrinho que a pessoa ainda não tem, e ela precisaria editar a quantidade antes de fechar.
- **A linha indisponível continua visível, com o preço dela.** Saber quanto custa o radiador é informação útil para quem decide se espera a reposição. O que muda é só a participação no total.

Sobre os 30 minutos do README: vale ser preciso, porque é fácil contar errado. **A loja não guarda estoque nem faz cache** — `enriquecerItens` chama o ERP uma vez por item a cada leitura do carrinho. Quem pode estar defasado é o dado **dentro do ERP**, que sincroniza com o estoque físico a cada 30 min. A loja sempre mostra o número mais recente que o ERP tem; esse número é que pode estar atrás da prateleira.


### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | `carrinhoService.js:88` devolvia `quantidade_pecas: itens.length` — o mesmo valor de `quantidade_itens`, que está logo acima. O campo prometia peças e entregava linhas. O front estava correto e não precisou mudar por este chamado: no arquivo como recebido, o badge já lia `quantidade_pecas`, o campo certo; ele só recebia o número errado do servidor. (Com os múltiplos carrinhos o contador passou a vir do contexto, como `quantidadePecas` — ver seção 4 e a nota `KZN-5D1E` no `Cabecalho.jsx`.) |
| **Como reproduzi** | Carrinho com 2 produtos distintos e 5 + 2 = 7 unidades: o badge mostrava 2. É o relato literal do chamado ("mostra 2, mas eu tenho 7 peças"). |
| **Arquivos alterados** | `backend/src/services/carrinhoService.js` |
| **Como validei a correção** | Teste do service (backend) e teste de componente do `Cabecalho` renderizando com `ProvedorAuth` + `ProvedorCarrinho` reais (frontend). Verifiquei que o teste de front falha se o badge voltar a ler `quantidade_itens`. |

**O chamado subestima o alcance.** O relato fala do ícone, mas `quantidade_pecas` alimenta também o "Itens" do resumo do carrinho (`Carrinho.jsx:97`). São dois lugares na tela, não um — e a correção no servidor acerta os dois de uma vez, sem mudar uma linha do front.

**Decisão:** o contador inclui as peças da linha indisponível. Ele responde "quantas peças tem aí dentro", não "quantas dá para levar" — se o radiador sumisse da contagem, a pessoa acharia que perdeu o item do carrinho.


### KZN-325 — Busca diz que não encontrou peça que existe

| | |
|---|---|
| **Causa** | A página ficava na URL quando o resultado mudava. `Cabecalho.jsx:40` montava a URL da pesquisa a partir dos parâmetros atuais e preservava **todos** eles, inclusive `pagina`. Buscar "amortecedor" estando na página 5 navegava para `/?pagina=5&busca=amortecedor`: o ERP devolve 3 resultados em 1 página, a página 5 vem vazia, e a vitrine mostra "Nenhuma peça encontrada". O mesmo valia para os outros filtros, por `trocarParametro` (`Catalogo.jsx:70`), que também preservava a página ao trocar categoria ou marcar "Só com estoque". |
| **Como reproduzi** | Pela API real, com o backend em execução: `GET /api/catalogo?busca=amortecedor&tamanho=24` devolve os 3 amortecedores; a mesma busca com `&pagina=5` devolve `{"dados":[],"paginacao":{"pagina":5,"total":3,"total_paginas":1}}`. É exatamente o que o front pedia depois de avançar as páginas. |
| **Arquivos alterados** | `frontend/src/componentes/Cabecalho.jsx`, `frontend/src/paginas/Catalogo.jsx` |
| **Como validei a correção** | Sete testes de componente: três em `frontend/test/Cabecalho.test.jsx` para a busca do topo (o caso literal do chamado, preservação dos demais filtros e limpeza do termo) e quatro em `frontend/test/Catalogo.test.jsx` para os filtros da vitrine. O último deles é o controle: navegar entre páginas **não** pode zerar a página, senão a correção quebraria a paginação. Os testes do cabeçalho usam `BrowserRouter` com URL real, porque `MemoryRouter` não toca em `window.location` e o defeito passaria despercebido. |

**A regra que faltava.** Página não é filtro: é uma posição dentro de um
resultado. Mexer no filtro troca o resultado, e a posição antiga deixa de
existir. Os dois pontos de entrada tratavam `pagina` como se fosse mais um
filtro a preservar. A correção é a mesma nos dois: ao mudar o que define o
resultado, a posição volta para o começo.

**Por que "se pesquisa assim que entra, funciona".** Sem `pagina` na URL, o
front assume 1. O atendimento descreveu com precisão a condição de contorno —
o defeito depende de já existir uma página na URL.

**O backend está correto.** `lerPaginacao` (`validacao.js`) trata a página como
número e o ERP responde com `total_paginas: 1` junto da lista vazia. Pedir a
página 5 de um resultado com uma página é uma pergunta coerente com resposta
vazia; quem estava errado era a pergunta.

**Um detalhe que piora o sintoma.** Quando a lista volta vazia, o `EstadoVazio`
substitui a grade **e** a paginação (`Catalogo.jsx:171-196`). A pessoa perde o
controle que a tiraria da página inválida e só lhe resta "Limpar filtros", que
descarta a busca inteira. Com a correção o estado deixa de acontecer por esse
caminho, mas vale saber que ele não tem saída própria.

**De passagem, uma coisa que o `Cabecalho` fazia e não devia.** `pesquisar()`
lia `window.location.search` enquanto o componente já recebia os parâmetros do
roteador por `useSearchParams()` (`:32`). Em produção os dois coincidem, mas é
o componente furando o roteador para consultar o navegador direto — e é o que
tornava o comportamento invisível em teste. Passou a ler `parametros`.


### KZN-331 — Pedido saiu com o endereço errado

| | |
|---|---|
| **Causa** | `Checkout.jsx:54` ignorava a escolha da pessoa e recalculava o endereço no momento do envio: `const entrega = enderecos.find((item) => item.principal) ?? enderecos[0]`. É a mesma expressão da linha 25, que define o valor **inicial** do radio. A tela guarda a seleção em `enderecoId` (`setEnderecoId`, linha 119), mas `finalizar()` não lia esse estado — mandava `entrega?.id`. Resultado: todo pedido ia para o endereço `principal`, ou para o primeiro da lista se nenhum fosse principal, independentemente do que a pessoa marcou. |
| **Como reproduzi** | Primeiro pela leitura do fluxo completo (tela → rota → serviço). Depois em **dado real**: o pedido `PED-2026-000011` do banco de desenvolvimento registrou o endereço "Casa", que é o principal, com "Trabalho" também cadastrado. |
| **Arquivos alterados** | `frontend/src/paginas/Checkout.jsx` |
| **Como validei a correção** | Cinco testes de componente em `frontend/test/Checkout.test.jsx`, montando a tela com a API mockada: escolher o não-principal fecha nele; escolher o principal continua funcionando; o principal segue pré-selecionado ao abrir; sem nenhum principal marca o primeiro; e endereço cadastrado durante o próprio checkout vira o escolhido. O primeiro falha se a correção for revertida. |

**O backend está correto e não precisa mudar.** `buscarEndereco`
(`enderecoService.js:30-32`) filtra por `id` **e** `usuario_id`, então não há
vazamento entre contas; `finalizarPedido` grava o snapshot do endereço que
recebeu. Ele recebeu o id da casa e gravou a casa. O dado errado chegou pronto
do front.

**Por que não acontece sempre:** quem tem um endereço só nunca vê o problema, e
quem escolhe justamente o principal também não. Só aparece ao escolher diferente
do principal — o que explica "duas vezes essa semana" em vez de toda hora.

**O chamado subestima o alcance.** `enderecoId` é usado apenas para marcar o
radio e habilitar o botão (`:200`); nenhuma outra linha o lê. A tela de escolha
de endereço não influencia o pedido em nada. A logística reportou dois casos,
mas o defeito atinge **todo** pedido de quem escolhe algo diferente do principal.

Vale registrar o que o comentário da linha 53 diz: *"Entrega vai para o endereço
principal do cliente"*. Ele descreve com precisão o que o código faz — a lista de
seleção provavelmente veio depois e o envio não foi ajustado. O código não está
incoerente consigo mesmo; está incoerente com a tela que ele serve.

**Duas coisas que verifiquei antes de corrigir:**

1. `enderecoSalvo()` (`:34`) já chama `setEnderecoId(novo.id)`, então o endereço
   cadastrado durante o checkout é selecionado. Esse caminho estava correto, mas
   agora o envio depende dele — por isso virou teste.
2. O `?? enderecos[0]` saiu junto. Com a correção, `enderecoId` nunca é nulo
   enquanto o botão estiver habilitado (`:200` já checa `!enderecoId`), então o
   fallback não tem mais uso. Melhor assim: foi um fallback silencioso que
   permitiu o defeito passar despercebido — na falta de principal ele escolhia
   um endereço qualquer em vez de deixar o problema aparecer.


---

## 3. Problemas que encontrei por conta própria

Os chamados não cobrem tudo. O que segue é o que encontrei por conta própria,
inclusive o que decidi **não** corrigir — com o motivo, em cada caso.

### Problema 1 — Segredos hardcoded e `validarConfig()` inalcançável

| | |
|---|---|
| **O que está errado** | `config.js:16-20` trazia `JWT_SEGREDO`, `ERP_URL` e `ERP_TOKEN` de produção embutidos em `PADRAO`. Dois defeitos no mesmo trecho: (a) a credencial do ERP e o segredo de sessão estavam versionados; (b) como os padrões eram aplicados **antes** da checagem, `validarConfig()` ficava inalcançável — não existe entrada que a faça lançar. Cada um dos cinco `if` já entrava satisfeito: o fallback nunca é vazio, tem 40 caracteres (passa no `< 32`), não é igual à string de exemplo, e é uma URL `https` válida. |
| **Como cheguei nele** | Lendo `config.js` para responder onde ficava a URL do ERP, antes de criar o `.env`. O bloco `NOTA DE REVISAO [KZN-2B9C]` marcava o trecho. |
| **Impacto** | Qualquer deploy sem `.env` sobe assinando sessão com um segredo público. Com ele se forja um cookie `kaizen_sessao` para qualquer `usuario_id` — e todo o isolamento por dono que o `ARQUITETURA.md` descreve ("sempre filtra por `usuario_id`") deixa de proteger, porque a identidade em si é falsificável. Afeta todos os clientes. **Não produz erro em tela e nenhum cliente consegue reportar.** Agravante: o enunciado manda publicar o repositório, o que ampliaria a exposição do token do ERP interno. |
| **Corrigi?** | Sim. `PADRAO` cobre só o que é inofensivo (porta, host, caminho do banco, timeout, origem do CORS); `JWT_SEGREDO`, `ERP_URL` e `ERP_TOKEN` passam a vir do `.env`, sem valor padrão, e sem eles o processo não sobe. A checagem do valor de exemplo do `.env.example`, que já existia, foi mantida. |
| **Arquivos alterados** | `backend/src/config.js` |

Corrigido **antes** dos chamados, em branch separada, porque muda o que pode ser
publicado no repositório. O commit base (`main`) preserva o estado como recebido.

### Problema 2 — Repositório sem `.gitignore`

| | |
|---|---|
| **O que está errado** | Não existia `.gitignore` em lugar nenhum do projeto. |
| **Como cheguei nele** | `find` por arquivos de configuração antes de criar o `.env`. |
| **Impacto** | O `.env` criado a partir do `.env.example` — com o token real do ERP e o segredo JWT — entra no primeiro `git add .`. Combinado com a instrução do enunciado de apagar o `.git` e publicar no GitHub, o caminho feliz do candidato termina com a credencial de um sistema interno num repositório público. `node_modules/` também seria versionado. |
| **Corrigi?** | Sim. `.gitignore` na raiz cobrindo `.env` (com exceção para `.env.example`), `node_modules/`, o banco gerado e o build do front. Criado antes do `git init`. |
| **Arquivos alterados** | `.gitignore` (novo) |

### Problema 3 — `NODE_ENV` inválido desliga o `secure` do cookie em silêncio

| | |
|---|---|
| **O que está errado** | `emProducao` é `config.ambiente === 'production'`, e `NODE_ENV` não era validado contra nenhuma lista. Um typo (`"Production"`, `"prod"`) faz `emProducao` virar `false`. `PORT` e `ERP_TIMEOUT_MS` também não eram checados: `Number("abc")` → `NaN`, e o servidor sobe numa porta aleatória ou com timeout quebrado, sem reclamar. |
| **Como cheguei nele** | Revisando o que `validarConfig()` cobria, ao corrigir o Problema 1: das 10 variáveis do `.env.example`, só 3 tinham checagem — e as 3 estavam derrotadas pelo fallback. |
| **Impacto** | Em produção, o cookie de sessão perde o atributo `secure` e passa a trafegar em HTTP puro, exposto a interceptação. O `ARQUITETURA.md` promete o contrário: *"`secure` liga sozinho em produção"*. Falha silenciosa: nada no log, nada na tela. |
| **Corrigi?** | Sim. `NODE_ENV` validado contra `development \| test \| production`; `PORT` e `ERP_TIMEOUT_MS` validados como inteiros. Os problemas são acumulados e reportados de uma vez, no mesmo espírito do `ColetorDeErros` das rotas. |
| **Arquivos alterados** | `backend/src/config.js` |

### Problema 4 — Artefatos gerados versionados

| | |
|---|---|
| **O que está errado** | `backend/data/ecommerce.db` e `frontend/dist/` estavam rastreados no Git. |
| **Como cheguei nele** | `git ls-files` ao montar o `.gitignore`. |
| **Impacto** | Baixo, mas real: o `.db` é gerado por `npm run db:init` e o `dist/` por `npm run build`. Versionados, divergem da fonte em silêncio — alguém altera o schema e o arquivo commitado continua com a versão antiga. O banco também carregaria dados locais de desenvolvimento para o repositório (no estado recebido ele está vazio, só com schema). |
| **Corrigi?** | Sim, `git rm --cached` nos dois, cobertos pelo `.gitignore`. Os arquivos continuam no disco. |
| **Arquivos alterados** | `.gitignore` |

### Problema 5 — `PATCH /perfil` não aceita atualização parcial, e telefone não pode ser apagado

| | |
|---|---|
| **O que está errado** | Dois defeitos no mesmo fluxo. **(a)** `routes/perfil.js:30-34` exige `nome` e `documento` em toda chamada (`telefone` é opcional) — enviar só `{"telefone":"..."}` devolve `422` cobrando os outros dois. Mas `services/usuarioService.js:86-88` já faz merge (`nome ?? atual.nome`), ou seja, o serviço foi escrito esperando campos ausentes: a rota contradiz o próprio serviço. **(b)** O telefone usa `telefone \|\| atual.telefone`, enquanto nome e documento usam `??`. Com `\|\|`, mandar `null`, `""` ou omitir cai de volta no valor atual — **não existe forma de apagar um telefone já cadastrado**, e a API responde `200` como se tivesse salvo. |
| **Como cheguei nele** | Testando o formato de erro de payload da rota (seção 5). Enviei `{"telefone":"11988887777"}` esperando sucesso e recebi `422` cobrando `nome` e `documento`; fui ao serviço entender e encontrei o merge já pronto. Para (b), gravei um telefone e tentei apagá-lo com `null`, com `""` e omitindo o campo: os três devolveram `200` e o número permaneceu. **Depois foi reproduzido pela própria interface**, apagando o campo na tela de Perfil e salvando — ver abaixo. |
| **Impacto** | **(a)** é defeito apenas de contrato e não afeta o uso atual, porque o front envia o formulário inteiro. O problema aparece quando surgir um segundo consumidor (app, script, integração) que mande só o campo alterado. **(b) é diferente: quebra o uso normal da tela.** Apagar o telefone no formulário de Perfil e salvar devolve `200`, e o número continua lá. Quem cadastrou o número errado e quer apenas removê-lo não consegue — só trocar por outro. Nada no banco impede: `migrations/000_baseline.sql` declara `telefone TEXT` sem `NOT NULL`. |
| **Corrigi?** | **Não.** O enunciado pede para anotar como dúvida o que pode ser decisão de produto, e (a) depende de uma escolha que não é minha: como expressar "limpar o campo". O `textoOpcional` colapsa `undefined`, `null` e `""` no mesmo `null`, então tornar os campos opcionais sem antes decidir isso trocaria um defeito por outro — "ausente" passaria a significar "apague". A correção certa é: campos opcionais, `undefined` = não mexe, `null` explícito = limpa (convenção do JSON Merge Patch, RFC 7396), e `??` em vez de `\|\|` no telefone. Mudar `PATCH` para `PUT` **não** resolveria: o perfil inclui `email`, `id` e `criado_em`, e o e-mail é deliberadamente não editável, então um corpo de PUT nunca seria a representação completa que o verbo exige. |
| **Arquivos alterados** | nenhum |

**A cadeia do (b), camada por camada.** Vale escrever porque a causa não está onde
a rota aponta:

| Camada | O que acontece |
|---|---|
| Tela | `Perfil.jsx:16` inicializa o campo com `usuario.telefone ?? ''`; apagar e salvar envia `""` |
| Rota | `routes/perfil.js:33` chama o validador `telefone(...)` |
| Validador | `validacao.js:167` delega a `textoOpcional`, que devolve `null` para `undefined`, `null` **e** `""` |
| Serviço | `usuarioService.js:87` faz `telefone \|\| atual.telefone` — `null` é falsy, o número antigo volta |
| Banco | `telefone TEXT` (sem `NOT NULL`) aceitaria `NULL` sem reclamar |

A tela responde `200` e mostra o número de volta. Nenhuma camada recusa a
operação; ela simplesmente não acontece.

**Mesmo assim mantive sem corrigir**, por coerência com o resto desta entrega:
é fora do escopo dos chamados abertos, e as duas metades do problema vivem na
mesma função. Trocar só o `\|\|` por `??` resolveria o telefone e deixaria `nome` e
`documento` com a semântica de substituição — meia correção, que esconde a outra
metade em vez de resolvê-la. Prefiro o registro inteiro aqui a um remendo que
tira o sintoma mais visível de cena.

Verifiquei as outras rotas e **este é o único caso divergente**:
`PATCH /carrinho/itens/:codigo` pede só `quantidade`, que é o único campo mutável
do item; `PUT /enderecos/:id` exige a representação completa, que é o correto
para PUT; `PATCH /perfil/senha` é ação, não edição parcial de recurso; e os
`POST` exigem tudo por serem criação.

### Problema 6 — A borda do carrinho aceita em silêncio o que deveria recusar

| | |
|---|---|
| **O que está errado** | `adicionarItem` (`carrinhoService.js:148`) faz `Math.min(MAXIMO_POR_ITEM, existente + quantidade)` **antes** da checagem de estoque da linha 150. O estoque até é conferido — mas contra o valor já cortado, não contra o que a pessoa pediu. Com 90 no carrinho e mais 50 pedidos: `min(99, 140) = 99`, a checagem pergunta "tem 99?", tem, passa, e a linha 137 grava 99. Resposta `201`, **41 unidades somem sem uma palavra**. Sem o `Math.min` ali, a pergunta seria "tem 140?" e a resposta seria `409 ESTOQUE_INSUFICIENTE`. A rota não cobre: ela valida a parcela (`quantidade` ≤ 99), não a soma. |
| **Como cheguei nele** | Conferindo onde a quantidade é validada, ao escrever os testes do KZN-312. Verifiquei com um teste descartável: 90 + 50 → 99, sem erro. |
| **Impacto** | Baixo em volume, real em confiança. Uma oficina montando orçamento grande pede 140 unidades, recebe confirmação e leva 99 — descobre na entrega. É o oposto do que o resto do service faz: estoque insuficiente vira `409` explícito, com `estoque_disponivel` nos detalhes. Não produz erro em tela e nenhum cliente consegue reportar com precisão. |
| **Corrigi?** | **Ainda não.** Está fora do escopo dos dois chamados desta branch, e a correção tem uma escolha de produto embutida: recusar com `409 LIMITE_POR_ITEM` (coerente com o tratamento de estoque) ou aceitar o corte e informar, devolvendo quanto de fato entrou. Prefiro o `409`, pelo mesmo motivo do KZN-312: a resposta não pode afirmar algo diferente do que aconteceu. |
| **Arquivos alterados** | nenhum |

**Observação — a mesma postura aparece em `alterarQuantidade`, por outro caminho.**

`buscarProduto` tem três desfechos, não dois: devolve o produto, **lança** `ApiError`
(404, 401, 5xx, timeout), ou devolve `null` — este último quando o ERP responde
`200` sem `dados`, caso de proxy devolvendo HTML, gateway vazio ou deploy pela
metade (`erp/cliente.js`, `return json?.dados ?? null`).

Diante desse `null`, as duas funções decidem o contrário uma da outra:

- `adicionarItem:136` → `if (!produto) throw ApiError.naoEncontrado(...)` — recusa.
- `alterarQuantidade:198` → `if (produto && produto.estoque < quantidade)` — o
  `&&` curto-circuita, o `if` não entra, e a linha 206 grava a quantidade **sem
  ter conferido estoque nenhum**.

Confirmei com teste descartável: mockando `buscarProduto` para devolver `null`,
a quantidade foi para 99 e a chamada respondeu sucesso.

**O alcance é limitado** — e vale registrar, para não superdimensionar: a leitura seguinte do
carrinho marca a linha como indisponível e `pronto_para_checkout` fica `false`,
então nenhum pedido ruim passa. O que se perde é o momento e o rótulo do erro:
a pessoa recebe `200`, e só na tela seguinte vê o item bloqueado com uma
mensagem que fala de catálogo quando o que houve foi uma resposta malformada do ERP.

A assimetria preocupa mais que o sintoma. Diante da mesma incerteza, um
caminho recusa e o outro deixa passar — não dá para ler o código e saber qual é
a regra da casa. É o mesmo tipo de divergência interna que produziu o KZN-312.
Correção: `if (!produto) throw ApiError.naoEncontrado(...)` antes da checagem,
igual ao `adicionarItem`.

### Problema 7 — `verificarErp` ignora o `ERP_TIMEOUT_MS`

| | |
|---|---|
| **O que está errado** | `erp/cliente.js:156` usa `AbortSignal.timeout(3000)` fixo. Todo o resto do cliente respeita `config.erp.timeoutMs`; só a sonda de inicialização não. A variável existe, está documentada no `.env.example` e não vale para o único ponto que fala com o ERP antes de qualquer cliente aparecer. |
| **Como cheguei nele** | O backend subiu imprimindo `ERP: ... -> INDISPONIVEL (timeout)` com o ERP de pé. Medi: `curl` respondeu em 0,97 s e o `fetch` do Node em 34–412 ms em quatro tentativas. O ERP estava normal; foi o primeiro acesso, com DNS e TLS frios, esbarrando num limite mais apertado que o configurado. |
| **Impacto** | Nenhum para quem compra — a sonda não derruba o processo e a aplicação funciona. O dano é de diagnóstico: quem sobe o projeto lê "INDISPONIVEL" e investiga um problema de rede que não existe, ou assume que o ambiente está quebrado e interrompe o trabalho. O aviso aponta para o lugar errado. |
| **Corrigi?** | **Não**, pelo mesmo motivo do Problema 6: não é dos chamados desta branch. A correção é trocar o literal por `config.erp.timeoutMs`. Vale discutir se a sonda deveria ter limite próprio e **menor** que o das requisições — não travar a subida por 8 s é defensável —, mas então ele precisa ser uma variável declarada, não um número solto no meio do arquivo. |
| **Arquivos alterados** | nenhum |

### Problema 8 — CPF aceita letras, e o valor sujo é gravado e enviado ao ERP

| | |
|---|---|
| **O que está errado** | `validacao.js:125-135` limpa os não-dígitos **só para contar** e depois devolve a string original: `const digitos = texto.replace(/\D/g, ''); if (digitos.length !== 11 && ...) ...; return texto;`. Então `12345678901ab` tem 11 dígitos, passa na checagem, e é gravado **com as letras**. Os validadores vizinhos fazem o contrário: `cep()` devolve `12345-678` normalizado e `uf()` devolve a sigla em maiúscula. Só o `documento` valida o valor limpo e persiste o sujo. |
| **Como cheguei nele** | Reportado por teste manual no Perfil: CPF correto seguido de duas letras aleatórias foi salvo. Confirmado no código em seguida. |
| **Impacto** | O `documento` não fica só no banco: `pedidoService.js:54` o envia ao ERP como `cliente.documento` ao fechar o pedido. Documento malformado entra no sistema interno e no que vier dele — nota, cobrança, busca por cliente. Também quebra a identificação: o mesmo CPF com e sem sufixo vira duas strings diferentes, e nada no banco impede. |
| **Corrigi?** | **Não** — fora do escopo do chamado desta branch. A correção tem duas partes: recusar entrada com caractere não permitido em vez de ignorá-lo, e devolver o valor normalizado (só dígitos, ou máscara fixa), como `cep()` e `uf()` já fazem. O `ARQUITETURA.md:269` registra "sem validação de dígito de CPF/CNPJ — só o tamanho", o que é decisão consciente e respeito; **aceitar letras é outra coisa** — não é falta de dígito verificador, é o validador contradizendo o próprio critério que usou para aprovar. |
| **Arquivos alterados** | nenhum |

### Problema 9 — Editar endereço pela API rebaixa o principal em silêncio

| | |
|---|---|
| **O que está errado** | `routes/enderecos.js:35` monta `principal: lerBooleano(corpo.principal) ?? false`. Como `lerBooleano` devolve `null` tanto para campo ausente quanto para valor irreconhecível, `dados.principal` chega ao serviço **sempre** como booleano. Mas `enderecoService.js:84-86` foi escrito esperando o contrário: `dados.principal === undefined ? atual.principal : (...)`. O ramo que preservaria o valor atual é inalcançável, e um `PUT` sem o campo rebaixa o endereço principal a comum, respondendo `200`. |
| **Como cheguei nele** | Auditando a criação e edição de endereço a pedido, depois do KZN-331. Reproduzido pela API real contra o backend em execução: criei conta e dois endereços, editei o principal sem enviar o campo e ele voltou com `principal=false`; enviei `"principal":"yes"` e também virou `false`, sem `422`. O usuário terminou **sem nenhum endereço principal**. |
| **Impacto** | Ficar sem principal não é estado inócuo: `listarEnderecos` ordena por `principal DESC`, e o checkout (antes da correção do KZN-331) escolhia `find(principal) ?? enderecos[0]` — sem principal, o pedido ia para o endereço mais antigo. Os dois defeitos se somavam para entregar no lugar errado. A interface escapa porque o `FormularioEndereco` espalha `...endereco` e sempre reenvia o campo; é proteção acidental, não garantia do backend. |
| **Corrigi?** | **Não** — fora do escopo do chamado. A correção tem três partes, e a primeira já existe: o validador de booleano para corpo de requisição foi escrito para os carrinhos (`validacao.js:202`, `lerBooleanoDeCorpo`, usado em `routes/carrinhos.js:53` e coberto por testes) — devolve `undefined` quando ausente e acusa `422` quando inválido, sem mexer no `lerBooleano`, que também serve query string do catálogo, onde tolerância é adequada. Falta aplicá-lo aqui, tornar alcançável o ramo que preserva o valor atual e proteger a invariante. |
| **Arquivos alterados** | nenhum |

**A invariante que falta.** `removerEndereco` (`:121-129`) promove o endereço mais
antigo quando o principal é apagado, com o comentário *"para o checkout nunca
ficar sem endereço padrão"*. `atualizarEndereco` cria exatamente esse estado.
Duas funções do mesmo arquivo, regras opostas sobre a mesma regra de negócio.

**Falta também o guarda no banco.** `enderecos.principal` tem o
`CHECK (… IN (0,1))`, mas **não** um índice único parcial — "um principal por
usuário" só existe na aplicação, e é por isso que dá para violá-lo. Um
`CREATE UNIQUE INDEX … ON enderecos(usuario_id) WHERE principal = 1` impediria
**dois** principais no próprio banco (não o *zero* deste problema, que é bug de
lógica à parte). A tabela `carrinhos`, criada na funcionalidade nova (seção 4),
já nasce com exatamente esse índice — é a lição deste problema aplicada; o
`enderecos` deveria ganhá-lo também.

**O que não é defeito e vale registrar.** A UF **é** validada contra a lista das
27 siglas (`validacao.js:149-165`), com normalização para maiúscula. Esse ponto
está correto.

**Sugestão, não defeito — CEP.** O `ARQUITETURA.md:267-268` já declara que o CEP
valida só formato e que integrar o ViaCEP para preencher o endereço "seria uma
melhoria natural". Concordo, e acrescento o que o documento não menciona: hoje
**nada verifica a coerência entre CEP, cidade e UF**. É possível cadastrar CEP de
São Paulo com `uf: DF` e bairro de outra cidade, e o sistema aceita — encontrei
esse caso nos dados de desenvolvimento. Preencher a partir do CEP resolve os dois
de uma vez: tira o trabalho de digitação e elimina a divergência por construção.
Num sistema cujo chamado de maior prioridade é entrega no endereço errado, isso
deixa de ser conveniência e vira integridade do dado.

### Problema 10 — A última página do catálogo é inalcançável pelo botão "Próxima"

| | |
|---|---|
| **O que está errado** | `ui.jsx`, componente `Paginacao`: o botão "Próxima" usa `disabled={pagina >= totalPaginas - 1}`. O limite é `totalPaginas`, não `totalPaginas - 1`. Com 5 páginas, o botão desabilita ao chegar na 4; com 2 páginas — o menor caso em que a paginação aparece, já que ela se esconde com `total_paginas <= 1` — ele nasce desabilitado e a página 2 nunca é alcançada. O botão "Anterior" ao lado usa `pagina <= 1`, que está correto. |
| **Como cheguei nele** | Lendo o componente de paginação durante o KZN-325, porque a correção mexe em quem decide a página. Confirmado com um teste descartável montando `Paginacao` direto: com 2 páginas o botão nasce desabilitado; com 5, trava na 4. |
| **Impacto** | É o mesmo prejuízo do chamado por outro caminho: peça que existe e não aparece. A última página de **toda** listagem fica fora do alcance da navegação. Silencioso, ainda por cima: botão desabilitado parece fim de lista, não defeito. |
| **Corrigi?** | **Não** — não é o chamado desta branch, e misturar deixaria o commit contando duas histórias. A correção é trocar o limite por `pagina >= totalPaginas` e cobrir com teste o caso de duas páginas, que é onde o erro é total e não parcial. |
| **Arquivos alterados** | nenhum |

**Em "Meus pedidos" não há contorno.** A vitrine guarda a página na URL, então
dá para digitar `?pagina=3` e escapar do botão. `Pedidos.jsx:9` guarda a página
em `useState`: não existe URL para forçar. Quem tiver mais de dez pedidos não
alcança os mais antigos por nenhum caminho da interface — o botão é a única
porta, e ela está trancada uma página antes do fim.

Confirmei com o banco de desenvolvimento populado até três páginas: a listagem
pelo service responde `total_paginas: 3` e a tela trava na página 2.

**O defeito do KZN-325 não se repete nos pedidos, e por construção.**
`Pedidos.jsx` não tem filtro nenhum e a página não vive na URL. Sem filtro que
troque o resultado, não existe a situação em que a posição antiga deixa de
valer. A causa raiz do chamado é específica da vitrine; o que as duas telas
compartilham é o componente de paginação.

**Dois pontos menores na mesma tela**, que não classifico como defeito:

1. `Pedidos.jsx:42` — lista vazia sempre diz "Você ainda não fez pedidos". Numa
   página vazia a frase mente, e a paginação some junto, porque o `return` vem
   antes dela. Hoje é latente: o botão quebrado impede chegar lá. Corrigido o
   botão, o caminho abre. É o mesmo mal-entendido do KZN-325 — página vazia
   tratada como coleção vazia.
2. `Pedidos.jsx:36` — trocar de página substitui a lista inteira por
   "Carregando seus pedidos...". É incômodo, não incorreção.

### Problema 11 — A borda do catálogo não valida nada e terceiriza a validação ao ERP

| | |
|---|---|
| **O que está errado** | `routes/catalogo.js:20-30` repassa `busca`, `categoria` e `marca` crus para o ERP. Só `pagina`, `tamanho` e `somente_disponiveis` passam por alguma leitura (`lerPaginacao`, `lerBooleano`), e mesmo essas não recusam nada: corrigem em silêncio. Não há tipo, tamanho, formato nem conjunto de valores aceitos. Quem recusa entrada inválida é o ERP. |
| **Como cheguei nele** | Perguntado durante a revisão do KZN-325, verificado contra a loja em execução. |
| **Impacto** | Três consequências, em ordem de gravidade. **(1)** `categoria=XPTO` devolve `200` com lista vazia, e a tela diz "Nenhuma peça encontrada" — o mesmo mal-entendido do KZN-325, vazio confundido com inexistente. Uma categoria inválida não é uma busca sem resultado: é uma pergunta malformada, e merece `422`. **(2)** `busca` com 5000 caracteres é recusada — **pelo ERP**, com `422 "Filtros invalidos."`, e a mensagem dele atravessa a loja e chega ao cliente. A loja depende de um terceiro para validar a própria entrada, e vaza o vocabulário desse terceiro. **(3)** `somente_disponiveis=banana` é ignorado: `lerBooleano` devolve `null`, o filtro não é aplicado e a resposta é `200` com tudo. A pessoa pediu "só com estoque", recebeu o catálogo inteiro e nada avisou. É o mesmo defeito de fundo do Problema 9. |
| **Corrigi?** | **Não** — fora do escopo do chamado. A correção é validar na borda, como `routes/pedidos.js` e `routes/enderecos.js` já fazem com o corpo: `busca` como texto opcional com tamanho máximo; `categoria` e `marca` contra a lista que o ERP conhece (`GET /produtos/categorias` já existe e o catálogo já a consome); booleano de query que acuse valor irreconhecível em vez de engolir. O `ColetorDeErros` do `validacao.js` já faz exatamente isso para corpo — falta a versão para query. |
| **Arquivos alterados** | nenhum |

**`categoria` deveria ser um conjunto fechado.** É o ponto mais barato de todos:
a lista de categorias válidas já é servida pelo próprio backend em
`/api/catalogo/categorias`, que a vitrine usa para montar os botões de filtro. O
mesmo dado que desenha a interface deveria governar a validação — e hoje não
governa nada. O `uf()` do `validacao.js:149-165` já é esse padrão, validando
contra as 27 siglas; falta aplicá-lo aqui.

**`marca` é filtro morto.** O ERP suporta (`?marca=Cofap` devolve exatamente os
produtos da Cofap), a loja repassa, e **nenhuma tela do front envia**. Procurei:
`marca` aparece no `CardProduto` e na página de produto, só como texto exibido.
É um filtro alcançável apenas chamando a API diretamente. Ou a vitrine ganha o
filtro de marca — e aí ele precisa de validação como a categoria —, ou o
parâmetro sai da rota. Mantê-lo sem uso e sem validação é o pior dos três.

**Sobre SQL injection: não há, e não é por sorte.** Verifiquei o backend inteiro.
Toda consulta usa *prepared statement* do `better-sqlite3` com parâmetros
ligados (`?` posicional ou `@nome`); não existe uma única query montada por
concatenação ou template string. O `db.exec()` com variável só aparece no runner
de migração (`db/migracoes.js`), que recebe o SQL dos arquivos de migração lidos
do disco, não entrada de usuário.
Testei `?busca=' OR 1=1--` e a resposta foi `200` com zero resultados — o texto
foi tratado como texto. Some-se a isso que o catálogo **nem toca no banco**: ele
conversa com o ERP, e os parâmetros vão por `URLSearchParams`
(`erp/cliente.js:22-30`), que escapa o valor, então também não dá para injetar
parâmetro na URL do ERP.

A ressalva honesta: isso protege contra injeção, **não** contra entrada inválida.
São problemas diferentes, e o segundo é o que está aberto. Dado não validado que
não quebra o banco ainda produz resposta errada, mensagem errada e, no caso do
`documento` (Problema 8), dado sujo persistido e enviado ao ERP.

**O ERP é caixa-preta, e isso reforça a borda em vez de dispensá-la.** Não
conhecemos o interior do ERP e não o testamos — procurar falha em sistema de
terceiro, compartilhado com outros candidatos e sem autorização, está fora do
escopo deste teste. A conclusão "sem injeção" acima vale para o **código da
loja**, não para o que está atrás dela. Justamente por não sabermos como o ERP
trata o que recebe, a loja não pode terceirizar a ele a validação da entrada:
hoje `busca`, `categoria` e `marca` chegam crus na porta de um sistema cujo
estado interno desconhecemos, e a loja seria o veículo de qualquer entrada
hostil. Uma borda que só aceita o que é válido reduz a superfície do que alcança
o ERP, qualquer que seja esse estado — defesa em profundidade: cada camada
protege a seguinte sem supor que a seguinte se protege. Nota técnica: o
`URLSearchParams` (`erp/cliente.js:22-30`) faz *percent-encoding*, o que impede
quebrar a estrutura da URL do ERP, mas não impede enviar um valor hostil dentro
de um parâmetro bem-formado — o encoding protege o transporte, não o destino.

**Sugestão — `QUERY` em vez de `GET` para a busca com filtros.** O método existe
e é padrão desde a RFC 10008: seguro e idempotente como o `GET`, mas com corpo,
o que resolve filtro que não cabe confortavelmente em query string e evita termo
de busca em log de acesso e em histórico de navegador. Registro como
possibilidade, não como recomendação para agora, por duas razões: os filtros
daqui cabem folgadamente numa query string, e o suporte prático em
infraestrutura intermediária (proxy, cache, CDN) ainda é irregular. Há também um
custo concreto no projeto: a vitrine depende de a busca estar na URL — é o que
torna o link compartilhável e o botão voltar funcional, decisão registrada no
comentário de `Catalogo.jsx:9-13`. Trocar para `QUERY` entraria em conflito com
isso.

### Problema 12 — Limpar a busca não limpa o campo de busca do cabeçalho

| | |
|---|---|
| **O que está errado** | `Cabecalho.jsx:56` guarda o termo em `useState(parametros.get('busca') ?? '')`. O valor inicial é lido **uma vez**, na montagem. O cabeçalho fica fora das `Routes` (`App.jsx:49`), então nunca desmonta: a partir daí o campo é um estado independente da URL. Quem limpa a busca por fora do formulário — o link "limpar" da vitrine (`Catalogo.jsx:163`), o botão "Limpar filtros" do estado vazio (`Catalogo.jsx:181`) ou o voltar do navegador — muda a URL e os resultados, e o campo continua exibindo o termo antigo. |
| **Como cheguei nele** | Reportado pelo Artur a partir do uso da loja: com `?categoria=SUSPENSAO&busca=caixa`, clicar em "limpar" leva a URL para `?categoria=SUSPENSAO` e traz os produtos de volta, mas o campo do topo segue escrito "caixa". Confirmado com um teste descartável montando `Cabecalho` e `Catalogo` no mesmo roteador, que reproduz os três caminhos. |
| **Impacto** | A tela passa a afirmar duas coisas diferentes ao mesmo tempo: a lista mostra o catálogo inteiro da categoria e o campo diz que há uma busca por "caixa" ativa. Não é só confusão visual — o campo defasado é o que vai ser submetido. Dar Enter sem digitar nada (ou digitar no fim do termo que ficou lá) **ressuscita a busca que o cliente acabou de limpar**: a consulta volta com `busca=caixa`. O mesmo vale para o voltar do navegador, que a vitrine promete suportar no comentário de `Catalogo.jsx:9-13` — a URL volta, o campo não. O defeito é silencioso e o contorno não é óbvio: é preciso apagar o campo à mão. |
| **Corrigi?** | **Não** — é defeito da entrega como recebida, não da funcionalidade nova, e corrigi-lo aqui misturaria assuntos no commit. A correção é fazer o campo seguir a URL em vez de copiá-la na montagem: ressincronizar o estado quando `parametros.get('busca')` muda (`useEffect` com o termo da URL na lista de dependências) — mantendo o estado local, que é o que permite digitar sem refazer a consulta a cada tecla. O teste que falta é o que não existe hoje em `Cabecalho.test.jsx`: os testes de lá afirmam o que a busca escreve na URL, nenhum afirma o que a URL escreve no campo. |
| **Arquivos alterados** | nenhum |

**Por que os testes atuais não pegam.** `Cabecalho.test.jsx` monta o cabeçalho
sozinho e `Catalogo.test.jsx` monta a vitrine sozinha. O defeito só aparece com
os dois no mesmo roteador, porque é exatamente a sincronia entre eles que está
faltando. Cada componente, isolado, está correto: a vitrine limpa a URL, o
cabeçalho lê a URL na montagem.

**O mesmo padrão não se repete nos outros filtros.** Categoria e "só com
estoque" leem direto de `parametros` a cada render (`Catalogo.jsx:28-31`), sem
cópia em `useState` — por isso o botão da categoria acompanha o voltar do
navegador e o campo de busca não. A busca é a única que mantém estado paralelo,
e mantém por um motivo legítimo: é um campo de digitação, e ler da URL a cada
tecla faria uma consulta por caractere. O erro não é ter estado local; é nunca
reconciliá-lo com a URL.

### Problema 13 — A loja não cabe na tela do celular, e o carrinho abre fora de lugar

| | |
|---|---|
| **O que está errado** | A 375px de largura o documento tinha **707px** — a página inteira rolava no eixo horizontal. Duas origens, ambas intactas desde a entrega (as linhas são as do arquivo **como recebido**): `Cabecalho.jsx:71` punha `min-w-[380px]` no formulário de busca, que assim não encolhe abaixo de 380px e, sozinho, já é mais largo que a tela; e `Catalogo.jsx:188` fixava `grid grid-cols-4` sem prefixo responsivo, o que no celular produz cards de **74px**, com o nome da peça quebrando uma palavra por linha ("Bomba / de / Agua"). São os dois pontos que produziam o estouro na vitrine, que é a tela de entrada da loja; `Checkout`, `Carrinho`, `Perfil`, `Produto` e `FormularioEndereco` já usavam `sm:`/`lg:`. (Duas telas continuam sem nenhum prefixo responsivo e não foram medidas: `Pedidos.jsx` — que ainda tem um `min-w-[160px]` na linha 64 — e `CardProduto.jsx`.) |
| **Como cheguei nele** | Reportado pelo Artur ao abrir o carrinho no celular: o painel aparecia deslocado e exigia rolar na horizontal para ser visto inteiro. O painel era sintoma, não causa — um `<dialog>` modal se posiciona pela viewport (375px), não pelo documento (707px), então ele fica correto e o resto da página é que está deslocado. Medido com o navegador real: 332px de estouro e sete elementos fora da tela. |
| **Impacto** | Atinge toda a navegação por celular, que é de onde vem a maior parte do acesso a uma loja de peças. A barra do topo fica cortada — o cliente precisa rolar para o lado para alcançar "Pedidos", "Perfil" ou o carrinho —, e a vitrine fica ilegível. Não produz erro em tela: a loja parece funcionar e simplesmente não cabe. |
| **Corrigi?** | **Sim** — o único defeito de comportamento desta seção que corrigi (os Problemas 1 a 4 também foram, mas são de segurança e configuração, resolvidos antes dos chamados). Corrigi porque ele aparece em cima da funcionalidade nova: o painel do carrinho nasce quebrado enquanto a página estiver mais larga que a tela, e entregar a funcionalidade assim seria entregá-la defeituosa. A correção mínima são duas linhas (o `min-w` e o grid); o resto do que fiz está detalhado abaixo. |
| **Arquivos alterados** | `frontend/src/componentes/Cabecalho.jsx`, `frontend/src/paginas/Catalogo.jsx`, `frontend/src/App.jsx`, `frontend/src/componentes/ui.jsx`, `frontend/src/componentes/MenuNavegacao.jsx` (novo), `frontend/src/hooks/useDialogoAnimado.js` (novo), `frontend/src/componentes/PainelCarrinho.jsx`, `frontend/src/index.css`, `frontend/test/Cabecalho.test.jsx` |

**O que mudou, por largura.** Abaixo de `sm` o cabeçalho mostra só o quadrado do
`K` — o nome da marca continua no DOM como `sr-only`, senão o link da vitrine
ficaria com "K" por nome acessível —, com carrinho e menu à direita e a busca
numa segunda linha. De `sm` a `lg` tudo cabe numa linha só. De `lg` para cima o
layout é o mesmo da entrega: navegação escrita, carrinho com rótulo, busca com
os 380px originais — o que mudou ali foi o destino do botão do carrinho, que
abre o painel em vez de navegar, e isso veio da funcionalidade nova, não deste
ajuste.

**A navegação escrita virou um menu abaixo do `lg` — mas só para quem entrou.**
Com sessão aberta são quatro itens, que não cabem ao lado da busca: medi 277px
de itens para 236px disponíveis a 320px. O menu é um `<dialog>` modal
(`MenuNavegacao.jsx`), pelo mesmo motivo do painel do carrinho: foco preso,
Escape e fundo inerte vêm do elemento, não de código nosso.

Deslogado são dois itens, "Entrar" e "Criar conta", e eles cabem ao lado do logo
em qualquer largura — conferido até 320px, com folga. Ficam na barra. Esconder
o caminho de quem ainda vai virar cliente atrás de um ícone genérico seria pagar
em cadastro por uma economia de espaço que não é necessária. Sem sessão o menu
não existe: nem o botão, nem o diálogo no DOM.

**O botão flutuante do carrinho saiu.** Ele existia só no celular e, com o
carrinho agora presente no cabeçalho em qualquer largura, era um segundo caminho
para a mesma ação — além de cobrir o "Adicionar" do último card visível. O
contador continua no ícone.

**Três defeitos de comportamento apareceram durante a correção**, todos
corrigidos:

1. **O painel do carrinho não tinha animação** e aparecia seco. Entrada por
   `@starting-style`, saída por um atributo que dispara a transição antes do
   `close()` — Firefox e Safari não animam saída de top layer sozinhos. O
   movimento é desligado por `prefers-reduced-motion`.
2. **Ao fechar, o painel fechava, reabria e fechava.** O atributo de saída era
   removido junto com o `close()`, e como a transição discreta de `display`
   mantém o elemento renderizado por mais alguns quadros, ele usava esse tempo
   para animar de volta. O atributo agora só sai na reabertura.
3. **O `<dialog>` rolava inteiro**, levando embora o próprio cabeçalho e o
   rodapé. Um `<dialog>` nasce com `overflow: auto`, e o transbordo da lista de
   itens entra no `scrollHeight` dele: 1452px de conteúdo para 1008px de caixa.
   Agora o diálogo não rola; rola a lista.

**A rolagem do fundo.** `showModal()` torna a página inerte para clique e
teclado, **não** para rolagem: com o carrinho aberto, o gesto sobre o fundo
rolava a vitrine 800px. `index.css:79-97` contém a rolagem no diálogo e no
`::backdrop` e trava o `<html>` enquanto houver modal aberto, devolvendo a
largura da barra como `padding-right` para a página não saltar. A posição de
leitura é preservada e volta a rolar ao fechar.

**Por que não há teste de unidade para nada disso.** O jsdom não calcula
layout — nenhuma largura, nenhuma media query — e a versão 30 não implementa
`showModal`, então um teste lá não distingue painel aberto de fechado. Os testes
que acrescentei afirmam o que o jsdom alcança: estado do hambúrguer, conteúdo do
menu, destinos dos links e o contador nos dois caminhos do carrinho. O resto foi
verificado medindo no navegador: largura do documento e elementos fora da tela
em 320, 360, 375, 390, 414, 640, 768, 1023, 1024 e 1280; posições intermediárias
das animações nos dois sentidos; e a rolagem do fundo presa em 600 durante um
gesto de 900px, voltando a rolar depois de fechar.

**Uma review do código, depois de tudo pronto, achou mais três coisas** — duas
delas latentes, que é o tipo que não aparece em teste manual:

1. **O hook esperava animação sem prazo.** Ele aguardava *todas* as animações
   dentro do painel antes de fechar. Nenhuma delas é infinita hoje, mas bastaria
   alguém passar `carregando` a um botão do painel para a espera nunca terminar
   — e o diálogo ficaria modal para sempre, fora da tela, com a página inerte e
   o foco preso. Agora ele só espera as animações do próprio painel (e do
   `::backdrop`) e tem teto de 600ms.
2. **O menu ficava cortado em tela baixa.** A 740×200 o conteúdo pedia 228px
   dentro de um diálogo de 162px com `overflow-hidden`: o "Sair" caía fora e não
   havia rolagem que o alcançasse. O menu não tem cabeçalho fixo a preservar,
   então quem rola passou a ser a folha inteira.
3. **O painel do carrinho reabria sozinho** se a sessão caísse com ele aberto —
   o componente desmontava sem baixar o estado, e no login seguinte ele voltava
   aberto.

   Junto vieram três ajustes menores: os botões de carrinho passaram a anunciar
   que abrem um painel (`aria-haspopup`/`aria-expanded`, que só o hambúrguer
   tinha), o menu ganhou um título na árvore de cabeçalhos e um comentário do
   `index.css` que descrevia uma decisão oposta à do código foi corrigido.

**O hook ganhou os testes que faltavam.** O "fecha, reabre e fecha" era lógica
nossa, não comportamento de navegador, e estava sem cobertura. São seis casos
sobre um dublê do `<dialog>` — o jsdom não implementa `show`, `showModal` nem
`close`, então um elemento de verdade ali não abriria. Conferi que eles pegam o
que prometem mutando o código: reintroduzir a remoção do atributo, tirar o teto
de tempo e tirar o filtro de animações derrubam um teste cada.

**O que não consegui verificar.** O Chromium sem interface só usa barra de
rolagem sobreposta, de largura zero. A compensação do `padding-right` está
correta no encanamento — com a variável em 15px o `padding` vira 15px —, mas o
efeito visual de a barra do fundo desaparecer sem a página saltar só foi
conferido a olho, no navegador do dia a dia.

---

## 4. Múltiplos carrinhos

### Como ficou

Cada cliente mantém vários carrinhos nomeados ("Gol do João", "Civic prata"),
troca entre eles, renomeia e remove. Um deles é o **principal** — o ativo: o que
o botão "adicionar" da vitrine preenche, o que aparece no painel e o que o
checkout fecha. O carrinho é editável **sem sair da página de peças**, num painel
que desliza sobre a vitrine (bottom sheet no celular), então a busca e o scroll
nunca se perdem. O checkout fecha um carrinho por vez; os outros ficam intactos.

### Modelagem

Tabela nova `carrinhos` e `carrinho_itens` passou a pertencer a um carrinho, não
mais ao usuário.

- **`carrinhos`**: `id`, `usuario_id` (FK, `ON DELETE CASCADE`), `titulo`
  (`CHECK length <= 60`), `descricao` (`CHECK length <= 200`, nullable),
  `principal` (`INTEGER 0/1 CHECK`), `criado_em`, `atualizado_em`. Índice único
  **parcial** `ON (usuario_id) WHERE principal = 1`: o banco garante no máximo um
  principal por usuário (não só a aplicação).
- **`carrinho_itens`**: ganhou `carrinho_id` (FK, `ON DELETE CASCADE`), o
  `UNIQUE` virou `(carrinho_id, codigo_produto)` e o `usuario_id` **saiu** — o
  dono é alcançado só via `carrinhos`. Esse `UNIQUE` é também o índice de
  leitura: ele começa por `carrinho_id`, que é como todas as consultas de item
  filtram, então não há índice declarado só para essa coluna (seção 7, item 13).
- **Migração** (`src/db/migrations/001`): reconstrói `carrinho_itens` (o SQLite
  não altera `UNIQUE`/FK por `ALTER`) e faz backfill — quem já tinha itens ganha
  um "Carrinho 1" principal com eles. Introduzi também um runner de migração
  (`schema_migrations`), que faltava no projeto.

Mudanças no contrato da API:

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/carrinhos` | Lista os carrinhos (resumo local: nome, principal, contagens). Não toca o ERP. |
| POST | `/api/carrinhos` | Cria `{titulo, descricao?, principal?}`. Limite de 10 → `409`. |
| GET | `/api/carrinhos/:id` | Um carrinho com itens enriquecidos pelo ERP. |
| PATCH | `/api/carrinhos/:id` | Renomeia / edita descrição. |
| PUT | `/api/carrinhos/:id/principal` | Marca como principal (trocar de ativo). |
| DELETE | `/api/carrinhos/:id` | Apaga; promove o principal mais recente, ou zera. |
| POST | `/api/carrinhos/itens` | Adiciona na ativa (cria "Carrinho 1" se não houver). |
| PATCH | `/api/carrinhos/:id/itens/:codigo` | Altera quantidade. |
| DELETE | `/api/carrinhos/:id/itens/:codigo` | Remove item. |
| DELETE | `/api/carrinhos/:id/itens` | Esvazia o carrinho. |
| POST | `/api/pedidos` | Passou a receber `carrinho_id` (o ativo que está sendo fechado). |

As rotas `/api/carrinho/*` (singular) foram substituídas pelas de cima.

### Decisões que o enunciado deixou abertas

| Pergunta | Sua decisão | Motivo |
|---|---|---|
| Quantos carrinhos por pessoa? Tem limite? | 10. | Suficiente para uma oficina com vários orçamentos; protege o ERP (cada leitura de carrinho faz uma chamada por item) e mantém o seletor usável. Constante, como `MAXIMO_ITENS` já era. |
| O que acontece ao apagar o carrinho ativo? | Se sobram outros, o mais recente vira principal; se era o único, fica em **zero carrinhos** (a tela convida a criar). | Mantém a invariante "há um ativo quando há carrinhos" sem criar carrinho à toa. É o mesmo comportamento que `removerEndereco` já tinha para endereços. |
| Como o carrinho aparece na vitrine? | Painel deslizante (`<dialog>` modal) pela direita, sobre a vitrine inerte. Entra e sai animado (ver Problema 13). | Preserva a busca/scroll por construção (mesma rota, nada desmonta), não mexe na grade da vitrine e é simétrico com o mobile. |
| E no celular? | Bottom sheet, aberto pelo ícone de carrinho do cabeçalho. | Padrão nativo conhecido. A decisão original era um botão flutuante; ele saiu no Problema 13, por duplicar o caminho do cabeçalho e cobrir o "Adicionar" dos cards. A vitrine atrás fica inerte **e** travada: o modal não impede rolagem por conta própria, e duas barras disputando o eixo Y confundem. |
| Qual carrinho vem selecionado ao entrar? | O principal. | Trocar de carrinho = marcar principal, e o principal persiste no servidor — a pessoa retoma onde estava, mesmo em outro aparelho. Reaproveita o padrão de `enderecos.principal`. |
| O que acontece com os carrinhos após fechar um pedido? | O carrinho fechado é **removido** (reusando a regra de apagar); os outros ficam. | Uma regra só — "fechar pedido = criar pedido + remover aquele carrinho" — coerente com a decisão de apagar. Evita acumular carrinhos vazios. |

Uma ponta que essas decisões criam, e como resolvi: se a pessoa está com zero
carrinhos e clica "adicionar" na vitrine, o servidor **cria "Carrinho 1"
principal na hora** e põe a peça nele (criação preguiçosa atômica). Nunca há beco
sem saída, e não se cria carrinho antes de a pessoa usar.

### Isolamento

Toda operação resolve o carrinho por **`(id, usuario_id)`** antes de tocar
qualquer item — carrinho que não é seu responde `404`, nunca o dado. Um item só é
alcançável através de um carrinho que pertence ao usuário (o `usuario_id` saiu de
`carrinho_itens` justamente para não haver um segundo caminho). As chaves
estrangeiras com `ON DELETE CASCADE` ligam `usuarios → carrinhos →
carrinho_itens`. Há teste explícito de isolamento no `carrinhosService` e no
`carrinhoService` (usuário A pedindo carrinho/itens de B recebe `404`, e o dado de
B segue intacto).

---

## 5. Como testei

**Manual, antes de tocar no código.** Subi backend e front, montei o carrinho do
chamado (2× ARR-7001, 3× ARR-7003, 1× ARR-7002 sem estoque) e conferi na tela:
linhas somando R$ 507,10, rodapé exibindo R$ 1.191,10, badge em 3 com 6 peças
dentro. Reproduzi antes de diagnosticar — o relato do suporte podia não bater
com a causa, e nesse caso batia.

**Automatizado, 89 testes em Vitest** — 46 no backend e 43 no front. A escolha e
o porquê estão na seção 6. Os 42 primeiros cobriam os quatro chamados; os
outros 47 vieram com os múltiplos carrinhos (seção 4) e com o ajuste de celular
(Problema 13).
A separação por camada é a parte que importa:

| Arquivo | O que afirma | Dependência externa |
|---|---|---|
| `backend/test/carrinhoService.test.js` | regra de negócio do carrinho | ERP mockado (`vi.mock`) |
| `backend/test/erpCliente.test.js` | tradução de HTTP em `ApiError` | `fetch` stubado |
| `frontend/test/Cabecalho.test.jsx` | o que aparece na tela | módulo `api` mockado |
| `frontend/test/apiCliente.test.js` | tradução de HTTP em `ErroApi` | `fetch` stubado |

O teste do service não passa pelo `erp/cliente.js`: se a tradução de erro
quebrar, quem fica vermelho é o arquivo dela, não o do carrinho. Falha que
aponta o culpado errado custa mais caro do que a que não existe.

**Teste verde não prova nada sozinho.** Escrevi os testes do KZN-312 e do
KZN-318 antes da correção e vi os quatro falharem pelo motivo previsto
(1191,10 ≠ 507,10 e 2 ≠ 5). Depois de migrar para Vitest e trocar o fake por
mock, repeti a prova com mutações no código de produção, porque mock mal feito
é o jeito mais fácil de produzir teste que passa sempre:

| Mutação | Resultado |
|---|---|
| Correção do total revertida | 4 falham |
| Tratamento de 401 do ERP desligado | 1 falha |
| Badge lendo `quantidade_itens` | 2 falham |
| `credentials: 'include'` → `'omit'` | 1 falha |

**Confirmação contra o ambiente real.** Chamei `lerCarrinho` apontando para o
banco de desenvolvimento e o ERP de verdade: R$ 507,10, badge 6, radiador ainda
visível com R$ 684,00 e `pronto_para_checkout: false`. Mock pode mentir sobre o
formato que o ERP devolve; essa passagem fecha a brecha.

**O que confirmei que não quebrou:** o checkout só abre com todas as linhas
disponíveis, então `valor_total` ali não muda de valor. `pedidoService` usa
`carrinho.itens`, que não foi alterado, e o valor do pedido vem do ERP
(`pedidoErp.valor_total`), não da loja. Nenhuma mudança no front.

Como rodar os testes automatizados:

```bash
cd backend  && npm test   # 46 testes
cd frontend && npm test   # 43 testes
```

`npm run test:watch` nos dois para o modo interativo.


---

## 6. Decisões e suposições

**Vitest, e não `node:test`.** Comecei com `node:test` para não trazer
dependência nova, e a primeira versão do teste ficou assim: quatro linhas de
`process.env` no corpo do arquivo e `await import()` no lugar dos imports do
topo. `config.js` lê o ambiente na importação, e eu não tinha como interceptar
isso. O contorno existia por limitação da ferramenta e vazava para dentro do
teste.

Vitest resolve com `env` no config, e os imports voltam ao topo. Pesou também
que **o front já é Vite** — não é ferramenta estrangeira ao repositório — e que
`node:test` não testa React, enquanto metade do que falta investigar (KZN-325,
a vitrine de múltiplos carrinhos) vive lá.

**Mock, não fake.** A primeira versão subia um servidor HTTP falso e passava
pelo `erp/cliente.js` inteiro. Testava mais do que deveria: falha na tradução
de erro deixava vermelho o teste do carrinho. Troquei por `vi.mock` do cliente
no teste do service, e o `fetch` stubado ficou no teste do cliente, que é quem
tem essa responsabilidade. Mesma decisão no front.

**Faker só no que o teste não afirma.** Descrição, marca, aplicação, nome e
e-mail vêm do faker com `seed` fixa. Preço, estoque e quantidade são sempre
explícitos: se o faker sorteasse o preço, a asserção do total viraria a fórmula
do código copiada para dentro do teste — passaria mesmo com a soma errada.

**O `ERP_URL` dos testes aponta para `127.0.0.1:1`**, endereço que não responde.
Não é enfeite: se algum teste escapar do mock e tentar sair para a rede, ele
falha na hora em vez de bater no ERP compartilhado com os outros candidatos.

O que o enunciado não respondia e eu assumi.

**As cinco decisões em aberto dos múltiplos carrinhos** estão na tabela da seção
4 (limite por pessoa, o que acontece ao apagar o ativo, como o carrinho aparece
na vitrine, qual vem selecionado ao entrar e o que acontece depois do checkout).
Não repito aqui; cada linha traz a decisão e o motivo.

**Semântica do `PATCH /perfil`** (Problema 5): assumi a convenção do JSON Merge
Patch (RFC 7396) como a correta — campo ausente não mexe, `null` explícito
limpa. O projeto não declarava isso, e a implementação atual não segue nenhuma
das duas.

**O ERP já dá baixa no estoque ao criar o pedido.** Não está documentado em
lugar nenhum; inferi do comentário em `pedidoService.js:63` e do comportamento
observado. É a suposição que mais pesa, porque sustenta a ordem das operações no
fechamento de pedido — se estiver errada, a análise do Problema de
confiabilidade (seção 7, item 6) muda de forma.

**Não rodei e2e contra o SIAC.** Assumi que o ambiente é compartilhado com
outros candidatos e que criar pedido de verdade ali seria efeito colateral
indesejado — por isso o Playwright ficou como proposta, não como entrega.

**O `ARQUITETURA.md` é documento vivo.** Assumi que mantê-lo correto faz parte
da entrega: a funcionalidade nova trocou as rotas de carrinho, e eu atualizei a
tabela de endpoints junto. O enunciado não pede isso explicitamente.


Do que discordei no que já estava no projeto, e o que faria diferente.

**Validação de requisição à mão, em vez de um schema declarativo.** O projeto
valida com `lib/validacao.js`: `ColetorDeErros` acumula `{campo, mensagem}` e
`ApiError.naoProcessavel` lança. Funciona e é consistente, mas cada rota repete
a mesma sequência de chamadas, e a forma do payload fica implícita no código
imperativo — não dá para ler o contrato de um endpoint num lugar só.

Eu usaria **zod**: o schema vira a documentação do contrato, erros de borda
(campo extra, tipo errado, coerção) somem por construção, e `safeParse` já
devolve todos os problemas de uma vez, que é exatamente o comportamento que o
`ColetorDeErros` implementa à mão.

**Não fiz**, por três motivos:

1. Trocar o idioma de validação de 7 arquivos de rota é refatoração ampla no
   meio de um trabalho de correção. O diff dos chamados ficaria ilegível, e o
   enunciado pede commits que contem a história do que foi feito.
2. Usar zod só na funcionalidade nova seria pior: deixaria dois idiomas de
   validação convivendo no mesmo backend.
3. É mudança de arquitetura, não correção de defeito. Cabe propor, não decidir
   sozinho no primeiro contato com o código.

Se fosse feito, a condição é que o adaptador converta `ZodError.issues` no mesmo
`{campo, mensagem}` e lance o mesmo `ApiError`: o formato de resposta de erro é
compartilhado com o ERP e com o front, e não pode mudar.

No `config.js` a situação era outra — ele é folha, nenhuma rota depende dele, e
já estava quebrado. Corrigi ali sem introduzir dependência nova, mantendo o
padrão de acumular problemas antes de lançar.


---

## 7. O que faria com mais tempo

O que ficou de fora, na ordem em que eu atacaria.

1. **Rotacionar o `ERP_TOKEN` e invalidar o `JWT_SEGREDO` antigo.** Tirar os
   segredos do código impede que novos vazem, mas não invalida o que já vazou.
   O segredo antigo tem 40 caracteres, então passa na checagem de tamanho: quem
   o copiar para o próprio `.env` volta ao ponto de partida. A rotação é do lado
   da Kaizen; deste lado, uma lista de recusa de segredos conhecidos cobriria o
   intervalo até ela acontecer.
2. **Ampliar a suíte** para login, posse de pedido e de endereço, e checkout com
   estoque insuficiente — os pontos onde uma regressão vira vazamento de dado
   entre usuários. A funcionalidade nova trouxe testes de serviço para os
   carrinhos (incluindo isolamento), para o fechamento de pedido, para o
   validador e para as migrações; ainda falta login e a posse de pedido/endereço
   fora do fluxo de carrinho.

   Falta também **teste de integração das rotas** (app real + banco em memória,
   ERP mockado), que é onde se verifica autenticação, formato de erro e
   isolamento por `usuario_id` — coisas que teste de unidade de service não
   alcança. E **e2e com Playwright**, com uma ressalva séria: e2e que chega ao
   "Fechar pedido" cria pedido de verdade no SIAC e dá baixa em estoque
   compartilhado com os outros candidatos. Ou aponta para um ERP falso local,
   ou para um passo antes do checkout.

   As três camadas juntas são a pirâmide que eu buscaria: base larga de unidade
   (regra de negócio em service, validador, migração), um meio de integração de
   rota (app real, banco em memória, ERP mockado) e um topo estreito de e2e, só
   para os caminhos que pagam o custo e a lentidão — cadastro, login, montar
   carrinho e chegar à revisão do pedido. Hoje existe a base e um pedaço do
   meio.
3. **Validação de requisição com schema declarativo (zod)** no backend inteiro,
   com adaptador para o `ApiError` atual. Detalhado na seção 6.
4. **Especificação OpenAPI (Swagger) da API.** O `ARQUITETURA.md` documenta os
   endpoints numa tabela. Na entrega original ela batia exatamente com o código,
   sem rota fantasma nem rota faltando; com os múltiplos carrinhos ela ficou
   defasada, e eu a atualizei (as cinco rotas `/carrinho` no singular saíram, as
   dez de `/carrinhos` entraram). Esse é justamente o argumento a favor do
   OpenAPI: tabela escrita à mão não acompanha mudança de API sozinha. O que
   falta é profundidade. A tabela tem
   método, caminho, se exige sessão e uma linha de descrição; não tem **forma
   do payload, catálogo de erros por endpoint nem exemplos de entrada e
   saída**. Para descobrir que um payload inválido devolve
   `422 ENTIDADE_NAO_PROCESSAVEL` com `detalhes: [{campo, mensagem}]`, tive que
   chamar a API — isso não está escrito em lugar nenhum.

   Um `openapi.yaml` servido em `/api/docs` resolveria, e rende além da
   leitura: importação em Postman, geração de cliente e teste de contrato.
   Ganha relevância com a funcionalidade nova, porque múltiplos carrinhos muda
   o contrato — a própria seção 4 deste relatório pede uma tabela de endpoints
   novos ou alterados, que é exatamente o que uma spec registraria.

   A ressalva: spec escrita à mão envelhece e vira mentira, o que é pior que a
   tabela em prosa que existe hoje. Só vale se nascer junto de um teste que
   falhe quando o código e a spec divergirem.
5. **Cache de leitura do ERP, com Redis e versionamento.** Hoje cada leitura de
   carrinho faz uma chamada por item (`carrinhoService.js:24-32`) e `GET /pedidos`
   faz N chamadas por página (`pedidoService.js:122`) — o próprio
   `ARQUITETURA.md` registra os dois como limitação aceita. O `erp/cliente.js` é
   o ponto único de acesso ao ERP, então o cache mora lá e não espalha mudança.

   O desenho que eu seguiria: **Redis** com **chave versionada**. As entradas
   carregam uma versão no nome (`erp:v{N}:produto:{codigo}`, `erp:v{N}:catalogo:{hash-dos-filtros}`),
   e invalidar é **incrementar `N`** — um `INCR` O(1) que torna tudo da versão
   antiga um *miss* de uma vez, sem precisar rastrear e apagar chave por chave.
   O gatilho do bump é a **escrita que muda estoque**: ao fechar um pedido
   (`finalizarPedido` → `erp.criarPedido`), que dá baixa no ERP, sobe-se a versão.
   Isso torna consulta de catálogo e busca individual **baratas** no caso comum,
   que é leitura, e coerentes logo após a nossa própria baixa de estoque.

   **A ressalva é o estoque, e ela se resolve por três mecanismos juntos.** O
   bump na nossa escrita não captura mudanças que acontecem **fora** daqui: o ERP
   se atualiza sozinho (o README fala em 30 min) e outros candidatos também fecham
   pedidos no mesmo SIAC — e não há como sincronizar o nosso TTL com o ciclo dele,
   que não controlamos nem conhecemos. Então:

   - **TTL curto no que é volátil.** O estoque entra com TTL baixo; preço,
     descrição e categoria mudam pouco e aguentam TTL longo. O TTL **limita a
     defasagem**, mas não promete exatidão — é importante não confundir as duas
     coisas.
   - **A corretude vem do ERP, não do cache.** A decisão final de estoque é no
     `erp.criarPedido`: se o estoque acabou, o ERP recusa e o `erp/cliente.js` já
     traduz o `409`/`422` para um erro que chega à tela. No pior caso o cache
     mostra "disponível" desatualizado, a pessoa tenta fechar e recebe um erro
     claro — **nunca um pedido oversold**. O cache é otimização de leitura, jamais
     a autoridade da decisão; por isso a checagem de fechamento lê fresco (ou
     simplesmente confia na recusa do ERP).
   - **Versão como flush imediato.** Se um dado entrar errado no cache (bug ou
     valor enviado errado), um `INCR` da versão esvazia tudo na hora, e o TTL
     curto já se auto-corrige sozinho no pior caso.

   Se o Redis já estiver em jogo para a fila de jobs (ponto 6), o cache aproveita
   a mesma infra.

   **E no carrinho?** Vale separar duas coisas que a pergunta mistura. O
   **conteúdo** do carrinho (quais códigos, quais quantidades) é nosso — vive em
   `carrinho_itens` — e é sempre lido fresco do nosso banco; o comprador vê na
   hora o que acabou de pôr, sem passar por cache do ERP. O que poderia vir do
   cache é o **enriquecimento** (preço/estoque por item, via `enriquecerItens`).
   Seguindo o que e-commerces maduros fazem — página de carrinho é superfície de
   exibição e aviso, não de bloqueio; estoque só é autoritativo no fechamento —,
   o enriquecimento **pode** usar o cache com a mesma política do catálogo (preço
   e descrição com TTL longo, estoque com TTL curto), e o `finalizarPedido`
   continua decidindo contra o ERP fresco. Assim o carrinho fica barato e o
   checkout, correto.
6. **Confiabilidade do fechamento de pedido.** O `finalizarPedido` chama o ERP e
   depois grava local; entre o `await` da criação no ERP e a gravação há duas
   janelas. Em ordem de custo/benefício: **(a) idempotência** contra duplo-submit
   — um claim pessimista no carrinho antes da chamada ao ERP, ou uma chave de
   idempotência; sem infra. **(b) outbox in-process** — gravar o pedido como
   `PENDENTE` antes de chamar o ERP e confirmar no sucesso, com retry; resolve o
   "ERP criou mas a gravação local caiu" que o próprio código já admite, sobre o
   SQLite atual. A ressalva: o retry só é seguro se o ERP for idempotente na
   criação, senão troca-se "perdi o registro" por "posso duplicar" — fechar isso
   exige cooperação do ERP. **(c) fila/broker** (BullMQ→Redis, pg-boss→Postgres,
   ou Kafka) só se crescer para muitos eventos e consumidores; cada degrau traz
   infra e torna o checkout assíncrono. **Saga não se aplica**: o passo do ERP
   não tem compensação (sem endpoint de cancelamento). A concorrência de estoque
   é do ERP arbitrar. Nada disso entrou na funcionalidade, de propósito.
7. **Tipos fortes no banco (Postgres) ou um ORM.** O SQLite é tipado de forma
   fraca: `VARCHAR(n)` é ignorado (o tamanho se controla no validador e em
   `CHECK`), não há booleano nem enum nativos. Num Postgres isso seria tipo real
   (`boolean`, `varchar(n)` que valida, enums, domínios) e concorrência melhor —
   relevante para o ponto 6. Sobre **ORM**: mantive o `better-sqlite3` com
   prepared statements, que já é seguro contra injeção (Problema 11). Um ORM
   traria migrations (que resolvi à parte, com um runner próprio), tipagem
   (marginal sem TypeScript) e queries componíveis (a camada é pequena); o custo
   é dependência, abstração sobre algo transparente e quebra de consistência no
   meio do teste. Se um dia quiserem tipos sem peso de runtime, Drizzle é a opção
   leve. Um ORM também centralizaria a **serialização** (modelo → DTO): hoje isso
   é feito à mão (`serializarUsuario`, `serializarEndereco`, o snapshot de
   endereço do pedido), e funciona, mas um ORM daria um ponto único para isso em
   vez de uma função por entidade. Preferi não trocar a arquitetura de acesso a
   dados agora.
8. **Estado de servidor no frontend com TanStack Query — eu teria feito assim
   desde o início.** O `CarrinhoContext` faz na mão o que uma biblioteca de
   *server-state* já resolve: `recarregar`, reaplicar o ativo e reinvalidar a
   lista após mutar um item. Com **TanStack Query** isso vira
   `useQuery`/`useMutation` com `invalidateQueries`, e vêm de graça a
   deduplicação de chamadas, `stale-while-revalidate`, refetch ao focar a aba e
   atualização otimista — enxugando o `useState`/`useEffect` manual do contexto e
   do catálogo. Começando o projeto hoje, adotaria de saída; no meio do teste é
   refactor grande e preferi a consistência com o que já existe. Vale não
   confundir as camadas: o cache do Query é do **navegador, por sessão** (reduz
   chamadas de um usuário), complementar ao cache Redis do **servidor,
   compartilhado** (ponto 5) — e a decisão final de estoque continua no ERP, no
   fechamento.
9. **TypeScript + zod na base do projeto — mudaria isto se começasse de novo.**
   Hoje a tipagem só existe na cabeça de quem lê, e a validação é imperativa
   (`ColetorDeErros` + validadores à mão). Com **TypeScript** os contratos —
   payloads de entrada, formato das respostas, linhas do banco — seriam
   verificados **em build**, não só em runtime, pegando erro antes de rodar. Com
   **zod** (o schema declarativo do ponto 3), um schema por endpoint valida a
   entrada e **infere o tipo ao mesmo tempo**: uma fonte só para validação e tipo,
   em vez de manter as duas em sincronia na mão. Juntos deixam validação e
   tipagem mais restritas e seguras, da borda ao banco. É mudança de fundação, não
   ajuste pontual — por isso entra como "faria diferente".


10. **Framework: NestJS sobre Fastify — a base que eu escolheria para escalar.**
    O Express entrega o básico e o projeto está bem organizado à mão (separação
    rota/serviço, middleware de erro, formato único de resposta). Mas se o alvo
    for crescer — e eventualmente quebrar em microserviços —, o **NestJS** já traz
    pronto o que aqui é convenção manual: módulos, injeção de dependência,
    *pipes* de validação (encaixam direto com o zod do ponto 3), *guards* de
    autenticação, *interceptors* de serialização e um caminho claro para
    transporte entre serviços. É TypeScript de nascença, então casa com o ponto 9 (logo acima).
    Por baixo, rodaria com o adaptador **Fastify** no lugar do Express: mais
    rápido e com validação/serialização por schema embutidas. É uma decisão de
    fundação — entraria num recomeço ou numa migração planejada, não como troca no
    meio do teste.

11. **Observabilidade: log estruturado, rastreamento de erro e painel.** O que
    existe hoje não é ausência total, mas não sustenta produção. Há id por
    requisição (`middleware/requisicao.js`, devolvido em `X-Request-Id` e no
    corpo do erro) e uma linha de acesso por resposta — só que em **texto
    corrido**, montada com `join(' ')`, e os outros 11 pontos de log do backend
    são `console.log`/`console.error` soltos. Isso significa: sem níveis
    (`debug`/`info`/`warn`/`error`), sem campos consultáveis, sem redação de
    dado sensível, sem retenção e sem alerta. Achar "todos os 500 do checkout na
    última hora" exige `grep` no journald da máquina, e um erro que não derrube
    a requisição não chega a ninguém.

    Trocaria por **pino**: JSON por linha, nível configurável, `redact` para
    `cookie`/`authorization`/`senha` e o `req.id` que já existe promovido a
    campo de correlação — o pino-http reaproveita exatamente esse id. Por cima
    dele, **Sentry** para exceção (stack, versão, usuário afetado, agrupamento e
    alerta) e **Grafana** para o resto: Loki recebendo o JSON do pino e
    Prometheus com as métricas que importam neste sistema — latência e taxa de
    erro **por chamada ao ERP**, que é a dependência que pode derrubar a loja
    inteira, e duração do `finalizarPedido`, que é onde um pedido fica pago e
    sem registro. Com OpenTelemetry no meio, o mesmo id amarra log, métrica e
    trace.

12. **Identificadores: ULID no lugar de `INTEGER PRIMARY KEY AUTOINCREMENT`.**
    Todas as cinco tabelas usam id sequencial. O risco não é adivinhar o id —
    as rotas filtram por `usuario_id` e um id alheio responde 404, o que está
    testado — mas sequencial **vaza informação** e **não tolera distribuição**:
    quem cria uma conta hoje e outra amanhã mede quantos clientes a loja ganhou
    no intervalo, e o mesmo vale para pedidos. Além disso, id sequencial só pode
    ser gerado pelo banco, o que atrapalha escrita em mais de um nó e qualquer
    criação otimista no cliente.

    ULID resolve os dois: 128 bits não adivinháveis, gerados fora do banco, e
    **ordenáveis por tempo** — diferente do UUIDv4, que ao virar chave primária
    espalha a escrita pelo índice (o UUIDv7 tem a mesma propriedade). Como são
    texto de 26 caracteres, a troca encarece índice e junção; num Postgres eu
    guardaria em `BYTEA`/`UUID` e exibiria em ULID na borda. Trocaria primeiro
    em `enderecos` e `carrinhos`, que são os ids que de fato aparecem em URL
    (`/enderecos/:id`, `/carrinhos/:id`), e em `pedidos_usuario` — este não pelo
    endereçamento, que usa o `numero_erp`, mas porque o sequencial expõe o
    volume de pedidos da loja.

13. **Revisão dos índices — um índice redundante saiu, e o resto se sustenta.**
    Este item estava nesta seção como "faria com mais tempo", mas a correção era
    apagar uma linha, então apaguei. Fui conferir o schema contra as consultas
    que existem de fato:

    - **`idx_usuarios_email` era redundante.** A coluna já é `TEXT NOT NULL
      UNIQUE`, e o SQLite cria um índice implícito para toda restrição `UNIQUE`.
      O índice declarado duplicava esse: custava escrita em todo cadastro e
      atualização de perfil, e não servia nenhuma leitura que o implícito já não
      servisse. Vinha da entrega original. **Removido.**
    - **`carrinho_itens` não ganhou índice declarado para `carrinho_id`**, pelo
      mesmo raciocínio: o `UNIQUE (carrinho_id, codigo_produto)` da tabela já
      cria um índice implícito que começa por essa coluna, e é ele que atende
      `WHERE carrinho_id = ?` — a forma de todas as leituras de item. Um índice
      só de `carrinho_id` seria prefixo de um que já existe.
    - **`enderecos`**: `WHERE usuario_id = ? ORDER BY principal DESC, id ASC`
      usa o índice no filtro e ordena depois. Um composto `(usuario_id,
      principal DESC, id)` eliminaria a ordenação. Com poucos endereços por
      cliente, a diferença é teórica — registro por completude, não como
      pendência.
    - **`carrinhos`**: ao apagar o ativo, o sucessor sai de `ORDER BY
      atualizado_em DESC, id DESC LIMIT 1`. O índice por `usuario_id` resolve o
      filtro e a ordenação cai sobre no máximo 10 linhas, que é o teto de
      carrinhos. Não vale índice novo.
    - **`pedidos_usuario`**: a listagem (`WHERE usuario_id = ? ORDER BY id
      DESC`) **já está coberta** — `id` é `INTEGER PRIMARY KEY`, ou seja, o
      `rowid`, e o SQLite percorre `idx_pedidos_usuario` ao contrário. Não falta
      índice aqui.
    - **O que mais pesaria em escala não é índice faltando, é `UPPER()` no
      filtro**: `UPPER(numero_erp) = ?` e `UPPER(codigo_produto) = ?` descartam
      o índice e forçam varredura. Hoje a varredura é de um punhado de linhas do
      próprio usuário, então não dói; com volume, a saída é índice de expressão
      — ou normalizar na escrita, que é mais barato ainda.

    Não confiei no raciocínio: comparei `EXPLAIN QUERY PLAN` em dois bancos
    criados do zero, um com os índices declarados e outro sem. Nenhum plano
    degrada para varredura — muda só **qual** índice é usado, com o mesmo tipo
    de acesso (`SEARCH` nas buscas, `COVERING INDEX` na contagem de itens do
    carrinho). A ordenação por `adicionado_em` continua com `TEMP B-TREE`, como
    já era. O ganho está em escrita e em clareza do schema, não em leitura.

    A linha saiu do próprio arquivo de migração, não de uma `002` que a
    desfizesse: o projeto ainda não rodou em lugar nenhum, e o banco de
    desenvolvimento é gerado por `npm run db:init`. Quem já tiver um `.db`
    antigo continua com o índice até recriá-lo.

14. **Autenticação: sessão curta com refresh e invalidação.** Hoje é um JWT
    único em cookie `httpOnly` + `sameSite=lax`, com `secure` em produção — as
    partes certas estão no lugar —, mas **não há como invalidar nada**. O token
    vale até expirar: "sair" só apaga o cookie do navegador, e um token copiado
    antes disso continua aceito. Trocar a senha não derruba sessão aberta, e não
    há como derrubar a sessão de um aparelho perdido.

    Faria o par **access token curto (5–15 min) + refresh token longo, opaco e
    guardado no banco**, um registro por sessão com `usuario_id`, data de
    emissão, último uso e aparelho. Aí "sair" apaga o registro, trocar a senha
    apaga todos, e existe uma tela de "sessões ativas". Com rotação de refresh e
    detecção de reuso — um refresh já usado reaparecer significa roubo, e a
    família inteira de tokens cai. A lista de revogação do access token, por ser
    curto, cabe em memória ou no mesmo Redis do item 5.

15. **Docker Compose para as dependências.** Hoje o projeto sobe com Node e um
    arquivo SQLite, o que é a razão de ele ser tão fácil de rodar — e por isso
    não troco isso agora. Mas os itens 5, 7 e 14 trazem Redis e Postgres, e
    nesse momento "instale Postgres na sua máquina" vira o passo que quebra para
    metade das pessoas. Um `docker-compose.yml` com Postgres, Redis e o backend,
    volumes nomeados para os dados e `healthcheck` em cada serviço resolve isso
    e dá de graça a paridade entre a máquina de quem desenvolve e a de produção.
    O front continua no Vite fora do compose durante o desenvolvimento, pelo
    recarregamento.

---

## 8. Outras observações

**Marcadores de revisão encontrados no código.** Três até agora, todos citados
aqui como o bloco pede:

| Marcador | Arquivo | O que havia ali |
|---|---|---|
| `KZN-2B9C` | `backend/src/config.js` | `PADRAO` com os segredos embutidos — Problema 1 |
| `KZN-7F3A` | `backend/src/services/carrinhoService.js` | `lerCarrinho`, onde moravam os dois defeitos do KZN-312 e do KZN-318 |
| `KZN-5D1E` | `frontend/src/componentes/Cabecalho.jsx` | o badge do carrinho — aqui o código estava **certo**, lendo `quantidade_pecas`; o número errado vinha do servidor |

Mantive os comentários nos arquivos, reescritos para registrar o que foi
reavaliado. O `KZN-5D1E` vale como resultado negativo: marcador de revisão
aponta trecho que merece um olhar, não trecho que está necessariamente errado —
e nesse a investigação terminou do outro lado da fronteira.

**Organização do histórico.** O primeiro commit de `main` tem o projeto
exatamente como recebido (60 arquivos), para servir de marco zero. As alterações
vêm em branches a partir dele. A primeira é
`chore/seguranca-e-configuracao`, feita antes de qualquer chamado porque muda o
que pode ser publicado no repositório.

**Segredos redigidos no commit base.** O enunciado pede o link do repositório,
e um repositório privado só é avaliável se o avaliador for adicionado como
colaborador — risco de a entrega chegar como 404. Optei por repositório público.

Isso cria um conflito com o commit base: ele é o projeto como recebido, e o
projeto como recebido contém o `ERP_TOKEN` e o `JWT_SEGREDO` hardcoded.
Histórico de Git não se apaga — removê-los só no commit seguinte os deixaria
expostos no primeiro para sempre.

Então o commit base tem **uma única alteração**: os três literais trocados por
`<redigido-ver-RELATORIO.md>`. Está declarado na mensagem do commit. Os 60
arquivos e a estrutura são os originais, e o diff do commit de correção continua
mostrando o defeito inteiro — a lógica do `PADRAO`, a validação inalcançável e
a correção.

O token continua válido e nas mãos de todos os candidatos — quem precisa
rotacionar é a Kaizen. Registro aqui porque a correção deste lado não resolve
isso: enquanto o segredo antigo for aceito como um segredo qualquer, basta
alguém colá-lo no próprio `.env` para voltar ao ponto de partida. Ver seção 7.

**Inconsistência na documentação.** O README chama a variável de `SIAC_URL`; o
código e o `.env.example` usam `ERP_URL`. Não alterei o README por ser o
enunciado do teste — registrei a diferença no próprio `.env.example`, junto com
a indicação de que URL e token são credenciais e devem ser pedidas ao time do
SIAC. Isso fechou a lacuna que a correção do Problema 1 abriu: ao tirar os
valores do código, o `.env.example` virou o único lugar que fala deles.

**ESLint, como ferramenta de investigação.** Adicionei ESLint aos dois pacotes
(`npm run lint`), sem Prettier e sem nenhuma regra de formatação: reformatar os
47 arquivos de código produziria um diff que soterraria as correções, e o enunciado
avalia consistência com o projeto. As regras ativas são as que acusam defeito:
variável não usada, `require-atomic-updates` (leitura seguida de escrita em
código assíncrono), `eqeqeq`, e no front as regras de hooks do React. Cada
desligamento está comentado no `eslint.config.js` do pacote, com o motivo.

O resultado honesto: **não encontrou nenhum bug.** Foram 11 ocorrências, todas
descartadas depois de verificadas uma a uma:

- 4× `consistent-return` no backend — middleware de Express retornando
  `res.json()` num ramo e `next()` noutro. Padrão correto do framework.
- 6× `react-hooks/set-state-in-effect` no front — o padrão "busca dados ao
  montar e guarda no estado", usado em todas as páginas de dados. Regra de
  idioma, não de defeito.
- 1× `no-useless-assignment` em `erp/cliente.js:58`: `let json = null` cujo
  `null` nunca chegava a ser lido. Corrigi para `let json`, sem mudança de
  comportamento.

As duas regras que mais pegam bug em React — `rules-of-hooks` e
`exhaustive-deps` — estão ligadas e não acusaram nada. Vale registrar como
resultado negativo: os bugs não reportados deste projeto não são do tipo que
análise estática encontra.

**Estoque defasado em até 30 minutos — não é defeito, é consideração de
produto.** O README informa que o ERP atualiza o estoque de 30 em 30 minutos.

O tratamento no checkout está correto e não precisa mudar: quem decide é o ERP.
`erp/cliente.js:78-86` repassa o `409` com o status e o código originais, e
`finalizarPedido` não o intercepta. Na disputa pela última peça entre dois
pedidos simultâneos, ambos passam na pré-validação, ambos chamam
`criarPedido`, o ERP serializa e o segundo recebe `409` — que chega ao cliente
como informação útil. O carrinho não é limpo nesse caminho, então a pessoa não
perde o que montou.

O que fica em aberto é a **pré-validação**, que é pessimista. Três pontos
recusam com base em dado possivelmente velho — `adicionarItem`
(`carrinhoService.js:150`), `alterarQuantidade` (`:198`) e
`pronto_para_checkout` (`:95`). Se o estoque está defasado para menos, a loja
recusa uma venda que o ERP aceitaria, e o cliente não tem como insistir: vê
"sem estoque" numa peça que existe e desiste.

Inferência minha, não documentada: pelo comentário em `pedidoService.js:63`
("daqui para baixo o estoque JÁ foi baixado no ERP"), a venda online decrementa
na hora. Então os 30 minutos valem para movimentação externa — venda no balcão
da loja física, ajuste de inventário —, não para pedidos da loja.

Não mexi nisso. Afrouxar a pré-validação é decisão de produto (vender e correr
o risco do `409`, ou bloquear antes), não correção de defeito.


