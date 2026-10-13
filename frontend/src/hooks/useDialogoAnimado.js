import { useEffect, useRef } from 'react';

/**
 * Teto para a animacao de saida. A maior duracao declarada hoje e 300ms (o
 * painel do carrinho); o dobro cobre atraso de quadro sem ser perceptivel.
 *
 * Existe porque esperar animacao e esperar promessa alheia: se por qualquer
 * motivo ela nao terminar, o dialogo ficaria modal para sempre - fora da tela,
 * com a pagina inerte e o foco preso, sem saida a nao ser recarregar. Estourar
 * o teto fecha sem animacao, que e o mesmo caminho de quem pediu menos
 * movimento.
 */
const TETO_DE_SAIDA_MS = 600;

/**
 * Abre e fecha um <dialog> modal acompanhando a prop `aberto`, com animacao
 * nos dois sentidos.
 *
 * A entrada e CSS puro (`@starting-style`, via variante `starting:` do
 * Tailwind) e funciona sozinha. A saida nao: ela depende de transicao discreta
 * de `display` e da propriedade `overlay`, que o Chrome entrega e o Firefox e o
 * Safari ainda nao - neles o painel sumiria de uma vez. Por isso o fechamento
 * passa por `data-fechando`, que dispara a transicao de saida enquanto o
 * dialogo continua aberto; so quando as animacoes terminam e que `close()` e
 * chamado.
 *
 * Em ambiente sem suporte a <dialog> modal (o jsdom dos testes) os try/catch
 * deixam o conteudo no DOM e o componente segue testavel.
 */
export function useDialogoAnimado(aberto) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return undefined;

    if (aberto) {
      dialogo.removeAttribute('data-fechando');

      // Medida ANTES de abrir: assim que o dialogo vira modal, o `:has` do
      // index.css trava o <html> e a barra de rolagem desaparece - depois disso
      // nao ha mais o que medir. Se outro painel ja tiver travado a pagina, a
      // medida valida e a dele: medir de novo daria zero e a pagina saltaria.
      const raiz = document.documentElement;
      if (getComputedStyle(raiz).overflow !== 'hidden') {
        raiz.style.setProperty('--largura-da-barra', `${window.innerWidth - raiz.clientWidth}px`);
      }

      try {
        if (!dialogo.open) dialogo.showModal();
      } catch {
        /* ambiente sem suporte a <dialog> modal */
      }
      return undefined;
    }

    if (!dialogo.open) return undefined;

    let cancelado = false;
    let relogio = null;

    // `data-fechando` NAO sai aqui: ele e retirado na proxima abertura. Tirar o
    // atributo junto com o `close()` devolve ao elemento o estilo de aberto, e
    // como a transicao discreta de `display` ainda o mantem renderizado, ele
    // animava de volta para dentro antes de sumir - fechava, reabria e fechava.
    function encerrar() {
      if (cancelado) return;
      cancelado = true;
      clearTimeout(relogio);
      try {
        dialogo.close();
      } catch {
        /* ambiente sem suporte a <dialog> modal */
      }
    }

    dialogo.setAttribute('data-fechando', '');

    // So as animacoes do proprio painel: as do ::backdrop entram junto, porque
    // o alvo delas e o mesmo elemento. Qualquer outra coisa animando dentro do
    // painel - um spinner de carregamento, por exemplo - nao tem fim previsto e
    // nao pode decidir quando o dialogo fecha.
    const animacoes =
      typeof dialogo.getAnimations === 'function'
        ? dialogo
            .getAnimations({ subtree: true })
            .filter((animacao) => animacao.effect?.target === dialogo)
        : [];

    if (animacoes.length === 0) {
      encerrar();
    } else {
      relogio = setTimeout(encerrar, TETO_DE_SAIDA_MS);
      Promise.allSettled(animacoes.map((animacao) => animacao.finished)).then(encerrar);
    }

    return () => {
      cancelado = true;
      clearTimeout(relogio);
    };
  }, [aberto]);

  return ref;
}
