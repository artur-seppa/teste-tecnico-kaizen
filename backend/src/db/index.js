import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { rodarMigracoes } from './migracoes.js';

let instancia = null;

export function obterBanco() {
  if (instancia) return instancia;

  fs.mkdirSync(path.dirname(config.caminhoBanco), { recursive: true });
  instancia = new Database(config.caminhoBanco);

  instancia.pragma('journal_mode = WAL');
  instancia.pragma('foreign_keys = ON');
  instancia.pragma('busy_timeout = 5000');

  return instancia;
}

/**
 * Leva o banco ao estado atual aplicando as migracoes pendentes. Substitui o
 * antigo `aplicarSchema`, que dava um `exec` num arquivo de schema unico: a
 * atualizacao de um banco com dados agora e segura e versionada.
 */
export function migrarBanco(db = obterBanco()) {
  rodarMigracoes(db);
}

export function fecharBanco() {
  if (instancia) {
    instancia.close();
    instancia = null;
  }
}

export function agoraISO() {
  return new Date().toISOString();
}
