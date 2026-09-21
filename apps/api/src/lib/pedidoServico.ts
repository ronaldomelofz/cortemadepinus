import type { Prisma } from '@prisma/client';
import {
  pedidoCompletoSchema,
  pedidoRascunhoSchema,
  pedidoEditavelPeloCliente,
  pedidoReabivelPeloCliente,
  RECURSOS,
  ehCentral,
  ehPapelCliente,
  garantirTransicaoOperador,
  pedidoVisivelOperador,
  type PedidoRascunhoInput,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { env } from '../env';
import { notificarNovoPedidoOperador, notificarPagamentoConfirmadoCliente } from './whatsapp';
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
  EM_PRODUCAO: ['PAUSADO', 'PRONTO', 'CANCELADO'],
  PAUSADO: ['EM_PRODUCAO', 'PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

export function validarPedido(entrada: unknown): PedidoRascunhoInput {
  return pedidoRascunhoSchema.parse(entrada);
}

/** Monta os registros de material e peca a partir da entrada validada. */
function montarFilhos(dados: PedidoRascunhoInput) {
  const materiais = dados.materiais.map((material, ordem) => ({
    codigo: material.codigo,
    descricao: material.descricao,
    espessura: material.espessura,
    cor: material.cor || null,
    chapaLargura: material.chapaLargura,
    chapaAltura: material.chapaAltura,
    fornecidoPeloCliente: material.fornecidoPeloCliente ?? false,
    quantidadeChapas: material.quantidadeChapas ?? null,
    permiteRotacao: material.permiteRotacao ?? true,
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

async function gravarNovoPedido(clienteId: string, dados: PedidoRascunhoInput) {
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
  dados: PedidoRascunhoInput,
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
      descricao: peca.descricao || 'Peça',
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
  if (!ehCentral(usuario.role) && pedido.clienteId !== usuario.id) {
    throw proibido('Este pedido pertence a outro cliente');
  }
  if (usuario.role === 'OPERADOR' && !pedidoVisivelOperador(pedido.status as StatusPedido)) {
    throw proibido('Pedido fora da fila do operador');
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

type RegistroPedido = Awaited<ReturnType<typeof buscarPedidoAutorizado>>;

function registroParaValidacao(registro: RegistroPedido): unknown {
  const porMaterialId = new Map(registro.materiais.map((m) => [m.id, m.codigo]));
  return {
    titulo: registro.titulo,
    ambiente: registro.ambiente ?? '',
    observacoes: registro.observacoes ?? '',
    prazoDesejado: registro.prazoDesejado ?? '',
    materiais: registro.materiais.map((m) => ({
      codigo: m.codigo,
      descricao: m.descricao,
      espessura: m.espessura,
      cor: m.cor ?? '',
      chapaLargura: m.chapaLargura,
      chapaAltura: m.chapaAltura,
      fornecidoPeloCliente: m.fornecidoPeloCliente,
      quantidadeChapas: m.quantidadeChapas,
      permiteRotacao: m.permiteRotacao,
    })),
    pecas: registro.pecas.map((p) => ({
      materialCodigo: porMaterialId.get(p.materialId)!,
      codigo: p.codigo,
      quantidade: p.quantidade,
      largura: p.largura,
      altura: p.altura,
      descricao: p.descricao,
      veio: p.veio,
      fitaL1: p.fitaL1,
      fitaL2: p.fitaL2,
      fitaC1: p.fitaC1,
      fitaC2: p.fitaC2,
      observacao: p.observacao ?? '',
    })),
  };
}

/** Cliente, vendedor ou admin envia o rascunho para análise da central de serviços. */
export async function enviarPedidoCentral(
  pedidoId: string,
  usuario: { id: string; role: string },
) {
  const podeEnviar = ehPapelCliente(usuario.role) || usuario.role === 'ADMIN';
  if (!podeEnviar) {
    throw proibido('Somente cliente, vendedor ou administrador podem enviar o plano');
  }

  const registro = await buscarPedidoAutorizado(pedidoId, usuario);
  if (!ehCentral(usuario.role) && registro.clienteId !== usuario.id) {
    throw proibido('Este pedido pertence a outro cliente');
  }
  if (!pedidoEditavelPeloCliente(registro.status as StatusPedido)) {
    throw requisicaoInvalida('Este pedido já foi enviado');
  }

  const validacao = pedidoCompletoSchema.safeParse(registroParaValidacao(registro));
  if (!validacao.success) {
    throw requisicaoInvalida(
      validacao.error.issues[0]?.message ?? 'Corrija o plano antes de enviar para a central',
    );
  }

  const nota =
    usuario.role === 'ADMIN'
      ? 'Plano de corte enviado pela central de serviços'
      : 'Plano de corte enviado para a central';

  const atualizado = await prisma.pedido.update({
    where: { id: registro.id },
    data: {
      status: 'ENVIADO',
      enviadoEm: new Date(),
      historico: {
        create: {
          status: 'ENVIADO',
          nota,
          autorId: usuario.id,
        },
      },
    },
    include: inclusaoPedido,
  });

  return mapearPedido(atualizado);
}

/** Admin confirma o pagamento e libera o pedido para o operador. */
export async function confirmarPagamentoPedido(
  pedidoId: string,
  admin: { id: string; role: string },
) {
  if (admin.role !== 'ADMIN') {
    throw proibido('Somente o administrador pode confirmar pagamentos');
  }

  const registro = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { ...inclusaoPedido, cliente: true },
  });
  if (!registro) throw naoEncontrado('Pedido');
  if (registro.status !== 'ENVIADO') {
    throw requisicaoInvalida('Só é possível confirmar pagamento de pedidos aguardando confirmação');
  }

  const notaHistorico = 'Pagamento confirmado — pedido liberado para produção';

  const atualizado = await prisma.pedido.update({
    where: { id: registro.id },
    data: {
      status: 'APROVADO',
      pagamentoConfirmadoEm: new Date(),
      pagamentoConfirmadoPorId: admin.id,
      historico: {
        create: {
          status: 'APROVADO',
          nota: notaHistorico,
          autorId: admin.id,
        },
      },
      mensagens: {
        create: {
          autorId: admin.id,
          texto:
            'Pagamento confirmado pela central. Seu pedido foi liberado para produção e o corte será iniciado em breve.',
        },
      },
    },
    include: inclusaoPedido,
  });

  const pedido = mapearPedido(atualizado);

  const operador = await prisma.usuario.findFirst({
    where: { role: 'OPERADOR', ativo: true },
    select: { telefone: true },
  });

  void notificarPagamentoConfirmadoCliente({
    telefone: registro.cliente?.telefone,
    nome: registro.cliente?.nome ?? 'Cliente',
    numeroPedido: registro.numero,
    titulo: registro.titulo,
  });

  void notificarNovoPedidoOperador({
    telefone: env.OPERADOR_TELEFONE || operador?.telefone || undefined,
    numeroPedido: registro.numero,
    titulo: registro.titulo,
    cliente: registro.cliente?.nome ?? 'Cliente',
  });

  return pedido;
}

export function garantirTransicao(atual: string, novo: StatusPedido): void {
  if (atual === novo) return;
  const permitidas = TRANSICOES[atual as StatusPedido] ?? [];
  if (!permitidas.includes(novo)) {
    throw requisicaoInvalida(`Não é possível mudar de "${atual}" para "${novo}"`);
  }
}

export function garantirTransicaoPorPapel(
  atual: StatusPedido,
  novo: StatusPedido,
  role: string,
): void {
  if (role === 'OPERADOR') {
    try {
      garantirTransicaoOperador(atual, novo);
    } catch {
      throw requisicaoInvalida(`Operador não pode mudar de "${atual}" para "${novo}"`);
    }
    return;
  }
  garantirTransicao(atual, novo);
}
