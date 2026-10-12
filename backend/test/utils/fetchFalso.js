import { vi } from 'vitest';

/** Stub do `fetch` global, para o teste do erp/cliente.js. */
export function stubarFetch(responder) {
  const chamadas = [];

  const stub = vi.fn(async (url, opcoes = {}) => {
    chamadas.push({ url: String(url), metodo: opcoes.method ?? 'GET', headers: opcoes.headers });
    return responder({ url: new URL(String(url)), opcoes });
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

export function falhaDeRede(nome = 'TypeError') {
  const erro = new Error('fetch failed');
  erro.name = nome;
  return Promise.reject(erro);
}
