import assert from 'node:assert/strict';
import { test } from 'node:test';
import { otimizarPlanos } from './otimizacao';

const chapaMdf = { codigo: 99000, descricao: 'MDF Branco', largura: 2750, altura: 1840 };

test('empacota pecas repetidas em uma chapa e respeita o veio', () => {
  const resultado = otimizarPlanos(
    [chapaMdf],
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
  assert.equal(resultado.totalChapas, 1);
  const totalPecas = resultado.chapas.reduce((n, c) => n + c.pecas.length, 0);
  assert.equal(totalPecas, 6);
  assert.ok(resultado.chapas[0].aproveitamento > 0);
  assert.ok(resultado.chapas[0].pecas.every((p) => p.x + p.largura <= 2750 && p.y + p.altura <= 1840));
  assert.ok(
    resultado.chapas[0].pecas
      .filter((p) => p.codigo === 1)
      .every((p) => p.largura === 700 && p.altura === 350 && p.girada === false),
  );
});

test('agrupa pecas no canto e deixa um retalho grande reaproveitavel', () => {
  const resultado = otimizarPlanos(
    [chapaMdf],
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

  const chapa = resultado.chapas[0];
  const maxY = Math.max(...chapa.pecas.map((p) => p.y + p.altura));
  assert.ok(maxY <= 710, `pecas deveriam caber em duas faixas de 350 mm, maxY=${maxY}`);
});

test('gera ordem de cortes guilhotina dentro da chapa', () => {
  const resultado = otimizarPlanos(
    [chapaMdf],
    new Map([
      [
        99000,
        [
          { codigo: 1, descricao: 'Lateral', largura: 700, altura: 350, quantidade: 4 },
          { codigo: 2, descricao: 'Fundo', largura: 1200, altura: 350, quantidade: 2 },
        ],
      ],
    ]),
  );

  const cortes = resultado.chapas[0].cortes;
  assert.ok(cortes.length >= 3);
  cortes.forEach((corte, i) => {
    assert.equal(corte.ordem, i + 1);
    assert.ok(corte.x1 >= -0.01 && corte.x2 <= 2750.01);
    assert.ok(corte.y1 >= -0.01 && corte.y2 <= 1840.01);
    assert.ok(corte.direcao === 'HORIZONTAL' || corte.direcao === 'VERTICAL');
  });
});

test('seccionadora: cortes longos no sentido de entrada, depois os curtos', () => {
  const resultado = otimizarPlanos(
    [chapaMdf],
    new Map([
      [
        99000,
        [{ codigo: 1, descricao: 'Lateral', largura: 660, altura: 350, quantidade: 8 }],
      ],
    ]),
  );

  const chapa = resultado.chapas[0];
  assert.equal(chapa.sentidoEntrada, 'COMPRIMENTO');
  assert.equal(chapa.sentidoEntradaMm, 2750);

  const longos = chapa.cortes.filter((c) => c.fase === 'LONGO');
  const curtos = chapa.cortes.filter((c) => c.fase === 'CURTO');
  assert.ok(longos.length >= 1);
  assert.ok(curtos.length >= 1);

  const ultimaLonga = Math.max(...longos.map((c) => c.ordem));
  const primeiroCurto = Math.min(...curtos.map((c) => c.ordem));
  assert.ok(ultimaLonga < primeiroCurto, 'todos os cortes longos devem vir antes dos curtos');

  assert.ok(longos.every((c) => c.direcao === 'HORIZONTAL'));
  assert.ok(longos.every((c) => Math.abs(c.x2 - c.x1) > 2700));
  assert.ok(curtos.every((c) => c.direcao === 'VERTICAL'));
  assert.ok(curtos.every((c) => Math.abs(c.y2 - c.y1) < 400));
});

test('peca maior que a chapa fica fora do plano', () => {
  const resultado = otimizarPlanos(
    [{ codigo: 1, descricao: 'Chapa', largura: 1000, altura: 500 }],
    new Map([[1, [{ codigo: 9, descricao: 'Gigante', largura: 2000, altura: 800, quantidade: 1 }]]]),
  );
  assert.equal(resultado.chapas.length, 0);
  assert.equal(resultado.naoEncaixadas.length, 1);
});

test('apara as bordas com a espessura da serra e conta esses cortes', () => {
  const serra = 4.4;
  const resultado = otimizarPlanos(
    [chapaMdf],
    new Map([[99000, [{ codigo: 1, descricao: 'Lateral', largura: 350, altura: 1830, quantidade: 7 }]]]),
    { serraMm: serra, apararBordas: true },
  );

  assert.equal(resultado.naoEncaixadas.length, 0);
  assert.equal(resultado.totalChapas, 1);
  const chapa = resultado.chapas[0];
  assert.ok(chapa.pecas.every((p) => p.x >= serra - 0.01 && p.y >= serra - 0.01));
  assert.ok(chapa.pecas.every((p) => p.x + p.largura <= 2750 - serra + 0.01));
  assert.ok(chapa.pecas.every((p) => p.y + p.altura <= 1840 - serra + 0.01));

  const aparar = chapa.cortes.filter((c) => c.fase === 'APARAR');
  assert.ok(aparar.length >= 2, `deveria haver cortes de aparar, veio ${aparar.length}`);
  assert.equal(chapa.cortes[0].fase, 'APARAR');
  assert.ok(resultado.totalCortes >= chapa.cortes.length);
  assert.equal(resultado.serraMm, serra);
});
