import { NavLink } from 'react-router-dom';
import { useAuth } from '../contextos/AuthContext.jsx';
import { useDialogoAnimado } from '../hooks/useDialogoAnimado.js';

function ItemMenu({ para, aoFechar, children }) {
  return (
    <li>
      <NavLink
        to={para}
        onClick={aoFechar}
        className={({ isActive }) =>
          `block rounded-lg px-3 py-3 text-base font-medium transition-colors ${
            isActive ? 'bg-tinta-100 text-tinta-900' : 'text-tinta-700 hover:bg-tinta-100'
          }`
        }
      >
        {children}
      </NavLink>
    </li>
  );
}

/**
 * Menu do cabecalho abaixo do `lg`, onde os quatro itens da navegacao de quem
 * entrou nao cabem ao lado da busca. Desce do topo como uma folha, sobre a
 * vitrine. So existe para sessao aberta: deslogado sao dois itens, que cabem na
 * barra em qualquer largura e ficam la.
 *
 * E um <dialog> modal pelos mesmos motivos do PainelCarrinho: foco preso,
 * Escape e fundo inerte vem do elemento, nao de codigo nosso. O `onCancel`
 * cancela o fechamento nativo do Escape e devolve a decisao ao pai, para o
 * fechamento passar pela animacao de saida em vez de sumir de uma vez.
 */
export function MenuNavegacao({ aberto, aoFechar, aoSair }) {
  const { usuario } = useAuth();
  const ref = useDialogoAnimado(aberto);

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onCancel={(evento) => {
        evento.preventDefault();
        aoFechar();
      }}
      onClick={(evento) => {
        if (evento.target === ref.current) aoFechar();
      }}
      // A transicao e de `translate`, nao de `transform`: no Tailwind v4 as
      // utilidades `translate-*` escrevem a propriedade `translate`, e pedir
      // `transform` faria o painel pular em vez de deslizar. `display` e
      // `overlay` entram na lista porque o elemento vive no top layer.
      // `overflow-y-auto` e nao `overflow-hidden`: aqui nao ha cabecalho nem
      // rodape fixos a preservar, entao quem rola e a folha inteira. Numa tela
      // baixa (celular deitado) o agente de usuario limita a altura do dialogo,
      // e sem isto os ultimos itens ficariam cortados e inalcancaveis.
      className="m-0 mb-auto max-h-dvh w-full max-w-none overflow-y-auto bg-transparent p-0
        backdrop:bg-black/40
        transition-[translate,opacity,display,overlay] transition-discrete duration-200 ease-out
        starting:open:-translate-y-full starting:open:opacity-0
        data-fechando:-translate-y-full data-fechando:opacity-0
        backdrop:transition-opacity backdrop:duration-200
        starting:backdrop:opacity-0 data-fechando:backdrop:opacity-0
        motion-reduce:transition-none"
    >
      <div className="rounded-b-2xl bg-white px-4 pb-4 pt-3 shadow-xl">
        <div className="flex items-center justify-between">
          {/* O titulo do painel existe para quem navega por cabecalhos; na tela
              o que interessa e de quem e a conta, por isso ele e `sr-only`. */}
          <h2 className="sr-only">Menu</h2>
          <p className="text-sm font-semibold text-tinta-500">{usuario?.nome}</p>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-tinta-500 hover:bg-tinta-100"
          >
            ✕
          </button>
        </div>

        <ul className="mt-2 space-y-1">
          <ItemMenu para="/pedidos" aoFechar={aoFechar}>Pedidos</ItemMenu>
          <ItemMenu para="/perfil" aoFechar={aoFechar}>Perfil</ItemMenu>
          <li>
            <button
              type="button"
              onClick={() => {
                aoFechar();
                aoSair();
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-base font-medium
                text-tinta-500 transition-colors hover:bg-tinta-100"
            >
              Sair
            </button>
          </li>
        </ul>
      </div>
    </dialog>
  );
}
