/**
 * Linha da tabela `carrinhos`. Sem faker nos campos que algum teste afirma
 * (titulo, principal); `criado_em`/`atualizado_em` sao previsiveis e crescentes
 * por `posicao`, porque a listagem ordena por `atualizado_em`.
 */
export function carrinhoFactory({ usuarioId = 1, titulo = 'Carrinho 1', descricao = null, principal = 0, posicao = 0 } = {}) {
  const quando = new Date(Date.UTC(2026, 0, 1, 0, 0, posicao)).toISOString();

  return {
    usuario_id: usuarioId,
    titulo,
    descricao,
    principal,
    criado_em: quando,
    atualizado_em: quando,
  };
}
