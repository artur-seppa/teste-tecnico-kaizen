-- =============================================================================
-- 001 - Multiplos carrinhos
--
-- Cada cliente passa a ter varios carrinhos nomeados, um deles marcado como
-- principal (o ativo). `carrinho_itens` deixa de pertencer ao usuario e passa a
-- pertencer a um carrinho.
--
-- Como o SQLite nao altera UNIQUE/FK via ALTER, `carrinho_itens` e reconstruido
-- (tabela nova -> copia -> drop -> rename). Antes da copia, cada usuario que ja
-- tem itens ganha um "Carrinho 1" principal, e os itens sao remapeados para ele:
-- ninguem perde o carrinho atual.
-- =============================================================================

CREATE TABLE carrinhos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  titulo        TEXT    NOT NULL CHECK (length(titulo) <= 60),
  descricao     TEXT             CHECK (descricao IS NULL OR length(descricao) <= 200),
  principal     INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0, 1)),
  criado_em     TEXT    NOT NULL,
  atualizado_em TEXT    NOT NULL
);

CREATE INDEX idx_carrinhos_usuario ON carrinhos (usuario_id);

-- No maximo um principal por usuario, garantido pelo banco (nao so em app).
CREATE UNIQUE INDEX idx_carrinhos_principal
  ON carrinhos (usuario_id) WHERE principal = 1;

-- Backfill: um "Carrinho 1" principal para cada usuario que ja tem itens.
INSERT INTO carrinhos (usuario_id, titulo, principal, criado_em, atualizado_em)
SELECT DISTINCT usuario_id,
       'Carrinho 1',
       1,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM carrinho_itens;

-- Reconstrucao de carrinho_itens com carrinho_id no lugar de usuario_id.
CREATE TABLE carrinho_itens_novo (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  carrinho_id    INTEGER NOT NULL REFERENCES carrinhos (id) ON DELETE CASCADE,
  codigo_produto TEXT    NOT NULL,
  quantidade     INTEGER NOT NULL CHECK (quantidade > 0),
  adicionado_em  TEXT    NOT NULL,
  UNIQUE (carrinho_id, codigo_produto)
);

-- Cada usuario tem exatamente um carrinho neste ponto (o recem-criado), entao o
-- join por usuario_id mapeia cada item para o carrinho certo.
INSERT INTO carrinho_itens_novo (carrinho_id, codigo_produto, quantidade, adicionado_em)
SELECT c.id, ci.codigo_produto, ci.quantidade, ci.adicionado_em
  FROM carrinho_itens ci
  JOIN carrinhos c ON c.usuario_id = ci.usuario_id;

DROP TABLE carrinho_itens;
ALTER TABLE carrinho_itens_novo RENAME TO carrinho_itens;

-- Sem indice declarado para `carrinho_id`: o UNIQUE (carrinho_id,
-- codigo_produto) comeca por essa coluna, entao o indice implicito dele ja
-- atende os filtros por carrinho.
