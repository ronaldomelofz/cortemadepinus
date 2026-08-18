import { Router } from 'express';
import { z } from 'zod';
import {
  adminClienteSchema,
  calcularResumo,
  configuracaoCorteSchema,
  mudarStatusSchema,
  produtoMdfSchema,
  STATUS_PEDIDO,
} from '@cortemadepinus/shared';
import { exigirAdmin, exigirAutenticacao, gerarHash } from '../lib/auth';
import { contemTexto } from '../lib/busca';
import { assincrono, naoEncontrado, requisicaoInvalida } from '../lib/erros';
import { inclusaoPedido, mapearConfiguracao, mapearPedido, mapearProduto, mapearUsuario } from '../lib/mapear';
import { garantirTransicao } from '../lib/pedidoServico';
import { prisma } from '../prisma';
import { obterConfiguracao } from './catalogo';

export const rotasAdmin = Router();

rotasAdmin.use(exigirAutenticacao, exigirAdmin);

const filtroSchema = z.object({
  status: z.enum(STATUS_PEDIDO).optional(),
  clienteId: z.string().optional(),
  busca: z.string().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

rotasAdmin.get(
  '/pedidos',
  assincrono(async (req, res) => {
    const filtro = filtroSchema.parse(req.query);
    const where = {
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
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

rotasAdmin.patch(
  '/pedidos/:id/status',
  assincrono(async (req, res) => {
    const dados = mudarStatusSchema.parse(req.body);
    const atual = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado('Pedido');
    garantirTransicao(atual.status, dados.status);

    const atualizado = await prisma.pedido.update({
      where: { id: atual.id },
      data: {
        status: dados.status,
        ...(dados.valorOrcamento !== undefined ? { valorOrcamento: dados.valorOrcamento } : {}),
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

rotasAdmin.get(
  '/clientes',
  assincrono(async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const clientes = await prisma.usuario.findMany({
      where: {
        role: 'CLIENTE',
        ...(busca
          ? {
              OR: [
                { nome: contemTexto(busca) },
                { email: contemTexto(busca) },
                { empresa: contemTexto(busca) },
              ],
            }
          : {}),
      },
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { pedidos: true } } },
    });

    res.json({
      itens: clientes.map((cliente) => ({
        ...mapearUsuario(cliente),
        totalPedidos: cliente._count.pedidos,
      })),
    });
  }),
);

rotasAdmin.put(
  '/clientes/:id',
  assincrono(async (req, res) => {
    const dados = adminClienteSchema.parse(req.body);
    const atual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!atual || atual.role !== 'CLIENTE') throw naoEncontrado('Cliente');

    if (dados.email !== atual.email) {
      const conflito = await prisma.usuario.findUnique({ where: { email: dados.email } });
      if (conflito) throw requisicaoInvalida('Já existe uma conta com este e-mail');
    }

    const cliente = await prisma.usuario.update({
      where: { id: atual.id },
      data: {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone || null,
        empresa: dados.empresa || null,
        documento: dados.documento || null,
        ...(dados.senha ? { senhaHash: await gerarHash(dados.senha) } : {}),
      },
    });
    res.json({ usuario: mapearUsuario(cliente) });
  }),
);

rotasAdmin.patch(
  '/clientes/:id',
  assincrono(async (req, res) => {
    const dados = z.object({ ativo: z.boolean() }).parse(req.body);
    const atual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!atual || atual.role !== 'CLIENTE') throw naoEncontrado('Cliente');
    const cliente = await prisma.usuario.update({
      where: { id: atual.id },
      data: { ativo: dados.ativo },
    });
    res.json({ usuario: mapearUsuario(cliente) });
  }),
);

rotasAdmin.get(
  '/painel',
  assincrono(async (_req, res) => {
    const [porStatus, totalClientes, pedidosRecentes] = await Promise.all([
      prisma.pedido.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.usuario.count({ where: { role: 'CLIENTE' } }),
      prisma.pedido.findMany({
        where: { status: { notIn: ['RASCUNHO', 'ENTREGUE', 'CANCELADO'] } },
        include: inclusaoPedido,
        orderBy: { enviadoEm: 'desc' },
        take: 8,
      }),
    ]);

    const contagem = Object.fromEntries(STATUS_PEDIDO.map((s) => [s, 0])) as Record<string, number>;
    porStatus.forEach((linha) => {
      contagem[linha.status] = linha._count._all;
    });

    const abertos = pedidosRecentes.map((p) => {
      const pedido = mapearPedido(p);
      return { ...pedido, resumo: calcularResumo(pedido) };
    });

    res.json({
      contagemPorStatus: contagem,
      totalClientes,
      totalPedidos: Object.values(contagem).reduce((a, b) => a + b, 0),
      areaEmAberto: abertos.reduce((total, p) => total + p.resumo.areaTotalM2, 0),
      pedidosRecentes: abertos,
    });
  }),
);

rotasAdmin.get(
  '/configuracao',
  assincrono(async (_req, res) => {
    res.json({ configuracao: await obterConfiguracao() });
  }),
);

rotasAdmin.put(
  '/configuracao',
  assincrono(async (req, res) => {
    const dados = configuracaoCorteSchema.parse(req.body);
    const atualizada = await prisma.configuracao.upsert({
      where: { id: 'padrao' },
      create: { id: 'padrao', serraMm: dados.serraMm, valorCorte: dados.valorCorte },
      update: { serraMm: dados.serraMm, valorCorte: dados.valorCorte },
    });
    res.json({ configuracao: mapearConfiguracao(atualizada) });
  }),
);

rotasAdmin.get(
  '/produtos',
  assincrono(async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const produtos = await prisma.produtoMdf.findMany({
      where: busca
        ? {
            OR: [
              { nome: contemTexto(busca) },
              { cor: contemTexto(busca) },
            ],
          }
        : undefined,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }, { espessura: 'asc' }],
    });
    res.json({ itens: produtos.map(mapearProduto) });
  }),
);

rotasAdmin.post(
  '/produtos',
  assincrono(async (req, res) => {
    const dados = produtoMdfSchema.parse(req.body);
    const codigo = dados.codigo ?? (await proximoCodigoProduto());
    const existente = await prisma.produtoMdf.findUnique({ where: { codigo } });
    if (existente) throw requisicaoInvalida(`Já existe um MDF com o código ${codigo}`);

    const produto = await prisma.produtoMdf.create({
      data: {
        codigo,
        nome: dados.nome,
        cor: dados.cor,
        espessura: dados.espessura,
        largura: dados.largura,
        comprimento: dados.comprimento,
        ativo: dados.ativo ?? true,
      },
    });
    res.status(201).json({ produto: mapearProduto(produto) });
  }),
);

rotasAdmin.put(
  '/produtos/:id',
  assincrono(async (req, res) => {
    const dados = produtoMdfSchema.parse(req.body);
    const atual = await prisma.produtoMdf.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado('Produto');

    const codigo = dados.codigo ?? atual.codigo;
    if (codigo !== atual.codigo) {
      const conflito = await prisma.produtoMdf.findUnique({ where: { codigo } });
      if (conflito) throw requisicaoInvalida(`Já existe um MDF com o código ${codigo}`);
    }

    const produto = await prisma.produtoMdf.update({
      where: { id: atual.id },
      data: {
        codigo,
        nome: dados.nome,
        cor: dados.cor,
        espessura: dados.espessura,
        largura: dados.largura,
        comprimento: dados.comprimento,
        ativo: dados.ativo ?? atual.ativo,
      },
    });
    res.json({ produto: mapearProduto(produto) });
  }),
);

rotasAdmin.patch(
  '/produtos/:id',
  assincrono(async (req, res) => {
    const dados = z.object({ ativo: z.boolean() }).parse(req.body);
    const atual = await prisma.produtoMdf.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado('Produto');
    const produto = await prisma.produtoMdf.update({
      where: { id: atual.id },
      data: { ativo: dados.ativo },
    });
    res.json({ produto: mapearProduto(produto) });
  }),
);

rotasAdmin.delete(
  '/produtos/:id',
  assincrono(async (req, res) => {
    const atual = await prisma.produtoMdf.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado('Produto');
    await prisma.produtoMdf.delete({ where: { id: atual.id } });
    res.status(204).end();
  }),
);

async function proximoCodigoProduto(): Promise<number> {
  const ultimo = await prisma.produtoMdf.aggregate({ _max: { codigo: true } });
  const base = ultimo._max.codigo ?? 98999;
  return Math.max(99000, base + 1);
}
