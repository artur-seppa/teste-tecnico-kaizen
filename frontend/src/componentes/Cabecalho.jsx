import { useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contextos/AuthContext.jsx';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { IconeCarrinho, IconeMenu } from './ui.jsx';
import { MenuNavegacao } from './MenuNavegacao.jsx';

function ItemMenu({ para, children }) {
  return (
    <NavLink
      to={para}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-tinta-100 text-tinta-900' : 'text-tinta-600 hover:bg-tinta-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/** Bolinha com o numero de pecas, sobre o icone ou sobre o rotulo. */
function Contador({ quantidade }) {
  if (quantidade <= 0) return null;

  return (
    <span
      className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full
        bg-marca-700 text-[11px] font-bold text-white"
      aria-hidden="true"
    >
      {quantidade > 99 ? '99+' : quantidade}
    </span>
  );
}

/*
 * NOTA DE REVISAO [KZN-5D1E] - reavaliada, alterada pela funcionalidade nova e
 * depois pelo ajuste de celular.
 *
 * O contador do carrinho (KZN-318) continua mostrando pecas, mas a origem mudou:
 * com multiplos carrinhos, le `quantidadePecas` do contexto (resumo do carrinho
 * ativo), nao mais `carrinho.quantidade_pecas`. E o carrinho virou botao que
 * abre o painel, em vez de navegar para /carrinho: icone ate o tablet, rotulo
 * escrito no desktop. Abaixo do `lg` a navegacao sai da barra e vai para o
 * MenuNavegacao. Historico do KZN-318 no RELATORIO.md (secao 2); multiplos
 * carrinhos na secao 4 e o ajuste de largura na secao 3. Coberto por
 * test/Cabecalho.test.jsx.
 */
export function Cabecalho({ onAbrirCarrinho, carrinhoAberto = false }) {
  const { usuario, autenticado, sair } = useAuth();
  const { quantidadePecas } = useCarrinho();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [busca, setBusca] = useState(parametros.get('busca') ?? '');
  const [menuAberto, setMenuAberto] = useState(false);

  function pesquisar(evento) {
    evento.preventDefault();
    const termo = busca.trim();

    // Preserva os filtros que ja estavam aplicados na vitrine, menos a pagina:
    // pesquisar troca o resultado inteiro, entao a posicao antiga dentro dele
    // nao vale mais. Buscar na pagina 5 pedia a pagina 5 do resultado novo, que
    // costuma ter uma so - e a vitrine dizia "Nenhuma peca encontrada".
    const atuais = new URLSearchParams(parametros);
    atuais.delete('pagina');
    if (termo) atuais.set('busca', termo);
    else atuais.delete('busca');

    navegar(`/?${atuais.toString()}`);
  }

  async function encerrarSessao() {
    await sair();
    navegar('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-tinta-200 bg-white/95 backdrop-blur">
      {/* Abaixo do `sm` a busca ocupa uma segunda linha inteira (`basis-full`):
          ela nao cabe ao lado do logo e dos controles, e sem isto a pagina
          ficaria mais larga que a tela. Do `sm` ao `lg` tudo cabe numa linha. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3
        sm:gap-x-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-tinta-900">
          {/* O K e grande e bold, entao 3:1 basta e o quadrado pode levar o
              #00a5ac exato - e onde a marca mais aparece. */}
          <span className="grid size-9 place-items-center rounded-lg bg-marca-500
            text-xl font-bold text-white">K</span>
          {/* No celular fica so o quadrado do K, para os controles caberem na
              mesma linha. `sr-only` e nao `hidden`: o nome da marca sai da tela
              mas continua sendo o nome acessivel do link para a vitrine. */}
          <span className="max-sm:sr-only">
            {/* marca-700, nao 600: a 18px bold isto nao conta como "texto
                grande" no WCAG, entao precisa dos 4.5:1. */}
            Kaizen <span className="text-marca-700">Autopeças</span>
          </span>
        </Link>

        <form
          onSubmit={pesquisar}
          className="min-w-0 flex-1 max-sm:order-last max-sm:basis-full lg:min-w-[380px]"
        >
          <label htmlFor="busca-topo" className="sr-only">
            Buscar peças
          </label>
          <input
            id="busca-topo"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por peça, marca ou veículo..."
            className="w-full rounded-lg border border-tinta-300 bg-tinta-50 px-4 py-2 text-sm
              placeholder:text-tinta-400 focus:border-marca-500 focus:bg-white
              focus:outline-none focus:ring-2 focus:ring-marca-100"
          />
        </form>

        {/* Quem nao entrou ve "Entrar" e "Criar conta" na barra em qualquer
            largura: sao dois itens, cabem ao lado do logo ate em 320px, e e o
            caminho de quem ainda vai virar cliente - esconder atras de um icone
            custaria cadastro. Quem entrou tem quatro itens, que so cabem no
            desktop; abaixo do `lg` eles viram icone de carrinho e menu. */}
        <nav className="ml-auto flex items-center gap-1">
          {autenticado ? (
            <>
              <div className="flex items-center gap-1 lg:hidden">
                <button
                  type="button"
                  onClick={onAbrirCarrinho}
                  aria-label={`Abrir carrinho${quantidadePecas > 0 ? ` (${quantidadePecas} peças)` : ''}`}
                  aria-expanded={carrinhoAberto}
                  aria-haspopup="dialog"
                  className="relative rounded-lg p-2 text-tinta-600 transition-colors hover:bg-tinta-100"
                >
                  <IconeCarrinho />
                  <Contador quantidade={quantidadePecas} />
                </button>

                <button
                  type="button"
                  onClick={() => setMenuAberto(true)}
                  aria-label="Abrir menu"
                  aria-expanded={menuAberto}
                  aria-haspopup="dialog"
                  className="rounded-lg p-2 text-tinta-600 transition-colors hover:bg-tinta-100"
                >
                  <IconeMenu />
                </button>
              </div>

              <div className="hidden items-center gap-1 lg:flex">
                <ItemMenu para="/pedidos">Pedidos</ItemMenu>
                <ItemMenu para="/perfil">Perfil</ItemMenu>

                <button
                  type="button"
                  onClick={onAbrirCarrinho}
                  aria-label={`Abrir carrinho${quantidadePecas > 0 ? ` (${quantidadePecas} peças)` : ''}`}
                  aria-expanded={carrinhoAberto}
                  aria-haspopup="dialog"
                  className="relative rounded-lg px-3 py-2 text-sm font-medium text-tinta-600
                    hover:bg-tinta-100"
                >
                  Carrinho
                  <Contador quantidade={quantidadePecas} />
                </button>

                <button
                  type="button"
                  onClick={encerrarSessao}
                  className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-tinta-500
                    hover:bg-tinta-100"
                  title={usuario?.email}
                >
                  Sair
                </button>
              </div>
            </>
          ) : (
            <>
              <ItemMenu para="/entrar">Entrar</ItemMenu>
              <Link
                to="/cadastro"
                className="rounded-lg bg-marca-700 px-3 py-2 text-sm font-semibold text-white
                  hover:bg-marca-800 sm:px-4"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>

      {autenticado && (
        <MenuNavegacao
          aberto={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          aoSair={encerrarSessao}
        />
      )}
    </header>
  );
}
