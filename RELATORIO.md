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

1. **O README e o código discordam do nome da variável.** O README diz que
   `SIAC_URL` é a base da API; `config.js` lê `ERP_URL`, que é o nome usado no
   `.env.example`. Quem segue o README configura uma variável que ninguém lê.
2. **Não havia como descobrir a URL e o token pelo `.env.example`** — ele diz
   "cole aqui". Os valores reais estavam hardcoded no `config.js` (ver Problema
   1), então achei lendo o código, não pela configuração.
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
| **Causa** | |
| **Como reproduzi** | |
| **Arquivos alterados** | |
| **Como validei a correção** | |

*Alguma observação? (algo que te surpreendeu, decisão que precisou tomar)*



### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | |
| **Como reproduzi** | |
| **Arquivos alterados** | |
| **Como validei a correção** | |



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

*O que você fez para confirmar que funciona e que não quebrou nada. Teste
manual conta — descreva o caminho que percorreu.*



*Se escreveu testes automatizados, diga como rodar:*



---

## 6. Decisões e suposições

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
2. **Suíte de testes com `node:test`**, começando por login, posse de pedido e
   de endereço, e checkout com estoque insuficiente — os pontos onde uma
   regressão vira vazamento de dado entre usuários.
3. **Validação de requisição com schema declarativo (zod)** no backend inteiro,
   com adaptador para o `ApiError` atual. Detalhado na seção 6.
4. **Cache de leitura do ERP.** Hoje cada leitura de carrinho faz uma chamada
   por item (`carrinhoService.js:18-21`) e `GET /pedidos` faz N chamadas por
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

**Marcadores de revisão encontrados no código:** `KZN-2B9C` (`backend/src/config.js`).
O bloco pedia que o identificador fosse citado aqui. O trecho que ele sinalizava
era o `PADRAO` com os segredos embutidos — tratado no Problema 1. Mantive o
comentário no arquivo, reescrito para registrar o que foi reavaliado.

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
(`carrinhoService.js:119`), `alterarQuantidade` (`:164`) e
`pronto_para_checkout` (`:95`). Se o estoque está defasado para menos, a loja
recusa uma venda que o ERP aceitaria, e o cliente não tem como insistir: vê
"sem estoque" numa peça que existe e desiste.

Inferência minha, não documentada: pelo comentário em `pedidoService.js:61`
("daqui para baixo o estoque JÁ foi baixado no ERP"), a venda online decrementa
na hora. Então os 30 minutos valem para movimentação externa — venda no balcão
da loja física, ajuste de inventário —, não para pedidos da loja.

Não mexi nisso. Afrouxar a pré-validação é decisão de produto (vender e correr
o risco do `409`, ou bloquear antes), não correção de defeito.


