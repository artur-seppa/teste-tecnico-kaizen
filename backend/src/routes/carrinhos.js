import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import {
  adicionarNaAtiva,
  alterarQuantidade,
  lerCarrinho,
  limparItens,
  removerItem,
  MAXIMO_POR_ITEM,
} from '../services/carrinhoService.js';
import {
  criar,
  editar,
  listar,
  marcarPrincipal,
  remover,
} from '../services/carrinhosService.js';
import {
  ColetorDeErros,
  exigirObjeto,
  inteiroPositivo,
  lerBooleanoDeCorpo,
  textoObrigatorio,
  textoOpcional,
} from '../lib/validacao.js';

export const rotasCarrinhos = Router();

rotasCarrinhos.use(autenticar);

/** Le o :id da rota como inteiro positivo, acusando 422 se vier invalido. */
function lerIdDaRota(valor) {
  const erros = new ColetorDeErros();
  const id = inteiroPositivo(valor, 'id', erros, { max: 1e9 });
  erros.lancarSeInvalido('Carrinho invalido.');
  return id;
}

// ------------------------------------------------------------- carrinhos --

/** GET /api/carrinhos - resumos locais, sem tocar o ERP. */
rotasCarrinhos.get('/', (req, res) => {
  res.json({ dados: listar(req.usuario.id) });
});

/** POST /api/carrinhos */
rotasCarrinhos.post('/', (req, res) => {
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const titulo = textoObrigatorio(corpo.titulo, 'titulo', erros, { min: 1, max: 60 });
  const descricao = textoOpcional(corpo.descricao, 'descricao', erros, { max: 200 });
  const principal = lerBooleanoDeCorpo(corpo.principal, 'principal', erros);

  erros.lancarSeInvalido('Nao foi possivel criar o carrinho.');

  const id = criar(req.usuario.id, { titulo, descricao, principal });
  res.status(201).json({ dados: lerResumo(req.usuario.id, id) });
});

/** Resumo de um carrinho recem-criado/editado, para a resposta. */
function lerResumo(usuarioId, carrinhoId) {
  return listar(usuarioId).find((carrinho) => carrinho.id === carrinhoId) ?? null;
}

/** GET /api/carrinhos/:id - um carrinho com itens enriquecidos pelo ERP. */
rotasCarrinhos.get('/:id', async (req, res) => {
  const id = lerIdDaRota(req.params.id);
  res.json({ dados: await lerCarrinho(req.usuario.id, id) });
});

/** PATCH /api/carrinhos/:id */
rotasCarrinhos.patch('/:id', (req, res) => {
  const id = lerIdDaRota(req.params.id);
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const titulo = corpo.titulo === undefined
    ? undefined
    : textoObrigatorio(corpo.titulo, 'titulo', erros, { min: 1, max: 60 });
  const descricao = corpo.descricao === undefined
    ? undefined
    : textoOpcional(corpo.descricao, 'descricao', erros, { max: 200 });

  erros.lancarSeInvalido('Nao foi possivel editar o carrinho.');

  editar(req.usuario.id, id, { titulo, descricao });
  res.json({ dados: lerResumo(req.usuario.id, id) });
});

/** PUT /api/carrinhos/:id/principal - trocar de carrinho ativo. */
rotasCarrinhos.put('/:id/principal', (req, res) => {
  const id = lerIdDaRota(req.params.id);
  marcarPrincipal(req.usuario.id, id);
  res.json({ dados: listar(req.usuario.id) });
});

/** DELETE /api/carrinhos/:id */
rotasCarrinhos.delete('/:id', (req, res) => {
  const id = lerIdDaRota(req.params.id);
  remover(req.usuario.id, id);
  res.json({ dados: listar(req.usuario.id) });
});

// ----------------------------------------------------------------- itens --

/** POST /api/carrinhos/itens - adiciona na ativa (cria "Carrinho 1" se preciso). */
rotasCarrinhos.post('/itens', async (req, res) => {
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const codigo = textoObrigatorio(corpo.codigo_produto, 'codigo_produto', erros, { min: 1, max: 40 });
  const quantidade = inteiroPositivo(corpo.quantidade ?? 1, 'quantidade', erros, { max: MAXIMO_POR_ITEM });

  erros.lancarSeInvalido('Nao foi possivel adicionar ao carrinho.');

  res.status(201).json({ dados: await adicionarNaAtiva(req.usuario.id, codigo, quantidade) });
});

/** PATCH /api/carrinhos/:id/itens/:codigo */
rotasCarrinhos.patch('/:id/itens/:codigo', async (req, res) => {
  const id = lerIdDaRota(req.params.id);
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const quantidade = inteiroPositivo(corpo.quantidade, 'quantidade', erros, { max: MAXIMO_POR_ITEM });

  erros.lancarSeInvalido('Quantidade invalida.');

  res.json({ dados: await alterarQuantidade(req.usuario.id, id, req.params.codigo, quantidade) });
});

/** DELETE /api/carrinhos/:id/itens/:codigo */
rotasCarrinhos.delete('/:id/itens/:codigo', async (req, res) => {
  const id = lerIdDaRota(req.params.id);
  res.json({ dados: await removerItem(req.usuario.id, id, req.params.codigo) });
});

/** DELETE /api/carrinhos/:id/itens - esvazia o carrinho. */
rotasCarrinhos.delete('/:id/itens', async (req, res) => {
  const id = lerIdDaRota(req.params.id);
  res.json({ dados: await limparItens(req.usuario.id, id) });
});
