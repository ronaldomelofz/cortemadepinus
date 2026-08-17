import {
  areaPecaM2,
  fitaPecaMl,
  APROVEITAMENTO_ESTIMADO,
  arredondar,
  type Pedido,
  type Veio,
} from '@cortemadepinus/shared';

export interface MaterialForm {
  chave: string;
  codigo: string;
  descricao: string;
  espessura: string;
  cor: string;
  chapaLargura: string;
  chapaAltura: string;
  fornecidoPeloCliente: boolean;
  quantidadeChapas: string;
}

export interface PecaForm {
  chave: string;
  codigo: string;
  materialCodigo: string;
  quantidade: string;
  largura: string;
  altura: string;
  descricao: string;
  veio: Veio;
  fitaC1: boolean;
  fitaC2: boolean;
  fitaL1: boolean;
  fitaL2: boolean;
  observacao: string;
}

export interface PedidoForm {
  titulo: string;
  ambiente: string;
  observacoes: string;
  prazoDesejado: string;
  materiais: MaterialForm[];
  pecas: PecaForm[];
}

/** Chapas mais usadas no mercado brasileiro (largura x altura em mm). */
export const CHAPAS_PADRAO = [
  { rotulo: 'MDF 2750 × 1840', largura: 2750, altura: 1840 },
  { rotulo: 'MDF 2750 × 1850', largura: 2750, altura: 1850 },
  { rotulo: 'MDP 2750 × 1850', largura: 2750, altura: 1850 },
  { rotulo: 'Compensado 2440 × 1220', largura: 2440, altura: 1220 },
  { rotulo: 'MDF 3000 × 1250', largura: 3000, altura: 1250 },
  { rotulo: 'MDF 2200 × 1600', largura: 2200, altura: 1600 },
];

export const ESPESSURAS_PADRAO = [3, 6, 9, 12, 15, 18, 20, 25];

let contador = 0;
export const novaChave = () => `${Date.now().toString(36)}-${(contador += 1)}`;

export function materialVazio(codigo: number): MaterialForm {
  return {
    chave: novaChave(),
    codigo: String(codigo),
    descricao: '',
    espessura: '15',
    cor: '',
    chapaLargura: '2750',
    chapaAltura: '1840',
    fornecidoPeloCliente: false,
    quantidadeChapas: '',
  };
}

export function pecaVazia(codigo: number, materialCodigo: string): PecaForm {
  return {
    chave: novaChave(),
    codigo: String(codigo),
    materialCodigo,
    quantidade: '1',
    largura: '',
    altura: '',
    descricao: '',
    veio: 'INDIFERENTE',
    fitaC1: false,
    fitaC2: false,
    fitaL1: false,
    fitaL2: false,
    observacao: '',
  };
}

export function formularioInicial(): PedidoForm {
  const material = materialVazio(99000);
  return {
    titulo: '',
    ambiente: '',
    observacoes: '',
    prazoDesejado: '',
    materiais: [material],
    pecas: [pecaVazia(1, material.codigo)],
  };
}

/** Converte um pedido vindo da API para o estado editavel do formulario. */
export function pedidoParaFormulario(pedido: Pedido): PedidoForm {
  const porId = new Map(pedido.materiais.map((m) => [m.id, m.codigo]));
  return {
    titulo: pedido.titulo,
    ambiente: pedido.ambiente ?? '',
    observacoes: pedido.observacoes ?? '',
    prazoDesejado: pedido.prazoDesejado ?? '',
    materiais: pedido.materiais.map((material) => ({
      chave: material.id,
      codigo: String(material.codigo),
      descricao: material.descricao,
      espessura: String(material.espessura),
      cor: material.cor ?? '',
      chapaLargura: String(material.chapaLargura),
      chapaAltura: String(material.chapaAltura),
      fornecidoPeloCliente: material.fornecidoPeloCliente,
      quantidadeChapas: material.quantidadeChapas ? String(material.quantidadeChapas) : '',
    })),
    pecas: pedido.pecas.map((peca) => ({
      chave: peca.id,
      codigo: String(peca.codigo),
      materialCodigo: String(porId.get(peca.materialId) ?? ''),
      quantidade: String(peca.quantidade),
      largura: String(peca.largura),
      altura: String(peca.altura),
      descricao: peca.descricao,
      veio: peca.veio,
      fitaC1: peca.fitaC1,
      fitaC2: peca.fitaC2,
      fitaL1: peca.fitaL1,
      fitaL2: peca.fitaL2,
      observacao: peca.observacao ?? '',
    })),
  };
}

const numero = (texto: string): number => {
  const limpo = texto.trim().replace(',', '.');
  return limpo === '' ? Number.NaN : Number(limpo);
};

/** Monta o corpo enviado para a API a partir do estado do formulario. */
export function formularioParaPayload(formulario: PedidoForm) {
  return {
    titulo: formulario.titulo.trim(),
    ambiente: formulario.ambiente.trim(),
    observacoes: formulario.observacoes.trim(),
    prazoDesejado: formulario.prazoDesejado.trim(),
    materiais: formulario.materiais.map((material) => ({
      codigo: numero(material.codigo),
      descricao: material.descricao.trim(),
      espessura: numero(material.espessura),
      cor: material.cor.trim(),
      chapaLargura: numero(material.chapaLargura),
      chapaAltura: numero(material.chapaAltura),
      fornecidoPeloCliente: material.fornecidoPeloCliente,
      quantidadeChapas: material.quantidadeChapas ? numero(material.quantidadeChapas) : null,
    })),
    pecas: formulario.pecas.map((peca) => ({
      codigo: numero(peca.codigo),
      materialCodigo: numero(peca.materialCodigo),
      quantidade: numero(peca.quantidade),
      largura: numero(peca.largura),
      altura: numero(peca.altura),
      descricao: peca.descricao.trim(),
      veio: peca.veio,
      fitaC1: peca.fitaC1,
      fitaC2: peca.fitaC2,
      fitaL1: peca.fitaL1,
      fitaL2: peca.fitaL2,
      observacao: peca.observacao.trim(),
    })),
  };
}

export interface ResumoForm {
  totalItens: number;
  totalPecas: number;
  areaTotalM2: number;
  fitaMl: number;
  chapasEstimadas: number;
  porMaterial: Array<{
    codigo: string;
    descricao: string;
    totalPecas: number;
    areaM2: number;
    fitaMl: number;
    chapasEstimadas: number;
  }>;
}

/** Resumo calculado em tempo real enquanto o cliente digita as medidas. */
export function resumirFormulario(formulario: PedidoForm): ResumoForm {
  const porMaterial = formulario.materiais.map((material) => {
    const pecas = formulario.pecas
      .filter((p) => p.materialCodigo === material.codigo)
      .map((p) => ({
        largura: numero(p.largura) || 0,
        altura: numero(p.altura) || 0,
        quantidade: numero(p.quantidade) || 0,
        fitaC1: p.fitaC1,
        fitaC2: p.fitaC2,
        fitaL1: p.fitaL1,
        fitaL2: p.fitaL2,
      }));

    const areaM2 = pecas.reduce((total, p) => total + areaPecaM2(p), 0);
    const fita = pecas.reduce((total, p) => total + fitaPecaMl(p), 0);
    const areaChapa = ((numero(material.chapaLargura) || 0) * (numero(material.chapaAltura) || 0)) / 1_000_000;

    return {
      codigo: material.codigo,
      descricao: material.descricao || `Material ${material.codigo}`,
      totalPecas: pecas.reduce((total, p) => total + p.quantidade, 0),
      areaM2: arredondar(areaM2, 3),
      fitaMl: arredondar(fita, 2),
      chapasEstimadas:
        areaChapa > 0 ? Math.ceil(areaM2 / (areaChapa * APROVEITAMENTO_ESTIMADO)) : 0,
    };
  });

  return {
    totalItens: formulario.pecas.length,
    totalPecas: porMaterial.reduce((total, m) => total + m.totalPecas, 0),
    areaTotalM2: arredondar(
      porMaterial.reduce((total, m) => total + m.areaM2, 0),
      3,
    ),
    fitaMl: arredondar(
      porMaterial.reduce((total, m) => total + m.fitaMl, 0),
      2,
    ),
    chapasEstimadas: porMaterial.reduce((total, m) => total + m.chapasEstimadas, 0),
    porMaterial,
  };
}
