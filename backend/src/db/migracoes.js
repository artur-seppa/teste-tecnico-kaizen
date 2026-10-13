import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runner de migracao minimo.
 *
 * Aplica, em ordem de nome, cada arquivo `NNN_*.sql` de `migrations/` que ainda
 * nao esta em `schema_migrations`. Cada arquivo roda dentro de uma transacao, e
 * so e registrado se aplicar inteiro - um erro no meio nao deixa a migracao
 * "meio aplicada". Rodar de novo nao refaz o que ja passou.
 *
 * Nao ha "down": no SQLite uma migracao desfeita costuma exigir rebuild de
 * tabela de qualquer forma, entao reverter e escrever a proxima migracao, nao
 * um rollback automatico.
 */
const pastaMigracoes = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function garantirTabelaDeControle(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome        TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL
    )
  `);
}

function listarArquivos() {
  return fs
    .readdirSync(pastaMigracoes)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();
}

export function rodarMigracoes(db) {
  garantirTabelaDeControle(db);

  const jaAplicadas = new Set(
    db.prepare('SELECT nome FROM schema_migrations').all().map((linha) => linha.nome),
  );

  const registrar = db.prepare(
    'INSERT INTO schema_migrations (nome, aplicada_em) VALUES (?, ?)',
  );

  for (const nome of listarArquivos()) {
    if (jaAplicadas.has(nome)) continue;

    const sql = fs.readFileSync(path.join(pastaMigracoes, nome), 'utf8');

    db.transaction(() => {
      db.exec(sql);
      registrar.run(nome, new Date().toISOString());
    })();
  }
}
