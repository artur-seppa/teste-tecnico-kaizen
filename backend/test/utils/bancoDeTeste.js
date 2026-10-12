import Database from 'better-sqlite3';
import { aplicarSchema } from '../../src/db/index.js';
import { itemCarrinhoFactory } from '../factories/itemCarrinho.js';
import { usuarioFactory } from '../factories/usuario.js';

// Os services aceitam `db` por parametro, entao o teste nao toca no banco de
// desenvolvimento nem no DB_PATH.
export function criarBancoDeTeste() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  aplicarSchema(db);
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

/** Troca o conteudo do carrinho: [['ARR-7001', 2], ...]. */
export function semearCarrinho(db, usuarioId, itens) {
  db.prepare('DELETE FROM carrinho_itens WHERE usuario_id = ?').run(usuarioId);

  const inserir = db.prepare(`
    INSERT INTO carrinho_itens (usuario_id, codigo_produto, quantidade, adicionado_em)
    VALUES (@usuario_id, @codigo_produto, @quantidade, @adicionado_em)
  `);

  itens.forEach(([codigo, quantidade], posicao) => {
    inserir.run(itemCarrinhoFactory({ usuarioId, codigo, quantidade, posicao }));
  });
}
