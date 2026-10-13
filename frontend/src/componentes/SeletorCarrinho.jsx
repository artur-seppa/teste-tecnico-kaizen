import { useState } from 'react';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { Alerta, Botao, EstadoVazio } from './ui.jsx';

/**
 * Troca entre carrinhos nomeados, cria, renomeia e exclui. O carrinho ativo e o
 * principal; clicar em outro o marca principal (= "trocar para ele").
 */
export function SeletorCarrinho() {
  const { carrinhos, ativoId, trocarAtivo, criarCarrinho, renomear, excluirCarrinho } = useCarrinho();
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [renomeando, setRenomeando] = useState(null);
  const [erro, setErro] = useState(null);

  async function executar(acao) {
    setErro(null);
    try {
      await acao();
    } catch (falha) {
      setErro(falha);
    }
  }

  async function salvarNovo(evento) {
    evento.preventDefault();
    const nome = titulo.trim();
    if (!nome) return;
    await executar(() => criarCarrinho({ titulo: nome }));
    setTitulo('');
    setCriando(false);
  }

  async function salvarRenome(evento, id) {
    evento.preventDefault();
    const nome = renomeando?.titulo.trim();
    if (!nome) return;
    await executar(() => renomear(id, { titulo: nome }));
    setRenomeando(null);
  }

  const formularioCriar = (
    <form onSubmit={salvarNovo} className="flex gap-2">
      <input
        aria-label="Nome do novo carrinho"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={60}
        autoFocus
        placeholder="Ex.: Gol do João"
        className="flex-1 rounded-lg border border-tinta-300 px-3 py-1.5 text-sm
          focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-100"
      />
      <Botao tamanho="pequeno" type="submit">Criar</Botao>
    </form>
  );

  if (carrinhos.length === 0) {
    return (
      <div className="space-y-3">
        {erro && <Alerta tipo="erro">{erro.message}</Alerta>}
        {criando ? formularioCriar : (
          <EstadoVazio
            titulo="Nenhum carrinho ainda"
            descricao="Crie um carrinho para começar a montar o pedido."
            acao={<Botao onClick={() => setCriando(true)}>Criar carrinho</Botao>}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {erro && <Alerta tipo="erro">{erro.message}</Alerta>}

      <ul className="space-y-1">
        {carrinhos.map((carrinho) => (
          <li key={carrinho.id}>
            {renomeando?.id === carrinho.id ? (
              <form onSubmit={(e) => salvarRenome(e, carrinho.id)} className="flex gap-2">
                <input
                  aria-label={`Renomear ${carrinho.titulo}`}
                  value={renomeando.titulo}
                  onChange={(e) => setRenomeando({ id: carrinho.id, titulo: e.target.value })}
                  maxLength={60}
                  autoFocus
                  className="flex-1 rounded-lg border border-tinta-300 px-3 py-1.5 text-sm
                    focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-100"
                />
                <Botao tamanho="pequeno" type="submit">Salvar</Botao>
              </form>
            ) : (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  carrinho.id === ativoId
                    ? 'border-marca-500 bg-marca-50'
                    : 'border-tinta-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => executar(() => trocarAtivo(carrinho.id))}
                  aria-pressed={carrinho.id === ativoId}
                  className="flex-1 text-left"
                >
                  <span className="text-sm font-semibold text-tinta-900">
                    {carrinho.id === ativoId && <span aria-hidden="true">★ </span>}
                    {carrinho.titulo}
                  </span>
                  <span className="ml-2 text-xs text-tinta-500">
                    {carrinho.quantidade_pecas} {carrinho.quantidade_pecas === 1 ? 'peça' : 'peças'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRenomeando({ id: carrinho.id, titulo: carrinho.titulo })}
                  className="text-xs text-tinta-500 underline hover:text-marca-700"
                >
                  Renomear
                </button>
                <button
                  type="button"
                  onClick={() => executar(() => excluirCarrinho(carrinho.id))}
                  className="text-xs text-tinta-500 underline hover:text-red-600"
                >
                  Excluir
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {criando ? formularioCriar : (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="text-sm text-marca-700 underline hover:text-marca-800"
        >
          + Novo carrinho
        </button>
      )}
    </div>
  );
}
