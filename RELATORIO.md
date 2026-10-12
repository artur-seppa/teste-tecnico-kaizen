# Relatório de entrega

> Preencha este arquivo e entregue junto com o código. Ele é lido antes do
> código e serve de base para a conversa de devolutiva.
>
> **Escreva direto.** Frase curta vale mais que parágrafo bonito. Se alguma
> seção não se aplica, escreva "não se aplica" e siga — deixar em branco deixa
> a dúvida se você pulou ou se esqueceu.
>
> Apague estas instruções em itálico conforme for preenchendo.

**Candidato:** Artur Reiman
**Data de entrega:**
**Tempo aproximado dedicado:**

---

## 1. Subindo o projeto

*Como você colocou a aplicação no ar? O que foi mais difícil ou confuso?*

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

*Precisou criar algum arquivo que não estava no repositório? Qual?*

- **`backend/.env`** — a partir do `.env.example`, com `JWT_SEGREDO` gerado por
  `npm run segredo:gerar`.
- **`.gitignore`** na raiz — o repositório não tinha nenhum. Ver Problema 2.



---

## 2. Chamados reportados

Um bloco por chamado. **Causa** é o que estava errado no código, não o sintoma
que o cliente descreveu.

### KZN-312 — Total do carrinho vem maior que a soma das peças

| | |
|---|---|
| **Causa** | `carrinhoService.js:85` somava `valor_total` de **todos** os itens, inclusive os marcados `disponivel: false`. A intenção de não somar indisponível já existia no arquivo — o caminho "produto sumiu do catálogo" (`:41`) devolve `valor_total: 0` —, mas não valia para o item sem estoque (`:64`), que mantém o valor cheio. Não é decisão de produto: são dois caminhos de indisponibilidade com tratamento divergente dentro da mesma função. |
| **Como reproduzi** | `ARR-7002` (Radiador de Agua sem Ar, R$ 684,00, estoque 0) é o item do chamado — o valor bate exatamente com o relato do atendimento. Pela interface ele é inalcançável: `adicionarItem` barra com `409 ESTOQUE_INSUFICIENTE`. O cenário só nasce de um jeito: a peça entra quando há estoque e a baixa vem depois. Simulei inserindo a linha direto em `carrinho_itens`, que é o estado em que o banco ficaria. Com 2× ARR-7001 e 3× ARR-7003 ao lado, as linhas somavam R$ 507,10 e o rodapé exibia R$ 1.191,10. |
| **Arquivos alterados** | `backend/src/services/carrinhoService.js` |
| **Como validei a correção** | Teste de unidade do service com o ERP mockado (`test/carrinhoService.test.js`), mais verificação contra o banco e o ERP reais. Confirmei que o teste **falha** quando reverto a correção — 4 dos 19 ficam vermelhos. |

*Alguma observação? (algo que te surpreendeu, decisão que precisou tomar)*

O que me fez tratar isso como defeito, e não como decisão de produto, foi o botão: `pronto_para_checkout` já era `false` e "Fechar pedido" já vinha desabilitado. Ou seja, **R$ 1.191,10 não era o preço de nenhum pedido que existisse** — o pedido possível custava R$ 507,10. O número em destaque descrevia uma compra impossível.

Duas decisões que o enunciado não responde:

- **Linha com estoque parcial sai inteira do total** (pediu 5, tem 2 → zero no total). É o mesmo critério que `pronto_para_checkout` já usa para bloquear a linha. A alternativa — somar as 2 que existem — descreveria um carrinho que a pessoa ainda não tem, e ela precisaria editar a quantidade antes de fechar.
- **A linha indisponível continua visível, com o preço dela.** Saber quanto custa o radiador é informação útil para quem decide se espera a reposição. O que muda é só a participação no total.

Sobre os 30 minutos do README: vale ser preciso, porque é fácil contar errado. **A loja não guarda estoque nem faz cache** — `enriquecerItens` chama o ERP uma vez por item a cada leitura do carrinho. Quem pode estar defasado é o dado **dentro do ERP**, que sincroniza com o estoque físico a cada 30 min. A loja sempre mostra o número mais recente que o ERP tem; esse número é que pode estar atrás da prateleira.



### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | `carrinhoService.js:88` devolvia `quantidade_pecas: itens.length` — o mesmo valor de `quantidade_itens`, que está logo acima. O campo prometia peças e entregava linhas. O front está correto e não foi tocado: `Cabecalho.jsx:94-100` já lia `quantidade_pecas`, o campo certo; ele só recebia o número errado do servidor. |
| **Como reproduzi** | Carrinho com 2 produtos distintos e 5 + 2 = 7 unidades: o badge mostrava 2. É o relato literal do chamado ("mostra 2, mas eu tenho 7 peças"). |
| **Arquivos alterados** | `backend/src/services/carrinhoService.js` |
| **Como validei a correção** | Teste do service (backend) e teste de componente do `Cabecalho` renderizando com `ProvedorAuth` + `ProvedorCarrinho` reais (frontend). Verifiquei que o teste de front falha se o badge voltar a ler `quantidade_itens`. |

**O chamado subestima o alcance.** O relato fala do ícone, mas `quantidade_pecas` alimenta também o "Itens" do resumo do carrinho (`Carrinho.jsx:147`). São dois lugares na tela, não um — e a correção no servidor acerta os dois de uma vez, sem mudar uma linha do front.

**Decisão:** o contador inclui as peças da linha indisponível. Ele responde "quantas peças tem aí dentro", não "quantas dá para levar" — se o radiador sumisse da contagem, a pessoa acharia que perdeu o item do carrinho.



### KZN-325 — Busca diz que não encontrou peça que existe

| | |
|---|---|
| **Causa** | |
| **Como reproduzi** | |
| **Arquivos alterados** | |
| **Como validei a correção** | |



### KZN-331 — Pedido saiu com o endereço errado

| | |
|---|---|
| **Causa** | |
| **Como reproduzi** | |
| **Arquivos alterados** | |
| **Como validei a correção** | |



---

## 3. Problemas que encontrei por conta própria

*Os chamados não cobrem tudo. Liste aqui o que você encontrou sozinho —
inclusive o que decidiu **não** corrigir. Repita o bloco quantas vezes precisar.*

*Achar e documentar um problema conta a favor mesmo sem a correção. Deixar de
relatar algo que você viu conta contra.*/

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
| **Como cheguei nele** | Testando o formato de erro de payload da rota (seção 5). Enviei `{"telefone":"11988887777"}` esperando sucesso e recebi `422` cobrando `nome` e `documento`; fui ao serviço entender e encontrei o merge já pronto. Para (b), gravei um telefone e tentei apagá-lo com `null`, com `""` e omitindo o campo: os três devolveram `200` e o número permaneceu. |
| **Impacto** | Baixo hoje: o front envia o formulário inteiro, então o caminho de uso real funciona. O contrato é que está errado — `PATCH` promete atualização parcial e entrega semântica de substituição. Morde quando aparecer um segundo consumidor (app, script, integração) que mande só o campo alterado. O telefone não-apagável afeta quem cadastrou o número errado e quer removê-lo em vez de trocar. |
| **Corrigi?** | **Não.** O enunciado pede para anotar como dúvida o que pode ser decisão de produto, e (a) depende de uma escolha que não é minha: como expressar "limpar o campo". O `textoOpcional` colapsa `undefined`, `null` e `""` no mesmo `null`, então tornar os campos opcionais sem antes decidir isso trocaria um defeito por outro — "ausente" passaria a significar "apague". A correção certa é: campos opcionais, `undefined` = não mexe, `null` explícito = limpa (convenção do JSON Merge Patch, RFC 7396), e `??` em vez de `\|\|` no telefone. Mudar `PATCH` para `PUT` **não** resolveria: o perfil inclui `email`, `id` e `criado_em`, e o e-mail é deliberadamente não editável, então um corpo de PUT nunca seria a representação completa que o verbo exige. |
| **Arquivos alterados** | nenhum |

Verifiquei as outras rotas e **este é o único caso divergente**:
`PATCH /carrinho/itens/:codigo` pede só `quantidade`, que é o único campo mutável
do item; `PUT /enderecos/:id` exige a representação completa, que é o correto
para PUT; `PATCH /perfil/senha` é ação, não edição parcial de recurso; e os
`POST` exigem tudo por serem criação.

### Problema 6 — A borda do carrinho aceita em silêncio o que deveria recusar

| | |
|---|---|
| **O que está errado** | `adicionarItem` (`carrinhoService.js:124`) faz `Math.min(MAXIMO_POR_ITEM, existente + quantidade)` **antes** da checagem de estoque da linha 126. O estoque até é conferido — mas contra o valor já cortado, não contra o que a pessoa pediu. Com 90 no carrinho e mais 50 pedidos: `min(99, 140) = 99`, a checagem pergunta "tem 99?", tem, passa, e a linha 137 grava 99. Resposta `201`, **41 unidades somem sem uma palavra**. Sem o `Math.min` ali, a pergunta seria "tem 140?" e a resposta seria `409 ESTOQUE_INSUFICIENTE`. A rota não cobre: ela valida a parcela (`quantidade` ≤ 99), não a soma. |
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

- `adicionarItem:113` → `if (!produto) throw ApiError.naoEncontrado(...)` — recusa.
- `alterarQuantidade:171` → `if (produto && produto.estoque < quantidade)` — o
  `&&` curto-circuita, o `if` não entra, e a linha 180 grava a quantidade **sem
  ter conferido estoque nenhum**.

Confirmei com teste descartável: mockando `buscarProduto` para devolver `null`,
a quantidade foi para 99 e a chamada respondeu sucesso.

**O estrago é contido** — e vale dizer, para não inflar: a leitura seguinte do
carrinho marca a linha como indisponível e `pronto_para_checkout` fica `false`,
então nenhum pedido ruim passa. O que se perde é o momento e o rótulo do erro:
a pessoa recebe `200`, e só na tela seguinte vê o item bloqueado com uma
mensagem que fala de catálogo quando o que houve foi o ERP respondendo torto.

Incomoda mais a assimetria do que o sintoma. Diante da mesma incerteza, um
caminho recusa e o outro deixa passar — não dá para ler o código e saber qual é
a regra da casa. É o mesmo tipo de divergência interna que produziu o KZN-312.
Correção: `if (!produto) throw ApiError.naoEncontrado(...)` antes da checagem,
igual ao `adicionarItem`.

### Problema 7 — `verificarErp` ignora o `ERP_TIMEOUT_MS`

| | |
|---|---|
| **O que está errado** | `erp/cliente.js:144` usa `AbortSignal.timeout(3000)` fixo. Todo o resto do cliente respeita `config.erp.timeoutMs`; só a sonda de inicialização não. A variável existe, está documentada no `.env.example` e não vale para o único ponto que fala com o ERP antes de qualquer cliente aparecer. |
| **Como cheguei nele** | O backend subiu imprimindo `ERP: ... -> INDISPONIVEL (timeout)` com o ERP de pé. Medi: `curl` respondeu em 0,97 s e o `fetch` do Node em 34–412 ms em quatro tentativas. O ERP estava normal; foi o primeiro acesso, com DNS e TLS frios, esbarrando num limite mais apertado que o configurado. |
| **Impacto** | Nenhum para quem compra — a sonda não derruba o processo e a aplicação funciona. O dano é de diagnóstico: quem sobe o projeto lê "INDISPONIVEL" e vai caçar problema de rede que não existe, ou pior, assume que o ambiente está quebrado e para. Barulho na direção errada. |
| **Corrigi?** | **Não**, pelo mesmo motivo do Problema 6: não é dos chamados desta branch. A correção é trocar o literal por `config.erp.timeoutMs`. Vale discutir se a sonda deveria ter limite próprio e **menor** que o das requisições — não travar a subida por 8 s é defensável —, mas então ele precisa ser uma variável declarada, não um número solto no meio do arquivo. |
| **Arquivos alterados** | nenhum |

---

## 4. Múltiplos carrinhos

### Como ficou

*Descreva a solução em algumas linhas: o que a pessoa consegue fazer agora.*



### Modelagem

*Como ficou no banco. Tabelas, colunas e relações que você criou ou alterou.*



*Mudanças no contrato da API — endpoints novos ou alterados:*

| Método | Rota | O que faz |
|---|---|---|
| | | |

### Decisões que o enunciado deixou abertas

*Responda o que você decidiu e **por quê**. Não existe resposta certa; existe
decisão pensada.*

| Pergunta | Sua decisão | Motivo |
|---|---|---|
| Quantos carrinhos por pessoa? Tem limite? | | |
| O que acontece ao apagar o carrinho ativo? | | |
| Como o carrinho aparece na vitrine? | | |
| E no celular? | | |
| Qual carrinho vem selecionado ao entrar? | | |
| O que acontece com os carrinhos após fechar um pedido? | | |

### Isolamento

*O que impede o carrinho de um cliente aparecer para outro?*



---

## 5. Como testei

**Manual, antes de tocar no código.** Subi backend e front, montei o carrinho do
chamado (2× ARR-7001, 3× ARR-7003, 1× ARR-7002 sem estoque) e conferi na tela:
linhas somando R$ 507,10, rodapé exibindo R$ 1.191,10, badge em 3 com 6 peças
dentro. Reproduzi antes de diagnosticar — o relato do suporte podia não bater
com a causa, e nesse caso batia.

**Automatizado, 30 testes em Vitest.** A escolha e o porquê estão na seção 6.
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

*Se escreveu testes automatizados, diga como rodar:*

```bash
cd backend  && npm test   # 19 testes
cd frontend && npm test   # 11 testes
```

`npm run test:watch` nos dois para o modo interativo.



---

## 6. Decisões e suposições

**Vitest, e não `node:test`.** Comecei com `node:test` para não trazer
dependência nova, e a primeira versão do teste ficou assim: quatro linhas de
`process.env` no corpo do arquivo e `await import()` no lugar dos imports do
topo. `config.js` lê o ambiente na importação, e eu não tinha como interceptar
isso. A gambiarra existia por limitação da ferramenta e vazava para dentro do
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

*Algo que o enunciado não respondia e você assumiu? Registre aqui.*



*Discordou de alguma coisa que já estava no projeto? O que faria diferente?*

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

*O que ficou de fora, em ordem do que você atacaria primeiro.*

1. **Rotacionar o `ERP_TOKEN` e invalidar o `JWT_SEGREDO` antigo.** Tirar os
   segredos do código impede que novos vazem, mas não invalida o que já vazou.
   O segredo antigo tem 40 caracteres, então passa na checagem de tamanho: quem
   o copiar para o próprio `.env` volta ao ponto de partida. A rotação é do lado
   da Kaizen; deste lado, uma lista de recusa de segredos conhecidos cobriria o
   intervalo até ela acontecer.
2. **Ampliar a suíte** para login, posse de pedido e de endereço, e checkout com
   estoque insuficiente — os pontos onde uma regressão vira vazamento de dado
   entre usuários. O que existe hoje cobre o carrinho e os dois clientes HTTP;
   o resto do backend não tem teste nenhum.

   Falta também **teste de integração das rotas** (app real + banco em memória,
   ERP mockado), que é onde se verifica autenticação, formato de erro e
   isolamento por `usuario_id` — coisas que teste de unidade de service não
   alcança. E **e2e com Playwright**, com uma ressalva séria: e2e que chega ao
   "Fechar pedido" cria pedido de verdade no SIAC e dá baixa em estoque
   compartilhado com os outros candidatos. Ou aponta para um ERP falso local,
   ou para um passo antes do checkout.
3. **Validação de requisição com schema declarativo (zod)** no backend inteiro,
   com adaptador para o `ApiError` atual. Detalhado na seção 6.
4. **Especificação OpenAPI (Swagger) da API.** O `ARQUITETURA.md` documenta os
   24 endpoints numa tabela — e conferi: ela bate exatamente com o código, sem
   rota fantasma nem rota faltando. O que falta é profundidade. A tabela tem
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
5. **Cache de leitura do ERP.** Hoje cada leitura de carrinho faz uma chamada
   por item (`carrinhoService.js:24-32`) e `GET /pedidos` faz N chamadas por
   página (`pedidoService.js:117`) — o próprio `ARQUITETURA.md` registra os dois
   como limitação aceita. Catálogo e dados de produto são o caso fácil: mudam
   pouco e o README diz que o estoque do ERP se atualiza a cada 30 minutos, o
   que dá um teto natural de TTL. O cuidado é separar o que pode envelhecer
   (descrição, preço, categoria) do que não pode decidir sozinho (estoque na
   hora de fechar o pedido, que precisa continuar vindo do ERP). Um cache em
   memória no `erp/cliente.js` — ponto único de acesso ao ERP, por projeto —
   resolveria sem espalhar mudança pelo resto do código.

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

**Organização do histórico.** `main` tem um commit único com o projeto
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
57 arquivos produziria um diff que soterraria as correções, e o enunciado
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
(`carrinhoService.js:126`), `alterarQuantidade` (`:171`) e
`pronto_para_checkout` (`:95`). Se o estoque está defasado para menos, a loja
recusa uma venda que o ERP aceitaria, e o cliente não tem como insistir: vê
"sem estoque" numa peça que existe e desiste.

Inferência minha, não documentada: pelo comentário em `pedidoService.js:61`
("daqui para baixo o estoque JÁ foi baixado no ERP"), a venda online decrementa
na hora. Então os 30 minutos valem para movimentação externa — venda no balcão
da loja física, ajuste de inventário —, não para pedidos da loja.

Não mexi nisso. Afrouxar a pré-validação é decisão de produto (vender e correr
o risco do `409`, ou bloquear antes), não correção de defeito.


