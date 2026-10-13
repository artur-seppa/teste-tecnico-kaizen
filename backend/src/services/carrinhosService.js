import { obterBanco, agoraISO } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';

const MAXIMO_CARRINHOS = 10;
const TITULO_PADRAO = 'Carrinho 1';

/**
 * Dono da tabela `carrinhos`. CRUD, flag principal e resolucao por
 * `(id, usuario_id)` - toda leitura/escrita de item passa por aqui primeiro,
 * entao o isolamento entre clientes mora neste modulo.
 *
 * Leitura de item com preco/estoque e do `carrinhoService` (que fala com o ERP);
 * aqui as contagens sao locais, sem tocar o ERP, para listar muitos carrinhos
 * ser barato.
 */

function desmarcarOutrosPrincipais(usuarioId, exceto, db) {
  db.prepare('UPDATE carrinhos SET principal = 0 WHERE usuario_id = ? AND id != ?')
    .run(usuarioId, exceto ?? -1);
}

/** Linha do carrinho que e do usuario, ou 404. */
export function resolverDoUsuario(usuarioId, carrinhoId, db = obterBanco()) {
  const carrinho = db
    .prepare('SELECT * FROM carrinhos WHERE id = ? AND usuario_id = ?')
    .get(carrinhoId, usuarioId);

  if (!carrinho) {
    throw ApiError.naoEncontrado('Carrinho nao encontrado.');
  }

  return carrinho;
}

/** O carrinho principal do usuario; cria "Carrinho 1" se ele nao tem nenhum. */
export function resolverAtivaOuCriar(usuarioId, db = obterBanco()) {
  const principal = db
    .prepare('SELECT * FROM carrinhos WHERE usuario_id = ? AND principal = 1')
    .get(usuarioId);

  if (principal) return principal;

  const id = inserirCarrinho(usuarioId, { titulo: TITULO_PADRAO, principal: 1 }, db);
  return db.prepare('SELECT * FROM carrinhos WHERE id = ?').get(id);
}

function inserirCarrinho(usuarioId, { titulo, descricao = null, principal }, db) {
  const agora = agoraISO();

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO carrinhos (usuario_id, titulo, descricao, principal, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(usuarioId, titulo, descricao, principal ? 1 : 0, agora, agora);

  return Number(lastInsertRowid);
}

export function listar(usuarioId, db = obterBanco()) {
  return db.prepare(`
    SELECT
      c.id,
      c.titulo,
      c.descricao,
      c.principal,
      c.atualizado_em,
      COUNT(i.id)                         AS quantidade_itens,
      COALESCE(SUM(i.quantidade), 0)      AS quantidade_pecas
    FROM carrinhos c
    LEFT JOIN carrinho_itens i ON i.carrinho_id = c.id
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.principal DESC, c.atualizado_em DESC, c.id DESC
  `).all(usuarioId).map((linha) => ({
    ...linha,
    principal: linha.principal === 1,
  }));
}

export function criar(usuarioId, { titulo, descricao = null, principal = false }, db = obterBanco()) {
  const total = db
    .prepare('SELECT COUNT(*) AS total FROM carrinhos WHERE usuario_id = ?')
    .get(usuarioId).total;

  if (total >= MAXIMO_CARRINHOS) {
    throw ApiError.conflito(
      'LIMITE_CARRINHOS',
      `Voce atingiu o limite de ${MAXIMO_CARRINHOS} carrinhos.`,
    );
  }

  // O primeiro carrinho e sempre o principal; a invariante "existe um ativo
  // quando ha carrinhos" nao pode nascer quebrada.
  const viraPrincipal = principal || total === 0;

  return db.transaction(() => {
    // Desmarca antes de inserir: o indice unico parcial recusaria um segundo
    // principal no proprio INSERT, antes de qualquer UPDATE posterior.
    if (viraPrincipal) desmarcarOutrosPrincipais(usuarioId, null, db);
    return inserirCarrinho(usuarioId, { titulo, descricao, principal: viraPrincipal }, db);
  })();
}

export function editar(usuarioId, carrinhoId, { titulo, descricao }, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);

  const campos = [];
  const valores = [];
  if (titulo !== undefined) { campos.push('titulo = ?'); valores.push(titulo); }
  if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao); }
  if (campos.length === 0) return;

  campos.push('atualizado_em = ?');
  valores.push(agoraISO(), carrinhoId);

  db.prepare(`UPDATE carrinhos SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
}

export function marcarPrincipal(usuarioId, carrinhoId, db = obterBanco()) {
  resolverDoUsuario(usuarioId, carrinhoId, db);

  db.transaction(() => {
    desmarcarOutrosPrincipais(usuarioId, carrinhoId, db);
    db.prepare('UPDATE carrinhos SET principal = 1 WHERE id = ?').run(carrinhoId);
  })();
}

export function remover(usuarioId, carrinhoId, db = obterBanco()) {
  const carrinho = resolverDoUsuario(usuarioId, carrinhoId, db);

  db.transaction(() => {
    db.prepare('DELETE FROM carrinhos WHERE id = ?').run(carrinhoId);

    // Apagou o principal: promove o mais recente que sobrou, para o checkout e a
    // vitrine nunca ficarem sem um ativo enquanto houver carrinhos.
    if (carrinho.principal === 1) {
      const proximo = db
        .prepare('SELECT id FROM carrinhos WHERE usuario_id = ? ORDER BY atualizado_em DESC, id DESC LIMIT 1')
        .get(usuarioId);

      if (proximo) {
        db.prepare('UPDATE carrinhos SET principal = 1 WHERE id = ?').run(proximo.id);
      }
    }
  })();
}

export { MAXIMO_CARRINHOS };
