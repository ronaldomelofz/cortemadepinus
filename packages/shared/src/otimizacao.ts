import type { Veio } from './types';
import { arredondar } from './calc';

/** Largura do disco da seccionadora, em mm. */
export const SERRA_PADRAO_MM = 4.4;

export interface ItemParaOtimizar {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
  quantidade: number;
  veio?: Veio;
}

export interface ChapaParaOtimizar {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
}

export interface PecaNoPlano {
  codigo: number;
  descricao: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  girada: boolean;
}

export interface ChapaDoPlano {
  indice: number;
  materialCodigo: number;
  materialDescricao: string;
  chapaLargura: number;
  chapaAltura: number;
  pecas: PecaNoPlano[];
  areaUsadaMm2: number;
  aproveitamento: number;
}

export interface ResultadoOtimizacao {
  chapas: ChapaDoPlano[];
  naoEncaixadas: Array<{ codigo: number; descricao: string; largura: number; altura: number; motivo: string }>;
  totalChapas: number;
  aproveitamentoMedio: number;
}

interface RetanguloLivre {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Unidade {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
  veio: Veio;
}

function podeGirar(veio: Veio): boolean {
  return veio === 'INDIFERENTE';
}

function expandir(itens: ItemParaOtimizar[]): Unidade[] {
  const unidades: Unidade[] = [];
  for (const item of itens) {
    const qtd = Math.max(0, Math.floor(item.quantidade) || 0);
    for (let i = 0; i < qtd; i += 1) {
      unidades.push({
        codigo: item.codigo,
        descricao: item.descricao,
        largura: item.largura,
        altura: item.altura,
        veio: item.veio ?? 'INDIFERENTE',
      });
    }
  }
  unidades.sort((a, b) => {
    const area = b.largura * b.altura - a.largura * a.altura;
    if (area !== 0) return area;
    return Math.max(b.largura, b.altura) - Math.max(a.largura, a.altura);
  });
  return unidades;
}

function orientacoes(livre: RetanguloLivre, peca: Unidade) {
  const opcoes: Array<{ w: number; h: number; girada: boolean }> = [];
  if (peca.largura <= livre.w && peca.altura <= livre.h) {
    opcoes.push({ w: peca.largura, h: peca.altura, girada: false });
  }
  if (podeGirar(peca.veio) && peca.altura <= livre.w && peca.largura <= livre.h) {
    opcoes.push({ w: peca.altura, h: peca.largura, girada: true });
  }
  opcoes.sort((a, b) => {
    const sobraA = Math.min(livre.w - a.w, livre.h - a.h);
    const sobraB = Math.min(livre.w - b.w, livre.h - b.h);
    return sobraA - sobraB;
  });
  return opcoes;
}

/** Encaixa a peca no retangulo livre com menor desperdicio no lado curto. */
function melhorEncaixe(livres: RetanguloLivre[], peca: Unidade) {
  let melhor: { indice: number; w: number; h: number; girada: boolean; sobra: number } | null = null;
  livres.forEach((livre, indice) => {
    const opcoes = orientacoes(livre, peca);
    if (opcoes.length === 0) return;
    const escolhida = opcoes[0];
    const sobra = Math.min(livre.w - escolhida.w, livre.h - escolhida.h);
    if (!melhor || sobra < melhor.sobra || (sobra === melhor.sobra && livre.w * livre.h < livres[melhor.indice].w * livres[melhor.indice].h)) {
      melhor = { indice, w: escolhida.w, h: escolhida.h, girada: escolhida.girada, sobra };
    }
  });
  return melhor;
}

function dividirGuillotine(livre: RetanguloLivre, w: number, h: number, serra: number): RetanguloLivre[] {
  const direita: RetanguloLivre = {
    x: livre.x + w + serra,
    y: livre.y,
    w: livre.w - w - serra,
    h,
  };
  const abaixo: RetanguloLivre = {
    x: livre.x,
    y: livre.y + h + serra,
    w: livre.w,
    h: livre.h - h - serra,
  };
  return [direita, abaixo].filter((r) => r.w >= 1 && r.h >= 1);
}

function empacotarChapa(unidades: Unidade[], chapa: ChapaParaOtimizar, serra: number): {
  pecas: PecaNoPlano[];
  restantes: Unidade[];
} {
  const livres: RetanguloLivre[] = [{ x: 0, y: 0, w: chapa.largura, h: chapa.altura }];
  const pecas: PecaNoPlano[] = [];
  const restantes: Unidade[] = [];

  for (const unidade of unidades) {
    const encaixe = melhorEncaixe(livres, unidade);
    if (!encaixe) {
      restantes.push(unidade);
      continue;
    }
    const livre = livres.splice(encaixe.indice, 1)[0];
    pecas.push({
      codigo: unidade.codigo,
      descricao: unidade.descricao,
      x: livre.x,
      y: livre.y,
      largura: encaixe.w,
      altura: encaixe.h,
      girada: encaixe.girada,
    });
    livres.push(...dividirGuillotine(livre, encaixe.w, encaixe.h, serra));
    livres.sort((a, b) => a.w * a.h - b.w * b.h);
  }

  return { pecas, restantes };
}

/**
 * Disposicao preliminar das pecas nas chapas, no estilo de corte em seccionadora
 * (guilhotina: a peca e colocada e o retalho se divide em dois retangulos).
 * Serve para o cliente conferir medidas antes de enviar; a otimizacao definitiva
 * continua sendo feita no Corte Certo pela central.
 */
export function otimizarPlanos(
  materiais: ChapaParaOtimizar[],
  pecasPorMaterial: Map<number, ItemParaOtimizar[]>,
  opcoes: { serraMm?: number } = {},
): ResultadoOtimizacao {
  const serra = opcoes.serraMm ?? SERRA_PADRAO_MM;
  const chapas: ChapaDoPlano[] = [];
  const naoEncaixadas: ResultadoOtimizacao['naoEncaixadas'] = [];

  for (const material of materiais) {
    if (material.largura <= 0 || material.altura <= 0) continue;
    let fila = expandir(pecasPorMaterial.get(material.codigo) ?? []);

    fila = fila.filter((unidade) => {
      const cabe =
        (unidade.largura <= material.largura && unidade.altura <= material.altura) ||
        (podeGirar(unidade.veio) && unidade.altura <= material.largura && unidade.largura <= material.altura);
      if (cabe) return true;
      naoEncaixadas.push({
        codigo: unidade.codigo,
        descricao: unidade.descricao,
        largura: unidade.largura,
        altura: unidade.altura,
        motivo: `não cabe na chapa ${material.largura}×${material.altura} mm`,
      });
      return false;
    });

    let indice = 1;
    while (fila.length > 0 && indice <= 200) {
      const { pecas, restantes } = empacotarChapa(fila, material, serra);
      if (pecas.length === 0) {
        restantes.forEach((unidade) =>
          naoEncaixadas.push({
            codigo: unidade.codigo,
            descricao: unidade.descricao,
            largura: unidade.largura,
            altura: unidade.altura,
            motivo: 'não foi possível encaixar nesta chapa',
          }),
        );
        break;
      }
      const areaUsada = pecas.reduce((total, p) => total + p.largura * p.altura, 0);
      const areaChapa = material.largura * material.altura;
      chapas.push({
        indice,
        materialCodigo: material.codigo,
        materialDescricao: material.descricao,
        chapaLargura: material.largura,
        chapaAltura: material.altura,
        pecas,
        areaUsadaMm2: areaUsada,
        aproveitamento: areaChapa > 0 ? arredondar((areaUsada / areaChapa) * 100, 1) : 0,
      });
      fila = restantes;
      indice += 1;
    }
  }

  const aproveitamentoMedio =
    chapas.length === 0
      ? 0
      : arredondar(chapas.reduce((total, c) => total + c.aproveitamento, 0) / chapas.length, 1);

  return { chapas, naoEncaixadas, totalChapas: chapas.length, aproveitamentoMedio };
}
