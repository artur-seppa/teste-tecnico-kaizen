import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizProjeto = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/*
 * NOTA DE REVISAO [KZN-2B9C] - reavaliada, trecho reescrito.
 *
 * O historico esta no RELATORIO.md (secao 3, Problema 1). Em uma linha: os
 * valores padrao de JWT_SEGREDO, ERP_URL e ERP_TOKEN tornavam validarConfig()
 * inalcancavel, porque eram aplicados antes da checagem.
 *
 * A regra que vale daqui para frente:
 *
 *   Segredo e endereco do ERP vem do .env, sempre. Nao tem valor padrao,
 *   e sem eles o processo nao sobe.
 */

// Padroes apenas para o que nao e segredo. Permitem subir com um .env minimo.
const PADRAO = {
  porta: 3001,
  host: '0.0.0.0',
  ambiente: 'development',
  caminhoBanco: './data/ecommerce.db',
  jwtExpiracao: '7d',
  erpTimeoutMs: 8000,
  corsOrigem: 'http://localhost:5173',
};

const AMBIENTES = ['development', 'test', 'production'];

const JWT_SEGREDO_DE_EXEMPLO = 'troque-por-um-segredo-aleatorio';

function texto(bruto) {
  return bruto?.trim() || '';
}

function resolverCaminho(bruto, padrao) {
  const valor = texto(bruto) || padrao;
  return path.isAbsolute(valor) ? valor : path.resolve(raizProjeto, valor);
}

// Variavel ausente cai no padrao; variavel presente e invalida vira NaN de
// proposito, para validarConfig() acusar em vez de o servidor subir numa porta
// aleatoria ou com timeout quebrado.
function inteiro(bruto, padrao) {
  const valor = texto(bruto);
  return valor === '' ? padrao : Number(valor);
}

export const config = {
  raizProjeto,
  porta: inteiro(process.env.PORT, PADRAO.porta),
  host: texto(process.env.HOST) || PADRAO.host,
  ambiente: texto(process.env.NODE_ENV) || PADRAO.ambiente,

  caminhoBanco: resolverCaminho(process.env.DB_PATH, PADRAO.caminhoBanco),

  jwt: {
    segredo: texto(process.env.JWT_SEGREDO),
    expiracao: texto(process.env.JWT_EXPIRACAO) || PADRAO.jwtExpiracao,
    nomeCookie: 'kaizen_sessao',
  },

  erp: {
    url: texto(process.env.ERP_URL).replace(/\/+$/, ''),
    token: texto(process.env.ERP_TOKEN),
    timeoutMs: inteiro(process.env.ERP_TIMEOUT_MS, PADRAO.erpTimeoutMs),
  },

  corsOrigem: texto(process.env.CORS_ORIGEM) || PADRAO.corsOrigem,

  paginacao: { tamanhoPadrao: 24, tamanhoMaximo: 100 },
};

export const emProducao = config.ambiente === 'production';

/**
 * Acumula TODOS os problemas de configuracao antes de lancar, no mesmo espirito
 * do ColetorDeErros das rotas: quem subiu com tres variaveis erradas descobre
 * as tres de uma vez, nao uma por restart.
 */
export function validarConfig() {
  const problemas = [];

  if (!config.jwt.segredo) {
    problemas.push('JWT_SEGREDO nao definido. Rode: npm run segredo:gerar');
  } else if (config.jwt.segredo === JWT_SEGREDO_DE_EXEMPLO) {
    problemas.push('JWT_SEGREDO ainda esta com o valor de exemplo. Rode: npm run segredo:gerar');
  } else if (config.jwt.segredo.length < 32) {
    problemas.push('JWT_SEGREDO muito curto (minimo 32 caracteres).');
  }

  if (!config.erp.token) {
    problemas.push('ERP_TOKEN nao definido. Use o API_TOKEN do kaizen-erp.');
  }

  if (!config.erp.url) {
    problemas.push('ERP_URL nao definida. E a base da API do ERP, ex: https://host-do-erp');
  } else if (!/^https?:\/\//.test(config.erp.url)) {
    problemas.push(`ERP_URL invalida (precisa comecar com http:// ou https://): ${config.erp.url}`);
  }

  if (!Number.isInteger(config.porta) || config.porta < 1 || config.porta > 65535) {
    problemas.push(`PORT invalida: ${process.env.PORT}`);
  }

  if (!Number.isInteger(config.erp.timeoutMs) || config.erp.timeoutMs < 1) {
    problemas.push(`ERP_TIMEOUT_MS invalido: ${process.env.ERP_TIMEOUT_MS}`);
  }

  // NODE_ENV errado nao da erro em lugar nenhum: so faz emProducao virar false
  // e o cookie de sessao perder o atributo secure em producao.
  if (!AMBIENTES.includes(config.ambiente)) {
    problemas.push(`NODE_ENV invalido: "${config.ambiente}". Use um de: ${AMBIENTES.join(', ')}.`);
  }

  if (problemas.length > 0) {
    throw new Error(`Configuracao invalida:\n  - ${problemas.join('\n  - ')}`);
  }
}
