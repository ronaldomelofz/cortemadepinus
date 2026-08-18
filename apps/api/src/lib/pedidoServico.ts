import type { Prisma } from '@prisma/client';
import {
  pedidoCompletoSchema,
  pedidoEditavelPeloCliente,
  pedidoReabivelPeloCliente,
  RECURSOS,
  type PedidoInput,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { naoEncontrado, proibido, requisicaoInvalida } from './erros';
import { inclusaoPedido, mapearPedido } from './mapear';
import { prisma } from '../prisma';

/** Transicoes permitidas para a central de servicos. */
export const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  RASCUNHO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE: ['ORCAMENTO_ENVIADO', 'APROVADO', 'CANCELADO'],
  ORCAMENTO_ENVIADO: ['APROVADO', 'EM_ANALISE', 'CANCELADO'],
  APROVADO: ['EM_PRODUCAO', 'CANCELADO'],
  EM_PRODUCAO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

export function validarPedido(entrada: unknown): PedidoInput {
  return pedidoCompletoSchema.parse(entrada);
}

/** Monta os registros de material e peca a partir da entrada validada. */
function montarFilhos(dados: PedidoInput) {
  const materiais = dados.materiais.map((material, ordem) => ({
    codigo: material.codigo,
    descricao: material.descricao,
    espessura: material.espessura,
    cor: material.cor || null,
    chapaLargura: material.chapaLargura,
    chapaAltura: material.chapaAltura,
    fornecidoPeloCliente: material.fornecidoPeloCliente ?? false,
    quantidadeChapas: material.quantidadeChapas ?? null,
    ordem,
  }));

  return { materiais };
}

/**
 * O numero sequencial do pedido e gerado pela aplicacao (e nao por uma
 * sequence do banco) para que o mesmo schema sirva a SQLite e PostgreSQL.
 * A coluna e unica, entao uma corrida entre dois cadastros simultaneos falha
 * na gravacao e a tentativa seguinte pega o proximo numero livre.
 */
async function proximoNumero(tx: Prisma.TransactionClient): Promise<number> {
  const maior = await tx.pedido.aggregate({ _max: { numero: true } });
  return (maior._max.numero ?? 0) + 1;
}

function ehColisaoDeNumero(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    (erro as { code?: string }).code === 'P2002' &&
    String((erro as { meta?: { target?: unknown } }).meta?.target ?? '').includes('numero')
  );
}

export async function criarPedido(clienteId: string, entrada: unknown) {
  const dados = validarPedido(entrada);

  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await gravarNovoPedido(clienteId, dados);
    } catch (erro) {
      if (tentativa >= 3 || !ehColisaoDeNumero(erro)) throw erro;
    }
  }
}

async function gravarNovoPedido(clienteId: string, dados: PedidoInput) {
  const { materiais } = montarFilhos(dados);

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        clienteId,
        numero: await proximoNumero(tx),
        titulo: dados.titulo,
        ambiente: dados.ambiente || null,
        observacoes: dados.observacoes || null,
        prazoDesejado: dados.prazoDesejado || null,
        status: 'RASCUNHO',
        materiais: { create: materiais },
        historico: { create: { status: 'RASCUNHO', nota: 'Pedido criado', autorId: clienteId } },
      },
      include: { materiais: true },
    });

    await tx.peca.createMany({ data: montarPecas(criado.id, criado.materiais, dados) });

    return tx.pedido.findUniqueOrThrow({ where: { id: criado.id }, include: inclusaoPedido });
  });

  return mapearPedido(pedido);
}

function montarPecas(
  pedidoId: string,
  materiais: Array<{ id: string; codigo: number }>,
  dados: PedidoInput,
): Prisma.PecaCreateManyInput[] {
  const porCodigo = new Map(materiais.map((m) => [m.codigo, m.id]));
  return dados.pecas.map((peca, ordem) => {
    const materialId = porCodigo.get(peca.materialCodigo);
    if (!materialId) {
      throw requisicaoInvalida(`Material ${peca.materialCodigo} não existe no pedido`);
    }
    return {
      pedidoId,
      materialId,
      codigo: peca.codigo,
      quantidade: peca.quantidade,
      largura: peca.largura,
      altura: peca.altura,
      descricao: peca.descricao,
      veio: peca.veio ?? 'INDIFERENTE',
      fitaL1: RECURSOS.fitaDeBorda ? (peca.fitaL1 ?? false) : false,
      fitaL2: RECURSOS.fitaDeBorda ? (peca.fitaL2 ?? false) : false,
      fitaC1: RECURSOS.fitaDeBorda ? (peca.fitaC1 ?? false) : false,
      fitaC2: RECURSOS.fitaDeBorda ? (peca.fitaC2 ?? false) : false,
      observacao: peca.observacao || null,
      ordem,
    };
  });
}

export async function atualizarPedido(pedidoId: string, entrada: unknown) {
  const dados = validarPedido(entrada);
  const { materiais } = montarFilhos(dados);

  const pedido = await prisma.$transaction(async (tx) => {
    await tx.peca.deleteMany({ where: { pedidoId } });
    await tx.material.deleteMany({ where: { pedidoId } });

    const atualizado = await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        titulo: dados.titulo,
        ambiente: dados.ambiente || null,
        observacoes: dados.observacoes || null,
        prazoDesejado: dados.prazoDesejado || null,
        materiais: { create: materiais },
      },
      include: { materiais: true },
    });

    await tx.peca.createMany({ data: montarPecas(pedidoId, atualizado.materiais, dados) });

    return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: inclusaoPedido });
  });

  return mapearPedido(pedido);
}

/** Busca o pedido garantindo que o cliente so acesse os proprios registros. */
export async function buscarPedidoAutorizado(
  pedidoId: string,
  usuario: { id: string; role: string },
) {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: inclusaoPedido });
  if (!pedido) throw naoEncontrado('Pedido');
  if (usuario.role !== 'ADMIN' && pedido.clienteId !== usuario.id) {
    throw proibido('Este pedido pertence a outro cliente');
  }
  return pedido;
}

// O status e gravado como texto para o schema servir a SQLite e PostgreSQL,
// entao os parametros chegam como string e sao estreitados aqui.
export function garantirEdicaoDoCliente(status: string): void {
  if (!pedidoEditavelPeloCliente(status as StatusPedido)) {
    throw requisicaoInvalida(
      'O pedido já foi enviado à central e não pode mais ser alterado. Reabra o rascunho se a análise ainda não começou, ou envie uma mensagem solicitando ajuste.',
    );
  }
}

/** Volta um pedido Enviado para rascunho, enquanto a central não iniciou a análise. */
export async function reabrirPedido(pedidoId: string, autorId: string) {
  const registro = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!registro) throw naoEncontrado('Pedido');
  if (!pedidoReabivelPeloCliente(registro.status as StatusPedido)) {
    throw requisicaoInvalida(
      'Só é possível reabrir o plano enquanto o status for Enviado. Depois que a central inicia a análise, fale pela conversa do pedido.',
    );
  }

  const atualizado = await prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      status: 'RASCUNHO',
      enviadoEm: null,
      historico: {
        create: {
          status: 'RASCUNHO',
          nota: 'Cliente reabriu o rascunho para ajustar o plano de corte',
          autorId,
        },
      },
    },
    include: inclusaoPedido,
  });

  return mapearPedido(atualizado);
}

export function garantirTransicao(atual: string, novo: StatusPedido): void {
  if (atual === novo) return;
  const permitidas = TRANSICOES[atual as StatusPedido] ?? [];
  if (!permitidas.includes(novo)) {
    throw requisicaoInvalida(`Não é possível mudar de "${atual}" para "${novo}"`);
  }
}
