import type { Material, Peca, Pedido, ResumoPedido } from './types';

/**
 * Aproveitamento medio esperado numa seccionadora com chapas padrao.
 * Serve apenas para a estimativa exibida ao cliente; o numero real vem da
 * otimizacao feita no Corte MadePinus.
 */
export const APROVEITAMENTO_ESTIMADO = 0.85;

/** Area de uma peca em m2, ja multiplicada pela quantidade. */
export function areaPecaM2(peca: Pick<Peca, 'largura' | 'altura' | 'quantidade'>): number {
  return (peca.largura * peca.altura * peca.quantidade) / 1_000_000;
}

/**
 * Metros lineares de fita de borda da peca.
 * C1/C2 sao as bordas cujo comprimento e a largura da peca; L1/L2 sao as
 * bordas cujo comprimento e a altura da peca.
 */
export function fitaPecaMl(
  peca: Pick<Peca, 'largura' | 'altura' | 'quantidade' | 'fitaC1' | 'fitaC2' | 'fitaL1' | 'fitaL2'>,
): number {
  const bordasLargura = (peca.fitaC1 ? 1 : 0) + (peca.fitaC2 ? 1 : 0);
  const bordasAltura = (peca.fitaL1 ? 1 : 0) + (peca.fitaL2 ? 1 : 0);
  return ((bordasLargura * peca.largura + bordasAltura * peca.altura) * peca.quantidade) / 1000;
}

function chapasEstimadas(areaM2: number, material?: Material): number {
  if (!material) return 0;
  const areaChapa = (material.chapaLargura * material.chapaAltura) / 1_000_000;
  if (areaChapa <= 0) return 0;
  return Math.ceil(areaM2 / (areaChapa * APROVEITAMENTO_ESTIMADO));
}

/** Consolida quantidades, area e fita de um pedido, no total e por material. */
export function calcularResumo(pedido: Pick<Pedido, 'materiais' | 'pecas'>): ResumoPedido {
  const porMaterial = pedido.materiais.map((material) => {
    const pecas = pedido.pecas.filter((p) => p.materialId === material.id);
    const areaM2 = pecas.reduce((total, p) => total + areaPecaM2(p), 0);
    const fitaMl = pecas.reduce((total, p) => total + fitaPecaMl(p), 0);
    return {
      materialId: material.id,
      codigo: material.codigo,
      descricao: material.descricao,
      totalPecas: pecas.reduce((total, p) => total + p.quantidade, 0),
      areaM2: arredondar(areaM2, 3),
      fitaMl: arredondar(fitaMl, 2),
      chapasEstimadas: chapasEstimadas(areaM2, material),
    };
  });

  return {
    totalItens: pedido.pecas.length,
    totalPecas: pedido.pecas.reduce((total, p) => total + p.quantidade, 0),
    areaTotalM2: arredondar(
      porMaterial.reduce((total, m) => total + m.areaM2, 0),
      3,
    ),
    perimetroFitaMl: arredondar(
      porMaterial.reduce((total, m) => total + m.fitaMl, 0),
      2,
    ),
    chapasEstimadas: porMaterial.reduce((total, m) => total + m.chapasEstimadas, 0),
    porMaterial,
  };
}

export function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

export function formatarM2(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function formatarMl(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(valor: string | Date): string {
  const data = typeof valor === 'string' ? new Date(valor) : valor;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
