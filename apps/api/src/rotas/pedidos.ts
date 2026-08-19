import { Router } from 'express';
import { z } from 'zod';
import {
  calcularResumo,
  exportarCsvCorteMadePinus,
  exportarRelatorioProducaoCsv,
  exportarTxtCorteMadePinus,
  mensagemSchema,
  nomeArquivo,
} from '@cortemadepinus/shared';
import { exigirAutenticacao } from '../lib/auth';
import { contemTexto } from '../lib/busca';
import { assincrono, naoEncontrado, proibido, requisicaoInvalida } from '../lib/erros';
import { inclusaoPedido, mapearMensagem, mapearPedido } from '../lib/mapear';
import {
  atualizarPedido,
  buscarPedidoAutorizado,
  criarPedido,
  garantirEdicaoDoCliente,
  reabrirPedido,
} from '../lib/pedidoServico';
import { caminhoDoAnexo, removerArquivo, upload } from '../lib/upload';
import { prisma } from '../prisma';

export const rotasPedidos = Router();

rotasPedidos.use(exigirAutenticacao);

const filtroSchema = z.object({
  status: z.string().optional(),
  busca: z.string().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

rotasPedidos.get(
  '/',
  assincrono(async (req, res) => {
    const filtro = filtroSchema.parse(req.query);
    const where = {
      clienteId: req.usuario!.id,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.busca
        ? { OR: [{ titulo: contemTexto(filtro.busca) }, { ambiente: contemTexto(filtro.busca) }] }
        : {}),
    };

    const [total, pedidos] = await Promise.all([
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({
        where,
        include: inclusaoPedido,
        orderBy: { criadoEm: 'desc' },
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

rotasPedidos.post(
  '/',
  assincrono(async (req, res) => {
    const pedido = await criarPedido(req.usuario!.id, req.body);
    res.status(201).json({ pedido, resumo: calcularResumo(pedido) });
  }),
);

rotasPedidos.get(
  '/:id',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const pedido = mapearPedido(registro);
    res.json({ pedido, resumo: calcularResumo(pedido) });
  }),
);

rotasPedidos.put(
  '/:id',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    if (req.usuario!.role !== 'ADMIN') garantirEdicaoDoCliente(registro.status);
    const pedido = await atualizarPedido(registro.id, req.body);
    res.json({ pedido, resumo: calcularResumo(pedido) });
  }),
);

rotasPedidos.delete(
  '/:id',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    if (req.usuario!.role !== 'ADMIN' && registro.status !== 'RASCUNHO') {
      throw requisicaoInvalida('Somente rascunhos podem ser excluídos');
    }
    registro.anexos.forEach((anexo) => removerArquivo(anexo.nomeArmazenado));
    await prisma.pedido.delete({ where: { id: registro.id } });
    res.status(204).end();
  }),
);

rotasPedidos.post(
  '/:id/enviar',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    if (registro.status !== 'RASCUNHO') throw requisicaoInvalida('Este pedido já foi enviado');
    if (registro.pecas.length === 0) throw requisicaoInvalida('Adicione peças antes de enviar');

    const atualizado = await prisma.pedido.update({
      where: { id: registro.id },
      data: {
        status: 'ENVIADO',
        enviadoEm: new Date(),
        historico: {
          create: {
            status: 'ENVIADO',
            nota: 'Plano de corte enviado para a central de serviços',
            autorId: req.usuario!.id,
          },
        },
      },
      include: inclusaoPedido,
    });

    const pedido = mapearPedido(atualizado);
    res.json({ pedido, resumo: calcularResumo(pedido) });
  }),
);

rotasPedidos.post(
  '/:id/reabrir',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const pedido = await reabrirPedido(registro.id, req.usuario!.id);
    res.json({ pedido, resumo: calcularResumo(pedido) });
  }),
);

rotasPedidos.post(
  '/:id/mensagens',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const dados = mensagemSchema.parse(req.body);
    const mensagem = await prisma.mensagem.create({
      data: { pedidoId: registro.id, autorId: req.usuario!.id, texto: dados.texto },
      include: { autor: true },
    });
    res.status(201).json({ mensagem: mapearMensagem(mensagem) });
  }),
);

/* ---------------------------- Anexos ---------------------------- */

rotasPedidos.post(
  '/:id/anexos',
  upload.array('arquivos', 10),
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const arquivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (arquivos.length === 0) throw requisicaoInvalida('Nenhum arquivo enviado');

    await prisma.anexo.createMany({
      data: arquivos.map((arquivo) => ({
        pedidoId: registro.id,
        nomeOriginal: arquivo.originalname,
        nomeArmazenado: arquivo.filename,
        mimeType: arquivo.mimetype,
        tamanho: arquivo.size,
      })),
    });

    const atualizado = await prisma.pedido.findUniqueOrThrow({
      where: { id: registro.id },
      include: inclusaoPedido,
    });
    res.status(201).json({ pedido: mapearPedido(atualizado) });
  }),
);

rotasPedidos.get(
  '/:id/anexos/:anexoId',
  assincrono(async (req, res) => {
    await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const anexo = await prisma.anexo.findUnique({ where: { id: req.params.anexoId } });
    if (!anexo || anexo.pedidoId !== req.params.id) throw naoEncontrado('Anexo');
    res.download(caminhoDoAnexo(anexo.nomeArmazenado), anexo.nomeOriginal);
  }),
);

rotasPedidos.delete(
  '/:id/anexos/:anexoId',
  assincrono(async (req, res) => {
    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    if (req.usuario!.role !== 'ADMIN' && registro.status !== 'RASCUNHO') {
      throw proibido('Anexos só podem ser removidos enquanto o pedido é rascunho');
    }
    const anexo = await prisma.anexo.findUnique({ where: { id: req.params.anexoId } });
    if (!anexo || anexo.pedidoId !== registro.id) throw naoEncontrado('Anexo');
    removerArquivo(anexo.nomeArmazenado);
    await prisma.anexo.delete({ where: { id: anexo.id } });
    res.status(204).end();
  }),
);

/* -------------------------- Exportacoes -------------------------- */

const FORMATOS = {
  csv: {
    extensao: 'csv',
    tipo: 'text/csv; charset=utf-8',
    gerar: exportarCsvCorteMadePinus,
  },
  txt: {
    extensao: 'txt',
    tipo: 'text/plain; charset=utf-8',
    gerar: exportarTxtCorteMadePinus,
  },
  producao: {
    extensao: 'csv',
    tipo: 'text/csv; charset=utf-8',
    gerar: exportarRelatorioProducaoCsv,
  },
} as const;

rotasPedidos.get(
  '/:id/exportar/:formato',
  assincrono(async (req, res) => {
    const formato = FORMATOS[req.params.formato as keyof typeof FORMATOS];
    if (!formato) throw requisicaoInvalida('Formato deve ser csv, txt ou producao');

    const registro = await buscarPedidoAutorizado(req.params.id, req.usuario!);
    const pedido = mapearPedido(registro);
    const sufixo = req.params.formato === 'producao' ? 'producao' : 'madepinus';
    const nome = nomeArquivo(pedido, `${sufixo}.${formato.extensao}`);

    // BOM para que o Excel em pt-BR reconheca os acentos do relatorio.
    const corpo = req.params.formato === 'producao' ? `\ufeff${formato.gerar(pedido)}` : formato.gerar(pedido);

    res.setHeader('Content-Type', formato.tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send(corpo);
  }),
);
