import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAXIMO_CARRINHOS,
  criar,
  editar,
  listar,
  marcarPrincipal,
  remover,
  resolverAtivaOuCriar,
  resolverDoUsuario,
} from '../src/services/carrinhosService.js';
import { criarBancoDeTeste, semearUsuario } from './utils/bancoDeTeste.js';

// carrinhosService e local: nao toca o ERP (listar/criar/etc). Leitura com preco
// e do carrinhoService. Por isso nenhum mock de ERP aqui.

let db;
let usuarioId;
let outroId;

beforeEach(() => {
  db = criarBancoDeTeste();
  usuarioId = semearUsuario(db, { id: 1, email: 'dono@x.com' });
  outroId = semearUsuario(db, { id: 2, email: 'intruso@x.com' });
});

const porId = (id) => db.prepare('SELECT * FROM carrinhos WHERE id = ?').get(id);
const principaisDe = (uid) =>
  db.prepare('SELECT COUNT(*) AS t FROM carrinhos WHERE usuario_id = ? AND principal = 1').get(uid).t;

describe('criar', () => {
  it('o primeiro carrinho nasce principal', () => {
    const id = criar(usuarioId, { titulo: 'Gol do Joao' }, db);
    expect(porId(id).principal).toBe(1);
  });

  it('o segundo nasce nao-principal', () => {
    criar(usuarioId, { titulo: 'Gol do Joao' }, db);
    const id2 = criar(usuarioId, { titulo: 'Civic prata' }, db);
    expect(porId(id2).principal).toBe(0);
    expect(principaisDe(usuarioId)).toBe(1);
  });

  it('criar com principal:true desmarca os outros', () => {
    const id1 = criar(usuarioId, { titulo: 'A' }, db);
    criar(usuarioId, { titulo: 'B', principal: true }, db);
    expect(porId(id1).principal).toBe(0);
    expect(principaisDe(usuarioId)).toBe(1);
  });

  it('barra no limite de carrinhos', () => {
    for (let i = 0; i < MAXIMO_CARRINHOS; i++) criar(usuarioId, { titulo: `C${i}` }, db);
    expect(() => criar(usuarioId, { titulo: 'excedente' }, db)).toThrowError(
      expect.objectContaining({ codigo: 'LIMITE_CARRINHOS', status: 409 }),
    );
  });
});

describe('listar', () => {
  it('ordena o principal primeiro e traz contagens locais', () => {
    const a = criar(usuarioId, { titulo: 'A' }, db); // principal
    const b = criar(usuarioId, { titulo: 'B' }, db);
    db.prepare("INSERT INTO carrinho_itens (carrinho_id, codigo_produto, quantidade, adicionado_em) VALUES (?, 'X', 3, '2026-01-01T00:00:00.000Z')").run(b);

    const lista = listar(usuarioId, db);

    expect(lista[0].id).toBe(a);
    expect(lista[0].principal).toBe(true);
    const resumoB = lista.find((c) => c.id === b);
    expect(resumoB).toMatchObject({ quantidade_itens: 1, quantidade_pecas: 3 });
  });
});

describe('marcarPrincipal', () => {
  it('deixa exatamente um principal', () => {
    criar(usuarioId, { titulo: 'A' }, db);
    const b = criar(usuarioId, { titulo: 'B' }, db);

    marcarPrincipal(usuarioId, b, db);

    expect(porId(b).principal).toBe(1);
    expect(principaisDe(usuarioId)).toBe(1);
  });
});

describe('remover', () => {
  it('apagar o principal promove o mais recente que sobrou', () => {
    const a = criar(usuarioId, { titulo: 'A' }, db); // principal
    const b = criar(usuarioId, { titulo: 'B' }, db);
    // b e mais recente (atualizado depois)
    db.prepare("UPDATE carrinhos SET atualizado_em = '2027-01-01T00:00:00.000Z' WHERE id = ?").run(b);

    remover(usuarioId, a, db);

    expect(porId(a)).toBeUndefined();
    expect(porId(b).principal).toBe(1);
  });

  it('apagar o unico deixa zero carrinhos', () => {
    const a = criar(usuarioId, { titulo: 'A' }, db);
    remover(usuarioId, a, db);
    expect(listar(usuarioId, db)).toHaveLength(0);
  });
});

describe('resolverAtivaOuCriar', () => {
  it('cria "Carrinho 1" principal quando o usuario nao tem nenhum', () => {
    const carrinho = resolverAtivaOuCriar(usuarioId, db);
    expect(carrinho.titulo).toBe('Carrinho 1');
    expect(carrinho.principal).toBe(1);
  });
});

describe('isolamento entre usuarios', () => {
  it('nao resolve, edita, marca nem remove carrinho de outro dono (404)', () => {
    const alheio = criar(outroId, { titulo: 'Do intruso' }, db);
    const naoEncontrado = expect.objectContaining({ status: 404 });

    expect(() => resolverDoUsuario(usuarioId, alheio, db)).toThrowError(naoEncontrado);
    expect(() => editar(usuarioId, alheio, { titulo: 'x' }, db)).toThrowError(naoEncontrado);
    expect(() => marcarPrincipal(usuarioId, alheio, db)).toThrowError(naoEncontrado);
    expect(() => remover(usuarioId, alheio, db)).toThrowError(naoEncontrado);

    // o carrinho do outro segue intacto
    expect(porId(alheio)).toBeDefined();
  });
});
