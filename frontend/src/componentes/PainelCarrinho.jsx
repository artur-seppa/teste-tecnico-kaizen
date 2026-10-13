import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dinheiro } from '../api/cliente.js';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { Alerta, Botao } from './ui.jsx';
import { LinhaItem } from './LinhaItem.jsx';
import { SeletorCarrinho } from './SeletorCarrinho.jsx';
import { useDialogoAnimado } from '../hooks/useDialogoAnimado.js';

/**
 * Carrinho sobre a vitrine, sem trocar de rota. Um <dialog> modal: foco preso,
 * Escape e fundo inerte vem do proprio elemento. No desktop entra deslizando
 * pela direita; no celular sobe da base como bottom sheet (ver as classes de
 * posicionamento e de transicao).
 */
export function PainelCarrinho({ aberto, aoFechar }) {
  const ref = useDialogoAnimado(aberto);
  const { carrinhoAtivo, alterar, remover, limpar } = useCarrinho();
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

  const temItens = carrinhoAtivo && carrinhoAtivo.itens.length > 0;

  return (
    <dialog
      ref={ref}
      // O Escape fecharia o dialogo na hora, sem passar pela animacao de saida:
      // `onCancel` cancela o fechamento nativo e devolve a decisao ao pai, que
      // baixa `aberto` e deixa o hook conduzir a saida. O backdrop e tratado
      // pelo onClick abaixo.
      onCancel={(evento) => {
        evento.preventDefault();
        aoFechar();
      }}
      onClick={(evento) => {
        if (evento.target === ref.current) aoFechar();
      }}
      aria-label="Carrinho"
      // Transicao de `translate` (e nao de `transform`): no Tailwind v4 as
      // utilidades `translate-*` escrevem a propriedade `translate`.
      // `overflow-hidden` no proprio dialogo: sem isto o drawer inteiro rola e
      // leva embora o cabecalho e o rodape dele. Quem rola e a lista de itens,
      // logo abaixo. (O transbordo da lista entra no `scrollHeight` do dialogo,
      // e o <dialog> nasce com `overflow: auto` do agente de usuario.)
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md overflow-hidden bg-transparent p-0
        backdrop:bg-black/40
        max-sm:ml-0 max-sm:mt-auto max-sm:h-auto max-sm:max-h-[85dvh] max-sm:max-w-none
        transition-[translate,opacity,display,overlay] transition-discrete duration-300 ease-out
        backdrop:transition-opacity backdrop:duration-300
        starting:backdrop:opacity-0 data-fechando:backdrop:opacity-0
        sm:starting:open:translate-x-full sm:data-fechando:translate-x-full
        max-sm:starting:open:translate-y-full max-sm:data-fechando:translate-y-full
        motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col bg-white shadow-xl
        max-sm:rounded-t-2xl">
        <header className="flex items-center justify-between border-b border-tinta-200 px-5 py-4">
          <h2 className="text-lg font-bold text-tinta-900">Carrinho</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar carrinho"
            className="rounded-lg p-1 text-tinta-500 hover:bg-tinta-100"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <SeletorCarrinho />

          {erro && <div className="mt-3"><Alerta tipo="erro">{erro.message}</Alerta></div>}

          {carrinhoAtivo && !carrinhoAtivo.pronto_para_checkout && temItens && (
            <div className="mt-3">
              <Alerta tipo="aviso" titulo="Alguns itens precisam de ajuste">
                Ajuste ou remova os itens marcados para fechar o pedido.
              </Alerta>
            </div>
          )}

          {temItens && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => executar(limpar)}
                disabled={ocupado}
                className="text-sm text-tinta-500 underline hover:text-red-600 disabled:opacity-50"
              >
                Esvaziar carrinho
              </button>
            </div>
          )}

          {temItens ? (
            <ul className="mt-2 divide-y divide-tinta-200">
              {carrinhoAtivo.itens.map((item) => (
                <LinhaItem
                  key={item.codigo_produto}
                  item={item}
                  ocupado={ocupado}
                  aoAlterar={(codigo, quantidade) => executar(() => alterar(codigo, quantidade))}
                  aoRemover={(codigo) => executar(() => remover(codigo))}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-sm text-tinta-500">
              Este carrinho está vazio. Adicione peças pela vitrine.
            </p>
          )}
        </div>

        {temItens && (
          <footer className="border-t border-tinta-200 px-5 py-4">
            <div className="flex items-center justify-between text-base">
              <span className="font-semibold text-tinta-900">Total</span>
              <span className="font-bold text-tinta-900">{dinheiro.format(carrinhoAtivo.valor_total)}</span>
            </div>
            <Link to="/checkout" onClick={aoFechar} className="mt-4 block">
              <Botao
                tamanho="grande"
                className="w-full"
                disabled={!carrinhoAtivo.pronto_para_checkout || ocupado}
              >
                Fechar pedido
              </Botao>
            </Link>
          </footer>
        )}
      </div>
    </dialog>
  );
}
