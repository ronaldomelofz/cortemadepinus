import assert from 'node:assert/strict';
import { test } from 'node:test';
import { otimizarPlanos } from './otimizacao';

test('empacota pecas repetidas em uma chapa e respeita o veio', () => {
  const resultado = otimizarPlanos(
    [{ codigo: 99000, descricao: 'MDF Branco', largura: 2750, altura: 1840 }],
    new Map([
      [
        99000,
        [
          { codigo: 1, descricao: 'Lateral', largura: 700, altura: 350, quantidade: 4, veio: 'COMPRIMENTO' },
          { codigo: 2, descricao: 'Fundo', largura: 1200, altura: 350, quantidade: 2 },
        ],
      ],
    ]),
  );

  assert.equal(resultado.naoEncaixadas.length, 0);
  assert.ok(resultado.totalChapas >= 1);
  const totalPecas = resultado.chapas.reduce((n, c) => n + c.pecas.length, 0);
  assert.equal(totalPecas, 6);
  assert.ok(resultado.chapas[0].aproveitamento > 0);
  assert.ok(resultado.chapas[0].pecas.every((p) => p.x + p.largura <= 2750 && p.y + p.altura <= 1840));
});

test('peca maior que a chapa fica fora do plano', () => {
  const resultado = otimizarPlanos(
    [{ codigo: 1, descricao: 'Chapa', largura: 1000, altura: 500 }],
    new Map([[1, [{ codigo: 9, descricao: 'Gigante', largura: 2000, altura: 800, quantidade: 1 }]]]),
  );
  assert.equal(resultado.chapas.length, 0);
  assert.equal(resultado.naoEncaixadas.length, 1);
});
