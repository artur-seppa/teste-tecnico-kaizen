import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dinheiro } from '../api/cliente.js';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { LinhaItem } from '../componentes/LinhaItem.jsx';
import { SeletorCarrinho } from '../componentes/SeletorCarrinho.jsx';
import { Alerta, Botao, Carregando, EstadoVazio } from '../componentes/ui.jsx';

export function Carrinho() {
  const { carrinhoAtivo, carrinhos, carregando, alterar, remover, limpar } = useCarrinho();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  async function executar(acao) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (falha) {
      setErro(falha);
    } finally {
      setOcupado(false);
    }
  }

  if (carregando && !carrinhoAtivo) {
    return <Carregando texto="Carregando carrinho..." />;
  }

  // Sem nenhum carrinho: convida a criar (o seletor cuida do estado vazio).
  if (carrinhos.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <SeletorCarrinho />
      </div>
    );
  }

  const itens = carrinhoAtivo?.itens ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-tinta-900">Meus carrinhos</h1>

      {erro && <Alerta tipo="erro">{erro.message}</Alerta>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-tinta-200 bg-white p-4">
            <SeletorCarrinho />
          </div>

          {carrinhoAtivo && !carrinhoAtivo.pronto_para_checkout && itens.length > 0 && (
            <Alerta tipo="aviso" titulo="Alguns itens precisam de ajuste">
              Ajuste ou remova os itens marcados abaixo para fechar o pedido.
            </Alerta>
          )}

          {itens.length === 0 ? (
            <EstadoVazio
              titulo="Este carrinho está vazio"
              descricao="Procure a peça pelo nome, pela marca ou pelo carro em que ela se aplica."
              acao={<Link to="/"><Botao>Ver catálogo</Botao></Link>}
            />
          ) : (
            <div className="rounded-xl border border-tinta-200 bg-white px-5">
              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => executar(limpar)}
                  disabled={ocupado}
                  className="text-sm text-tinta-500 underline hover:text-red-600 disabled:opacity-50"
                >
                  Esvaziar carrinho
                </button>
              </div>
              <ul className="divide-y divide-tinta-200">
                {itens.map((item) => (
                  <LinhaItem
                    key={item.codigo_produto}
                    item={item}
                    ocupado={ocupado}
                    aoAlterar={(codigo, quantidade) => executar(() => alterar(codigo, quantidade))}
                    aoRemover={(codigo) => executar(() => remover(codigo))}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-tinta-200 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-500">Resumo</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Itens</dt>
              <dd className="font-medium">{carrinhoAtivo?.quantidade_pecas ?? 0}</dd>
            </div>
            <div className="flex justify-between border-t border-tinta-200 pt-3 text-base">
              <dt className="font-semibold text-tinta-900">Total</dt>
              <dd className="font-bold text-tinta-900">{dinheiro.format(carrinhoAtivo?.valor_total ?? 0)}</dd>
            </div>
          </dl>

          <Link to="/checkout" className="mt-5 block">
            <Botao
              tamanho="grande"
              className="w-full"
              disabled={!carrinhoAtivo?.pronto_para_checkout || ocupado}
            >
              Fechar pedido
            </Botao>
          </Link>

          <Link
            to="/"
            className="mt-3 block text-center text-sm text-tinta-600 underline hover:text-marca-700"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
