import { vi } from 'vitest';

/** Stub do `fetch` global, para o teste do api/cliente.js. */
export function stubarFetch(responder) {
  const chamadas = [];

  const stub = vi.fn(async (url, opcoes = {}) => {
    chamadas.push({ url: String(url), metodo: opcoes.method ?? 'GET', opcoes });
    return responder({ url: String(url), opcoes });
  });

  vi.stubGlobal('fetch', stub);

  return { chamadas };
}

export function respostaJson(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  };
}

/** 204: o cliente tem que devolver null sem tentar fazer parse. */
export function respostaVazia() {
  return {
    ok: true,
    status: 204,
    json: async () => {
      throw new Error('204 nao tem corpo');
    },
  };
}
