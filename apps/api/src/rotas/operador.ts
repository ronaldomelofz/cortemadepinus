import { Router } from 'express';
import { z } from 'zod';
import {
  calcularResumo,
  mudarStatusSchema,
  STATUS_FILA_OPERADOR,
  STATUS_PEDIDO,
  transicoesOperador,
} from '@cortemadepinus/shared';
import { exigirAutenticacao, exigirOperador } from '../lib/auth';
import { contemTexto } from '../lib/busca';
import { assincrono, naoEncontrado, requisicaoInvalida } from '../lib/erros';
import { inclusaoPedido, mapearPedido } from '../lib/mapear';
import { buscarPedidoAutorizado, garantirTransicaoPorPapel } from '../lib/pedidoServico';
import { prisma } from '../prisma';

export const rotasOperador = Router();

rotasOperador.use(exigirAutenticacao, exigirOperador);

const filtroSchema = z.object({
  status: z.enum(STATUS_PEDIDO).optional(),
  busca: z.string().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

const statusFila = new Set<string>(STATUS_FILA_OPERADOR);

rotasOperador.get(
  '/painel',
  assincrono(async (_req, res) => {
    const porStatus = await prisma.pedido.groupBy({
      by: ['status'],
      where: { status: { in: [...STATUS_FILA_OPERADOR] } },
      _count: { _all: true },
    });

    const contagem = Object.fromEntries(STATUS_FILA_OPERADOR.map((s) => [s, 0])) as Record<
      string,
      number
    >;
    porStatus.forEach((linha) => {
      contagem[linha.status] = linha._count._all;
    });

    res.json({ contagemPorStatus: contagem });
  }),
);

rotasOperador.get(
  '/pedidos',
  assincrono(async (req, res) => {
    const filtro = filtroSchema.parse(req.query);
    const where = {
      status: filtro.status ?? { in: [...STATUS_FILA_OPERADOR] },
      ...(filtro.busca
        ? {
            OR: [
              { titulo: contemTexto(filtro.busca) },
              { ambiente: contemTexto(filtro.busca) },
              { cliente: { nome: contemTexto(filtro.busca) } },
              { cliente: { empresa: contemTexto(filtro.busca) } },
            ],
          }
        : {}),
    };

    const [total, pedidos] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        include: inclusaoPedido,
        orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
    ]);

    res.json({
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      itens: pedidos.map((p) => {
        const pedido = mapearPedido(p);
        return { ...pedido, resumo: calcularResumo(pedido) };
      }),
    });
  }),
);

rotasOperador.patch(
  '/pedidos/:id/status',
  assincrono(async (req, res) => {
    const dados = mudarStatusSchema
      .pick({ status: true, nota: true })
      .parse(req.body);

    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    if (!statusFila.has(registro.status)) {
      throw naoEncontrado('Pedido fora da fila do operador');
    }
    if (transicoesOperador(registro.status as never).length === 0) {
      throw requisicaoInvalida(
        'Este pedido ainda aguarda análise ou aprovação da central administrativa',
      );
    }

    garantirTransicaoPorPapel(registro.status as never, dados.status, req.usuario!.role);

    const atualizado = await prisma.pedido.update({
      where: { id: registro.id },
      data: {
        status: dados.status,
        historico: {
          create: { status: dados.status, nota: dados.nota || null, autorId: req.usuario!.id },
        },
      },
      include: inclusaoPedido,
    });

    const pedido = mapearPedido(atualizado);
    res.json({ pedido, resumo: calcularResumo(pedido) });
  }),
);
