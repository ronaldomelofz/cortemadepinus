import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularResumo } from './calc';
import {
  detectarSeparador,
  exportarCsvCorteCerto,
  exportarTxtCorteCerto,
  importarPecas,
  nomeArquivo,
  sanitizarDescricao,
} from './corteCerto';
import type { Material, Peca, Pedido } from './types';

function material(codigo: number, id: string): Material {
  return {
    id,
    pedidoId: 'p1',
    codigo,
    descricao: `Material ${codigo}`,
    espessura: 15,
    cor: null,
    chapaLargura: 2750,
    chapaAltura: 1840,
    fornecidoPeloCliente: false,
    quantidadeChapas: null,
    ordem: 0,
  };
}

function peca(parcial: Partial<Peca> & Pick<Peca, 'codigo' | 'largura' | 'altura' | 'materialId'>): Peca {
  return {
    id: `peca-${parcial.codigo}`,
    pedidoId: 'p1',
    quantidade: 1,
    descricao: 'Peça',
    veio: 'INDIFERENTE',
    fitaL1: false,
    fitaL2: false,
    fitaC1: false,
    fitaC2: false,
    observacao: null,
    ordem: parcial.codigo,
    ...parcial,
  };
}

const pedido: Pick<Pedido, 'materiais' | 'pecas'> = {
  materiais: [material(99000, 'm1'), material(99001, 'm2')],
  pecas: [
    peca({ codigo: 1, materialId: 'm1', quantidade: 4, largura: 700, altura: 350, descricao: 'Lateral' }),
    peca({
      codigo: 2,
      materialId: 'm2',
      quantidade: 6,
      largura: 397,
      altura: 700,
      descricao: 'Porta, com vírgula',
      fitaC1: true,
      fitaL2: true,
      veio: 'LARGURA',
    }),
  ],
};

test('CSV segue o layout de seis campos do Corte Certo', () => {
  const linhas = exportarCsvCorteCerto(pedido).trim().split('\r\n');
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0], '1,4,700,350,99000,Lateral');
  assert.equal(linhas[1].split(',').length, 6, 'a descrição não pode introduzir campos extras');
  assert.equal(linhas[1], '2,6,397,700,99001,Porta com virgula');
});

test('TXT usa TAB e acrescenta o campo livre de observação', () => {
  const linhas = exportarTxtCorteCerto(pedido).trim().split('\r\n');
  const campos = linhas[1].split('\t');
  assert.equal(campos.length, 7);
  assert.equal(campos[6], 'VEIO LARGURA');
});

test('descrições perdem acento e separadores', () => {
  assert.equal(sanitizarDescricao('Tampão superior; direita'), 'Tampao superior direita');
});

test('importação reconhece o CSV oficial', () => {
  const conteudo = [
    '/ arquivo gerado pelo Corte Certo',
    '1,50,214,124,99000,Peca1',
    '2,40,315,121,99000,Peca2',
  ].join('\n');
  const { pecas, erros, separador } = importarPecas(conteudo);
  assert.equal(separador, ',');
  assert.equal(erros.length, 0);
  assert.equal(pecas.length, 2);
  assert.deepEqual(pecas[0], {
    codigo: 1,
    quantidade: 50,
    largura: 214,
    altura: 124,
    materialCodigo: 99000,
    descricao: 'Peca1',
    observacao: undefined,
  });
});

test('importação aceita colagem do Excel com cabeçalho e vírgula decimal', () => {
  const conteudo = [
    'Codigo\tQtd\tLargura\tAltura\tMaterial\tDescricao',
    '1\t2\t1.200,5\t350\t99000\tFundo',
    'x\t\t\t',
  ].join('\n');
  const { pecas, erros } = importarPecas(conteudo);
  assert.equal(pecas.length, 1);
  assert.equal(pecas[0].largura, 1200.5);
  assert.equal(erros.length, 1);
});

test('separador é detectado em arquivos com ponto e vírgula', () => {
  assert.equal(detectarSeparador('1;2;300;400;99000;Peca'), ';');
});

test('resumo calcula área, fita e chapas estimadas', () => {
  const resumo = calcularResumo(pedido);
  assert.equal(resumo.totalPecas, 10);
  // 4 x (0,70 x 0,35) + 6 x (0,397 x 0,70)
  assert.equal(resumo.areaTotalM2, 2.647);
  // Peça 2: 6 x (397 mm de C1 + 700 mm de L2), arredondado para 2 casas
  assert.equal(resumo.perimetroFitaMl, 6.58);
  assert.equal(resumo.porMaterial.length, 2);
});

test('nome do arquivo usa o número do pedido', () => {
  assert.equal(
    nomeArquivo({ numero: 42, titulo: 'Cozinha Apartamento 302' }, 'cortecerto.csv'),
    'PED00042-cozinha-apartamento-302.cortecerto.csv',
  );
});
