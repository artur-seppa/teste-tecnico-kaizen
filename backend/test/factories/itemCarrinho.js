/**
 * Linha da tabela `carrinho_itens`. Sem faker: `adicionado_em` precisa ser
 * crescente e previsivel porque `lerCarrinho` ordena por ele.
 */
export function itemCarrinhoFactory({ carrinhoId = 1, codigo, quantidade, posicao = 0 } = {}) {
  return {
    carrinho_id: carrinhoId,
    codigo_produto: codigo,
    quantidade,
    adicionado_em: new Date(Date.UTC(2026, 0, 1, 0, 0, posicao)).toISOString(),
  };
}
