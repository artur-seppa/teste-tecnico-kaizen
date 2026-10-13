import { describe, expect, it } from 'vitest';
import { ColetorDeErros, lerBooleanoDeCorpo } from '../src/lib/validacao.js';

// Diferente de `lerBooleano` (query string, que tolera e devolve null para
// qualquer coisa), o booleano de corpo distingue ausente de invalido: ausente e
// uma omissao legitima (undefined), invalido e um erro (422). Ver Problema 9 no
// RELATORIO.

describe('lerBooleanoDeCorpo', () => {
  it('devolve undefined quando o campo esta ausente, sem erro', () => {
    const erros = new ColetorDeErros();
    expect(lerBooleanoDeCorpo(undefined, 'principal', erros)).toBeUndefined();
    expect(erros.temErros).toBe(false);
  });

  it('reconhece valores booleanos verdadeiros e falsos', () => {
    const erros = new ColetorDeErros();
    expect(lerBooleanoDeCorpo(true, 'principal', erros)).toBe(true);
    expect(lerBooleanoDeCorpo(false, 'principal', erros)).toBe(false);
    expect(lerBooleanoDeCorpo('true', 'principal', erros)).toBe(true);
    expect(erros.temErros).toBe(false);
  });

  it('acusa erro quando o valor esta presente mas e irreconhecivel', () => {
    const erros = new ColetorDeErros();
    expect(lerBooleanoDeCorpo('yes', 'principal', erros)).toBeUndefined();
    expect(lerBooleanoDeCorpo({}, 'principal', erros)).toBeUndefined();
    expect(erros.temErros).toBe(true);
    expect(erros.itens).toHaveLength(2);
    expect(erros.itens[0].campo).toBe('principal');
  });
});
