import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/cliente.js';

const CarrinhoContext = createContext(null);

/**
 * Agora sao varios carrinhos por cliente, com um ativo (o principal).
 *
 * - `carrinhos`: resumos (nome, principal, contagens), baratos, sem preco.
 * - `carrinhoAtivo`: o conteudo enriquecido do ativo (com preco/estoque do ERP).
 *
 * O carrinho mora no servidor, nao no localStorage: trocar de navegador ou de
 * celular mantem tudo, e o estoque e sempre conferido contra o ERP na leitura.
 */
export function ProvedorCarrinho({ children }) {
  const [carrinhos, setCarrinhos] = useState([]);
  const [carrinhoAtivo, setCarrinhoAtivo] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const ativoDaLista = (lista) => lista.find((carrinho) => carrinho.principal) ?? null;

  const carregarConteudo = useCallback(async (id) => {
    if (!id) {
      setCarrinhoAtivo(null);
      return;
    }
    try {
      const resposta = await api.carrinhos.ler(id);
      setCarrinhoAtivo(resposta.dados);
    } catch {
      setCarrinhoAtivo(null);
    }
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await api.carrinhos.listar();
      const lista = resposta.dados;
      setCarrinhos(lista);
      await carregarConteudo(ativoDaLista(lista)?.id);
    } catch {
      // 401 de visitante: segue sem carrinhos.
      setCarrinhos([]);
      setCarrinhoAtivo(null);
    } finally {
      setCarregando(false);
    }
  }, [carregarConteudo]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const ativoId = ativoDaLista(carrinhos)?.id ?? null;

  // Apos uma mutacao de item, o backend devolve o ativo enriquecido: usamos ele
  // direto para a resposta ser imediata, e so recarregamos a lista (contagens).
  const aplicarAtivo = useCallback(async (enriquecido) => {
    setCarrinhoAtivo(enriquecido);
    const resposta = await api.carrinhos.listar();
    setCarrinhos(resposta.dados);
  }, []);

  const adicionar = useCallback(async (codigo, quantidade = 1) => {
    const resposta = await api.carrinhos.adicionarItem(codigo, quantidade);
    await aplicarAtivo(resposta.dados);
  }, [aplicarAtivo]);

  const alterar = useCallback(async (codigo, quantidade) => {
    const resposta = await api.carrinhos.alterarItem(ativoId, codigo, quantidade);
    await aplicarAtivo(resposta.dados);
  }, [ativoId, aplicarAtivo]);

  const remover = useCallback(async (codigo) => {
    const resposta = await api.carrinhos.removerItem(ativoId, codigo);
    await aplicarAtivo(resposta.dados);
  }, [ativoId, aplicarAtivo]);

  const limpar = useCallback(async () => {
    const resposta = await api.carrinhos.limpar(ativoId);
    await aplicarAtivo(resposta.dados);
  }, [ativoId, aplicarAtivo]);

  const trocarAtivo = useCallback(async (id) => {
    const resposta = await api.carrinhos.marcarPrincipal(id);
    setCarrinhos(resposta.dados);
    await carregarConteudo(id);
  }, [carregarConteudo]);

  const criarCarrinho = useCallback(async (dados) => {
    await api.carrinhos.criar(dados);
    await recarregar();
  }, [recarregar]);

  const renomear = useCallback(async (id, dados) => {
    await api.carrinhos.editar(id, dados);
    await recarregar();
  }, [recarregar]);

  const excluirCarrinho = useCallback(async (id) => {
    await api.carrinhos.remover(id);
    await recarregar();
  }, [recarregar]);

  // Contador do cabecalho: pecas do ativo, do resumo local (sempre disponivel).
  const quantidadePecas = ativoDaLista(carrinhos)?.quantidade_pecas ?? 0;

  const valor = useMemo(
    () => ({
      carrinhos,
      carrinhoAtivo,
      ativoId,
      quantidadePecas,
      carregando,
      recarregar,
      adicionar,
      alterar,
      remover,
      limpar,
      trocarAtivo,
      criarCarrinho,
      renomear,
      excluirCarrinho,
    }),
    [
      carrinhos, carrinhoAtivo, ativoId, quantidadePecas, carregando, recarregar,
      adicionar, alterar, remover, limpar, trocarAtivo, criarCarrinho, renomear, excluirCarrinho,
    ],
  );

  return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const contexto = useContext(CarrinhoContext);
  if (!contexto) throw new Error('useCarrinho precisa estar dentro de <ProvedorCarrinho>.');
  return contexto;
}
