import { obterBanco, agoraISO } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';
import { paraCentavos, paraReais } from '../lib/dinheiro.js';
import * as erp from '../erp/cliente.js';
import { comImagemDaLoja } from '../lib/produto.js';
import { resolverAtivaOuCriar, resolverDoUsuario } from './carrinhosService.js';

const MAXIMO_ITENS = 50;
const MAXIMO_POR_ITEM = 99;

/**
 * Dono da tabela `carrinho_itens`. Cada item pertence a um carrinho; o dono do
 * carrinho e checado pelo `carrinhosService` antes de qualquer operacao, entao
 * nenhuma funcao daqui recebe item de um carrinho que nao e do usuario.
 *
 * O carrinho guarda apenas codigo + quantidade. Preco, descricao e estoque sao
 * buscados no ERP a cada leitura, entao o cliente nunca ve preco congelado nem
 * compra algo que saiu de linha. O custo e uma chamada por item - aceitavel para
 * um carrinho.
 */
async function enriquecerItens(linhas) {
  return Promise.all(
    linhas.map(async (linha) => {
      let produto = null;

      try {
        produto = await erp.buscarProduto(linha.codigo_produto);
      } catch (erro) {
        // Produto sumiu do catalogo ou o ERP tropecou: o carrinho continua
        // aparecendo, com o item marcado. Melhor que uma tela de erro.
        if (erro?.status !== 404) {
          console.error(`[carrinho] falha ao ler ${linha.codigo_produto}:`, erro?.mensagem);
        }
      }

      if (!produto) {
        return {
          codigo_produto: linha.codigo_produto,
          descricao: linha.codigo_produto,
          quantidade: linha.quantidade,
          disponivel: false,
          problema: 'Produto indisponivel no catalogo.',
          preco_unitario: 0,
          valor_total: 0,
        };
      }

      const totalCentavos = paraCentavos(produto.preco_unitario) * linha.quantidade;

      let problema = null;
      if (!produto.ativo) problema = 'Produto saiu de linha.';
      else if (produto.estoque === 0) problema = 'Sem estoque no momento.';
      else if (produto.estoque < linha.quantidade) {
        problema = `Restam apenas ${produto.estoque} em estoque.`;
      }

      return {
        codigo_produto: produto.codigo,
        descricao: produto.descricao,
        marca: produto.marca,
        categoria: produto.categoria,
        aplicacao: produto.aplicacao,
        imagem_url: comImagemDaLoja(produto).imagem_url,
        preco_unitario: produto.preco_unitario,
        quantidade: linha.quantidade,
        estoque: produto.estoque,
        disponivel: problema === null,
        problema,
        valor_total: paraReais(totalCentavos),
      };
    }),
  );
}

/** Marca que o carrinho mudou, para a listagem ordenar pelo uso recente. */
function tocarCarrinho(carrinhoId, db) {
  db.prepare('UPDATE carrinhos SET atualizado_em = ? WHERE id = ?').run(agoraISO(), carrinhoId);
}

/*
 * NOTA DE REVISAO [KZN-7F3A] - reavaliada, trecho corrigido.
 *
 * Historico no RELATORIO.md (secao 2). Os dois chamados do carrinho moravam
 * aqui: o total somava linha indisponivel (KZN-312) e quantidade_pecas repetia
 * itens.length (KZN-318). Com multiplos carrinhos (secao 4), a leitura passou a
 * ser por carrinho (`carrinhoId`), resolvido por (id, usuario_id).
 */
export async function lerCarrinho(usuarioId, carrinhoId, db = obterBanco()) {
  const carrinho = resolverDoUsuario(usuarioId, carrinhoId, db);
  return montarCarrinho(carrinho, db);
}

async function montarCarrinho(carrinho, db) {
  const linhas = db
    .prepare('SELECT * FROM carrinho_itens WHERE carrinho_id = ? ORDER BY adicionado_em ASC, id ASC')
    .all(carrinho.id);

  const itens = await enriquecerItens(linhas);

  // So o que da para comprar entra no total: o numero em destaque e o que a
  // pessoa vai pagar, e com um item bloqueado o checkout nem abre.
  const totalCentavos = itens.reduce(
    (soma, item) => (item.disponivel ? soma + paraCentavos(item.valor_total) : soma),
    0,
  );

  return {
    id: carrinho.id,
    titulo: carrinho.titulo,
    descricao: carrinho.descricao,
    principal: carrinho.principal === 1,
    itens,
    // Linhas (produtos distintos) e pecas (soma das unidades) sao numeros
    // diferentes - o contador do cabecalho usa o segundo.
    quantidade_itens: itens.length,
    quantidade_pecas: itens.reduce((soma, item) => soma + item.quantidade, 0),
    valor_total: paraReais(totalCentavos),
    pronto_para_checkout: itens.length > 0 && itens.every((item) => item.disponivel),
  };
}

/** Adiciona na carrinho ativa (principal), criando "Carrinho 1" se nao houver. */
export async function adicionarNaAtiva(usuarioId, codigoProduto, quantidade, db = obterBanco()) {
  const carrinho = resolverAtivaOuCriar(usuarioId, db);
  return adicionarItem(usuarioId, carrinho.id, codigoProduto, quantidade, db);
}

/** Soma a quantidade se o item ja estiver no carrinho. */
export async function adicionarItem(usuarioId, carrinhoId, codigoProduto, quantidade, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);

  // Valida contra o ERP antes de gravar: nao faz sentido guardar codigo que nao
  // existe e so descobrir isso no checkout.
  const produto = await erp.buscarProduto(codigoProduto);

  if (!produto) {
    throw ApiError.naoEncontrado(`Produto nao encontrado: ${codigoProduto}`);
  }

  if (!produto.ativo) {
    throw ApiError.conflito('PRODUTO_INATIVO', 'Esse produto saiu de linha.');
  }

  const existente = db
    .prepare('SELECT * FROM carrinho_itens WHERE carrinho_id = ? AND codigo_produto = ?')
    .get(carrinhoId, produto.codigo);

  const novaQuantidade = Math.min(MAXIMO_POR_ITEM, (existente?.quantidade ?? 0) + quantidade);

  if (produto.estoque < novaQuantidade) {
    throw ApiError.conflito(
      'ESTOQUE_INSUFICIENTE',
      produto.estoque === 0
        ? 'Produto sem estoque no momento.'
        : `Restam apenas ${produto.estoque} unidades em estoque.`,
      [{ codigo_produto: produto.codigo, estoque_disponivel: produto.estoque }],
    );
  }

  if (existente) {
    db.prepare('UPDATE carrinho_itens SET quantidade = ? WHERE id = ?')
      .run(novaQuantidade, existente.id);
  } else {
    const total = db
      .prepare('SELECT COUNT(*) AS total FROM carrinho_itens WHERE carrinho_id = ?')
      .get(carrinhoId).total;

    if (total >= MAXIMO_ITENS) {
      throw ApiError.conflito(
        'CARRINHO_CHEIO',
        `O carrinho aceita no maximo ${MAXIMO_ITENS} produtos diferentes.`,
      );
    }

    db.prepare(`
      INSERT INTO carrinho_itens (carrinho_id, codigo_produto, quantidade, adicionado_em)
      VALUES (?, ?, ?, ?)
    `).run(carrinhoId, produto.codigo, quantidade, agoraISO());
  }

  tocarCarrinho(carrinhoId, db);
  return lerCarrinho(usuarioId, carrinhoId, db);
}

export async function alterarQuantidade(usuarioId, carrinhoId, codigoProduto, quantidade, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);

  const existente = db
    .prepare('SELECT * FROM carrinho_itens WHERE carrinho_id = ? AND UPPER(codigo_produto) = ?')
    .get(carrinhoId, String(codigoProduto).toUpperCase());

  if (!existente) {
    throw ApiError.naoEncontrado('Esse produto nao esta no seu carrinho.');
  }

  const produto = await erp.buscarProduto(existente.codigo_produto);

  if (produto && produto.estoque < quantidade) {
    throw ApiError.conflito(
      'ESTOQUE_INSUFICIENTE',
      `Restam apenas ${produto.estoque} unidades em estoque.`,
      [{ codigo_produto: produto.codigo, estoque_disponivel: produto.estoque }],
    );
  }

  db.prepare('UPDATE carrinho_itens SET quantidade = ? WHERE id = ?')
    .run(Math.min(MAXIMO_POR_ITEM, quantidade), existente.id);

  tocarCarrinho(carrinhoId, db);
  return lerCarrinho(usuarioId, carrinhoId, db);
}

export async function removerItem(usuarioId, carrinhoId, codigoProduto, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);

  const resultado = db
    .prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ? AND UPPER(codigo_produto) = ?')
    .run(carrinhoId, String(codigoProduto).toUpperCase());

  if (resultado.changes === 0) {
    throw ApiError.naoEncontrado('Esse produto nao esta no seu carrinho.');
  }

  tocarCarrinho(carrinhoId, db);
  return lerCarrinho(usuarioId, carrinhoId, db);
}

export async function limparItens(usuarioId, carrinhoId, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);
  db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ?').run(carrinhoId);
  tocarCarrinho(carrinhoId, db);
  return lerCarrinho(usuarioId, carrinhoId, db);
}

export { MAXIMO_ITENS, MAXIMO_POR_ITEM };
