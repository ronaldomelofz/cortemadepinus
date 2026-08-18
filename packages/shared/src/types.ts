/**
 * Tipos de dominio compartilhados entre a API e o front-end.
 */

export const ROLES = ['CLIENTE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const STATUS_PEDIDO = [
  'RASCUNHO',
  'ENVIADO',
  'EM_ANALISE',
  'ORCAMENTO_ENVIADO',
  'APROVADO',
  'EM_PRODUCAO',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const STATUS_LABEL: Record<StatusPedido, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  EM_ANALISE: 'Em análise',
  ORCAMENTO_ENVIADO: 'Orçamento enviado',
  APROVADO: 'Aprovado',
  EM_PRODUCAO: 'Em produção',
  PRONTO: 'Pronto para retirada',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

/** Cor de badge (classes utilitarias Tailwind) por status. */
export const STATUS_COR: Record<StatusPedido, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-700 ring-slate-200',
  ENVIADO: 'bg-blue-50 text-blue-700 ring-blue-200',
  EM_ANALISE: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  ORCAMENTO_ENVIADO: 'bg-amber-50 text-amber-800 ring-amber-200',
  APROVADO: 'bg-teal-50 text-teal-700 ring-teal-200',
  EM_PRODUCAO: 'bg-purple-50 text-purple-700 ring-purple-200',
  PRONTO: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ENTREGUE: 'bg-green-100 text-green-800 ring-green-300',
  CANCELADO: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/** O cliente ainda pode alterar peças, materiais e anexos. */
export function pedidoEditavelPeloCliente(status: StatusPedido): boolean {
  return status === 'RASCUNHO';
}

/**
 * Já foi enviado, mas a central ainda não iniciou a análise.
 * O cliente pode voltar o pedido a rascunho para corrigir o plano.
 */
export function pedidoReabivelPeloCliente(status: StatusPedido): boolean {
  return status === 'ENVIADO';
}

/**
 * Sentido do veio da peca. Na seccionadora o veio determina se a peca pode
 * ou nao ser girada 90 graus durante a otimizacao.
 */
export const VEIOS = ['INDIFERENTE', 'COMPRIMENTO', 'LARGURA'] as const;
export type Veio = (typeof VEIOS)[number];

export const VEIO_LABEL: Record<Veio, string> = {
  INDIFERENTE: 'Sem veio (pode girar)',
  COMPRIMENTO: 'Veio no comprimento',
  LARGURA: 'Veio na largura',
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  empresa?: string | null;
  documento?: string | null;
  role: Role;
  ativo: boolean;
  criadoEm: string;
}

export interface Material {
  id: string;
  pedidoId: string;
  codigo: number;
  descricao: string;
  espessura: number;
  cor?: string | null;
  chapaLargura: number;
  chapaAltura: number;
  fornecidoPeloCliente: boolean;
  quantidadeChapas?: number | null;
  ordem: number;
}

export interface Peca {
  id: string;
  pedidoId: string;
  materialId: string;
  codigo: number;
  quantidade: number;
  largura: number;
  altura: number;
  descricao: string;
  veio: Veio;
  fitaL1: boolean;
  fitaL2: boolean;
  fitaC1: boolean;
  fitaC2: boolean;
  observacao?: string | null;
  ordem: number;
}

export interface Anexo {
  id: string;
  pedidoId: string;
  nomeOriginal: string;
  nomeArmazenado: string;
  mimeType: string;
  tamanho: number;
  criadoEm: string;
}

export interface Mensagem {
  id: string;
  pedidoId: string;
  autorId: string;
  autorNome: string;
  autorRole: Role;
  texto: string;
  criadoEm: string;
}

export interface HistoricoStatus {
  id: string;
  pedidoId: string;
  status: StatusPedido;
  nota?: string | null;
  autorNome?: string | null;
  criadoEm: string;
}

export interface Pedido {
  id: string;
  numero: number;
  clienteId: string;
  cliente?: Pick<Usuario, 'id' | 'nome' | 'email' | 'empresa' | 'telefone'>;
  titulo: string;
  ambiente?: string | null;
  observacoes?: string | null;
  prazoDesejado?: string | null;
  status: StatusPedido;
  valorOrcamento?: number | null;
  criadoEm: string;
  atualizadoEm: string;
  enviadoEm?: string | null;
  materiais: Material[];
  pecas: Peca[];
  anexos: Anexo[];
  mensagens?: Mensagem[];
  historico?: HistoricoStatus[];
}

/** Resumo quantitativo de um pedido. */
export interface ResumoPedido {
  totalItens: number;
  totalPecas: number;
  areaTotalM2: number;
  perimetroFitaMl: number;
  chapasEstimadas: number;
  porMaterial: Array<{
    materialId: string;
    codigo: number;
    descricao: string;
    totalPecas: number;
    areaM2: number;
    fitaMl: number;
    chapasEstimadas: number;
  }>;
}

/** Chapa de MDF cadastrada pela central para o cliente escolher no pedido. */
export interface ProdutoMdf {
  id: string;
  codigo: number;
  nome: string;
  cor: string;
  espessura: number;
  /** Lado menor da chapa, em mm (ex.: 1840). Vira a altura no plano de corte. */
  largura: number;
  /** Lado maior da chapa, em mm (ex.: 2750). Vira a largura no plano de corte. */
  comprimento: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/** Parâmetros globais de corte usados no plano e no orçamento. */
export interface ConfiguracaoCorte {
  serraMm: number;
  valorCorte: number;
}
