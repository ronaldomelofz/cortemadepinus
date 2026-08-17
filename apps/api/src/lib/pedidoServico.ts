import type { Prisma, StatusPedido } from '@prisma/client';
import { pedidoCompletoSchema, type PedidoInput } from '@cortemadepinus/shared';
import { naoEncontrado, proibido, requisicaoInvalida } from './erros';
import { inclusaoPedido, mapearPedido } from './mapear';
import { prisma } from '../prisma';

/** Status em que o cliente ainda pode alterar as pecas do pedido. */
const EDITAVEL_PELO_CLIENTE: StatusPedido[] = ['RASCUNHO'];

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

export async function criarPedido(clienteId: string, entrada: unknown) {
  const dados = validarPedido(entrada);
  const { materiais } = montarFilhos(dados);

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        clienteId,
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
      fitaL1: peca.fitaL1 ?? false,
      fitaL2: peca.fitaL2 ?? false,
      fitaC1: peca.fitaC1 ?? false,
      fitaC2: peca.fitaC2 ?? false,
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

export function garantirEdicaoDoCliente(status: StatusPedido): void {
  if (!EDITAVEL_PELO_CLIENTE.includes(status)) {
    throw requisicaoInvalida(
      'O pedido já foi enviado à central e não pode mais ser alterado. Envie uma mensagem solicitando ajuste.',
    );
  }
}

export function garantirTransicao(atual: StatusPedido, novo: StatusPedido): void {
  if (atual === novo) return;
  if (!TRANSICOES[atual].includes(novo)) {
    throw requisicaoInvalida(`Não é possível mudar de "${atual}" para "${novo}"`);
  }
}
