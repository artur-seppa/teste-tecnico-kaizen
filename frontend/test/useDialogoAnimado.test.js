import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDialogoAnimado } from '../src/hooks/useDialogoAnimado.js';

/**
 * O jsdom 30 nao implementa `show`, `showModal` nem `close` - um <dialog> de
 * verdade aqui nao abre nem fecha. Entao o dialogo e um dublê que registra as
 * chamadas, e o que se verifica e a logica do hook: quando ele abre, quando
 * marca a saida, o que espera antes de fechar e ate quando espera.
 *
 * O comportamento visual (a transicao em si, o `@starting-style`) e do
 * navegador e nao se verifica aqui.
 */
function dialogoFalso() {
  const atributos = new Map();
  return {
    open: false,
    chamadas: [],
    animacoes: [],
    showModal() {
      this.open = true;
      this.chamadas.push('showModal');
    },
    close() {
      this.open = false;
      this.chamadas.push('close');
    },
    setAttribute(nome, valor) {
      atributos.set(nome, valor);
    },
    removeAttribute(nome) {
      atributos.delete(nome);
    },
    hasAttribute(nome) {
      return atributos.has(nome);
    },
    getAnimations() {
      return this.animacoes;
    },
  };
}

/** Animacao cujo alvo e o proprio dialogo, como a de saida e a do ::backdrop. */
function animacaoDoPainel(dialogo) {
  let resolver;
  const finished = new Promise((r) => {
    resolver = r;
  });
  return { effect: { target: dialogo }, finished, terminar: () => resolver() };
}

/** Monta o hook ja com o dublê no lugar do <dialog>. */
function montar(dialogo) {
  const utilitarios = renderHook(({ aberto }) => useDialogoAnimado(aberto), {
    initialProps: { aberto: false },
  });
  utilitarios.result.current.current = dialogo;
  return utilitarios;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useDialogoAnimado', () => {
  it('abre o dialogo quando `aberto` sobe', () => {
    const dialogo = dialogoFalso();
    const { rerender } = montar(dialogo);

    rerender({ aberto: true });

    expect(dialogo.chamadas).toEqual(['showModal']);
    expect(dialogo.open).toBe(true);
  });

  it('sem animacao nenhuma, fecha na hora', () => {
    const dialogo = dialogoFalso();
    const { rerender } = montar(dialogo);
    rerender({ aberto: true });

    rerender({ aberto: false });

    expect(dialogo.chamadas).toEqual(['showModal', 'close']);
  });

  // A regressao que deu origem a este teste: o atributo era retirado junto com
  // o `close()`, o painel recuperava o estilo de aberto e animava de volta para
  // dentro antes de sumir - fechava, reabria e fechava.
  it('mantem `data-fechando` depois de fechar, e so o tira na reabertura', () => {
    const dialogo = dialogoFalso();
    const { rerender } = montar(dialogo);
    rerender({ aberto: true });

    rerender({ aberto: false });
    expect(dialogo.hasAttribute('data-fechando')).toBe(true);

    rerender({ aberto: true });
    expect(dialogo.hasAttribute('data-fechando')).toBe(false);
  });

  it('espera a animacao de saida terminar antes de fechar', async () => {
    const dialogo = dialogoFalso();
    const animacao = animacaoDoPainel(dialogo);
    dialogo.animacoes = [animacao];
    const { rerender } = montar(dialogo);
    rerender({ aberto: true });

    rerender({ aberto: false });
    expect(dialogo.hasAttribute('data-fechando')).toBe(true);
    expect(dialogo.chamadas).toEqual(['showModal']);

    animacao.terminar();
    await vi.waitFor(() => expect(dialogo.chamadas).toContain('close'));
  });

  // Sem teto, uma animacao infinita dentro do painel deixaria o dialogo modal
  // para sempre: fora da tela, com a pagina inerte e o foco preso.
  it('fecha mesmo se a animacao nunca terminar, ao estourar o teto', () => {
    vi.useFakeTimers();
    const dialogo = dialogoFalso();
    dialogo.animacoes = [animacaoDoPainel(dialogo)];
    const { rerender } = montar(dialogo);
    rerender({ aberto: true });

    rerender({ aberto: false });
    expect(dialogo.chamadas).toEqual(['showModal']);

    vi.advanceTimersByTime(600);

    expect(dialogo.chamadas).toEqual(['showModal', 'close']);
  });

  it('ignora animacao de outro elemento dentro do painel', () => {
    const dialogo = dialogoFalso();
    // Um spinner de carregamento, por exemplo: gira para sempre e nao tem nada
    // a dizer sobre o fim da saida do painel.
    dialogo.animacoes = [{ effect: { target: { outro: true } }, finished: new Promise(() => {}) }];
    const { rerender } = montar(dialogo);
    rerender({ aberto: true });

    rerender({ aberto: false });

    expect(dialogo.chamadas).toEqual(['showModal', 'close']);
  });
});
