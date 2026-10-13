import Database from 'better-sqlite3';
import { migrarBanco } from '../../src/db/index.js';
import { carrinhoFactory } from '../factories/carrinho.js';
import { itemCarrinhoFactory } from '../factories/itemCarrinho.js';
import { usuarioFactory } from '../factories/usuario.js';

// Os services aceitam `db` por parametro, entao o teste nao toca no banco de
// desenvolvimento nem no DB_PATH.
export function criarBancoDeTeste() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrarBanco(db);
  return db;
}

export function semearUsuario(db, atributos = {}) {
  const usuario = usuarioFactory(atributos);

  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, documento, telefone, criado_em, atualizado_em)
    VALUES (@id, @nome, @email, @senha_hash, @documento, @telefone, @criado_em, @atualizado_em)
  `).run(usuario);

  return usuario.id;
}

/** Cria um carrinho (vazio) e devolve o id. */
export function semearCarrinhoVazio(db, usuarioId, atributos = {}) {
  const carrinho = carrinhoFactory({ usuarioId, ...atributos });

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO carrinhos (usuario_id, titulo, descricao, principal, criado_em, atualizado_em)
    VALUES (@usuario_id, @titulo, @descricao, @principal, @criado_em, @atualizado_em)
  `).run(carrinho);

  return Number(lastInsertRowid);
}

/**
 * Troca o conteudo do carrinho principal do usuario: apaga os carrinhos atuais,
 * cria um principal e popula com [['ARR-7001', 2], ...]. Devolve o id do carrinho
 * criado, que os testes usam para ler.
 */
export function semearCarrinho(db, usuarioId, itens, atributos = {}) {
  db.prepare('DELETE FROM carrinhos WHERE usuario_id = ?').run(usuarioId);

  const carrinhoId = semearCarrinhoVazio(db, usuarioId, { principal: 1, ...atributos });

  const inserir = db.prepare(`
    INSERT INTO carrinho_itens (carrinho_id, codigo_produto, quantidade, adicionado_em)
    VALUES (@carrinho_id, @codigo_produto, @quantidade, @adicionado_em)
  `);

  itens.forEach(([codigo, quantidade], posicao) => {
    inserir.run(itemCarrinhoFactory({ carrinhoId, codigo, quantidade, posicao }));
  });

  return carrinhoId;
}
