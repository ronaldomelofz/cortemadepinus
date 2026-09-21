import type { StatusPedido } from './types';

/** Pedidos visíveis na área do operador (pagamento confirmado / em produção). */
export const STATUS_FILA_OPERADOR: StatusPedido[] = [
  'APROVADO',
  'EM_PRODUCAO',
  'PAUSADO',
  'PRONTO',
];

/** Status em que o operador pode iniciar/pausar/concluir o corte. */
export const STATUS_PRODUCAO_OPERADOR: StatusPedido[] = [
  'APROVADO',
  'EM_PRODUCAO',
  'PAUSADO',
  'PRONTO',
];

/** Transições que o operador pode fazer (corte na seccionadora). */
export const TRANSICOES_OPERADOR: Partial<Record<StatusPedido, StatusPedido[]>> = {
  APROVADO: ['EM_PRODUCAO'],
  EM_PRODUCAO: ['PAUSADO', 'PRONTO'],
  PAUSADO: ['EM_PRODUCAO', 'PRONTO'],
};

/** Rótulos das ações do operador ao mudar o status. */
export const ACAO_OPERADOR: Partial<Record<StatusPedido, string>> = {
  EM_PRODUCAO: 'Iniciar corte',
  PAUSADO: 'Pausar',
  PRONTO: 'Concluir',
};

/** Rótulo amigável do status na visão do operador. */
export const STATUS_OPERADOR_LABEL: Partial<Record<StatusPedido, string>> = {
  ENVIADO: 'Enviado pelo cliente',
  EM_ANALISE: 'Em análise',
  ORCAMENTO_ENVIADO: 'Orçamento enviado',
  APROVADO: 'Aguardando início',
  EM_PRODUCAO: 'Iniciado',
  PAUSADO: 'Pausado',
  PRONTO: 'Concluído',
  ENTREGUE: 'Entregue ao cliente',
};

export function pedidoVisivelOperador(status: StatusPedido): boolean {
  return STATUS_FILA_OPERADOR.includes(status);
}

export function pedidoEmProducaoOperador(status: StatusPedido): boolean {
  return STATUS_PRODUCAO_OPERADOR.includes(status);
}

export function transicoesOperador(status: StatusPedido): StatusPedido[] {
  return TRANSICOES_OPERADOR[status] ?? [];
}

export function labelAcaoOperador(de: StatusPedido, para: StatusPedido): string {
  if (para === 'EM_PRODUCAO' && de === 'PAUSADO') return 'Retomar corte';
  if (para === 'EM_PRODUCAO' && de === 'APROVADO') return 'Iniciar corte';
  if (para === 'PAUSADO') return 'Pausar';
  if (para === 'PRONTO') return 'Concluir';
  return STATUS_OPERADOR_LABEL[para] ?? para;
}

export function garantirTransicaoOperador(atual: StatusPedido, novo: StatusPedido): void {
  if (atual === novo) return;
  const permitidas = transicoesOperador(atual);
  if (!permitidas.includes(novo)) {
    throw new Error(`Operador não pode mudar de "${atual}" para "${novo}"`);
  }
}
