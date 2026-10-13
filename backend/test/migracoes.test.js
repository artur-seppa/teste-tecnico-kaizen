import fs from 'node:fs';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { rodarMigracoes } from '../src/db/migracoes.js';

const baselineSql = fs.readFileSync(
  new URL('../src/db/migrations/000_baseline.sql', import.meta.url),
  'utf8',
);

/**
 * Deixa o banco no estado anterior a 001: aplica o baseline e o marca como ja
 * rodado, para o runner aplicar so a 001 por cima - e assim exercitar o backfill
 * com dados no formato antigo ja presentes.
 */
function bancoNoBaseline() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(baselineSql);
  db.exec(`
    CREATE TABLE schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL);
    INSERT INTO schema_migrations (nome, aplicada_em) VALUES ('000_baseline.sql', '2026-01-01T00:00:00.000Z');
  `);
  return db;
}

const colunas = (db, tabela) =>
  db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);

// Runner de migracao: aplica os arquivos NNN_*.sql de src/db/migrations em
// ordem, uma vez cada, registrando em schema_migrations.

function bancoNovo() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

const tabelas = (db) =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((linha) => linha.name);

describe('rodarMigracoes', () => {
  let db;

  beforeEach(() => {
    db = bancoNovo();
  });

  it('cria schema_migrations e registra o baseline', () => {
    rodarMigracoes(db);

    expect(tabelas(db)).toContain('schema_migrations');
    const aplicadas = db.prepare('SELECT nome FROM schema_migrations ORDER BY nome').all();
    expect(aplicadas.map((linha) => linha.nome)).toContain('000_baseline.sql');
  });

  it('cria as tabelas do baseline', () => {
    rodarMigracoes(db);

    for (const tabela of ['usuarios', 'enderecos', 'carrinho_itens', 'pedidos_usuario']) {
      expect(tabelas(db)).toContain(tabela);
    }
  });

  it('e idempotente: rodar duas vezes nao falha nem duplica registro', () => {
    rodarMigracoes(db);
    const antes = db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get().total;

    expect(() => rodarMigracoes(db)).not.toThrow();

    const depois = db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get().total;
    expect(depois).toBe(antes);
  });
});

describe('001 - multiplos carrinhos', () => {
  it('cria carrinhos e carrinho_itens ganha carrinho_id, sem usuario_id', () => {
    const db = bancoNoBaseline();
    rodarMigracoes(db);

    expect(colunas(db, 'carrinhos')).toEqual(
      expect.arrayContaining(['id', 'usuario_id', 'titulo', 'descricao', 'principal']),
    );
    expect(colunas(db, 'carrinho_itens')).toContain('carrinho_id');
    expect(colunas(db, 'carrinho_itens')).not.toContain('usuario_id');
  });

  it('backfill: quem tinha itens ganha um "Carrinho 1" principal com os itens', () => {
    const db = bancoNoBaseline();
    db.prepare(`
      INSERT INTO usuarios (id, nome, email, senha_hash, documento, criado_em, atualizado_em)
      VALUES (7, 'Fulano', 'f@x.com', 'h', '123', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO carrinho_itens (usuario_id, codigo_produto, quantidade, adicionado_em)
      VALUES (7, 'ARR-7001', 2, '2026-01-01T00:00:00.000Z'), (7, 'ARR-7003', 1, '2026-01-01T00:00:00.000Z')
    `).run();

    rodarMigracoes(db);

    const carrinhos = db.prepare('SELECT * FROM carrinhos WHERE usuario_id = 7').all();
    expect(carrinhos).toHaveLength(1);
    expect(carrinhos[0].principal).toBe(1);
    expect(carrinhos[0].titulo).toBe('Carrinho 1');

    const itens = db
      .prepare('SELECT codigo_produto, quantidade, carrinho_id FROM carrinho_itens ORDER BY codigo_produto')
      .all();
    expect(itens).toHaveLength(2);
    expect(itens.every((item) => item.carrinho_id === carrinhos[0].id)).toBe(true);
    expect(itens[0]).toMatchObject({ codigo_produto: 'ARR-7001', quantidade: 2 });
  });

  it('impede dois principais para o mesmo usuario (indice unico parcial)', () => {
    const db = bancoNoBaseline();
    db.prepare(`
      INSERT INTO usuarios (id, nome, email, senha_hash, documento, criado_em, atualizado_em)
      VALUES (8, 'Beltrano', 'b@x.com', 'h', '123', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `).run();
    rodarMigracoes(db);

    const inserir = db.prepare(`
      INSERT INTO carrinhos (usuario_id, titulo, principal, criado_em, atualizado_em)
      VALUES (8, ?, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `);
    inserir.run('A');
    expect(() => inserir.run('B')).toThrow();
  });
});
