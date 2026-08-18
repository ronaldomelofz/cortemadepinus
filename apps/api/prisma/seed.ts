import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SERRA_PADRAO_MM, VALOR_CORTE_PADRAO } from '@cortemadepinus/shared';
import { env } from '../src/env';

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

async function main() {
  const admin = await prisma.usuario.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { role: 'ADMIN', ativo: true },
    create: {
      nome: env.ADMIN_NOME,
      email: env.ADMIN_EMAIL,
      senhaHash: await bcrypt.hash(env.ADMIN_SENHA, 12),
      role: 'ADMIN',
    },
  });
  console.log(`[seed] Administrador pronto: ${admin.email}`);

  await prisma.configuracao.upsert({
    where: { id: 'padrao' },
    create: { id: 'padrao', serraMm: SERRA_PADRAO_MM, valorCorte: VALOR_CORTE_PADRAO },
    update: {},
  });

  const totalProdutos = await prisma.produtoMdf.count();
  if (totalProdutos === 0) {
    await prisma.produtoMdf.createMany({
      data: [
        {
          codigo: 99000,
          nome: 'MDF Branco TX 15 mm',
          cor: 'Branco TX',
          espessura: 15,
          largura: 1840,
          comprimento: 2750,
        },
        {
          codigo: 99001,
          nome: 'MDF Branco TX 18 mm',
          cor: 'Branco TX',
          espessura: 18,
          largura: 1840,
          comprimento: 2750,
        },
        {
          codigo: 99002,
          nome: 'MDF Amadeirado 15 mm',
          cor: 'Carvalho Hanover',
          espessura: 15,
          largura: 1840,
          comprimento: 2750,
        },
      ],
    });
    console.log('[seed] Produtos MDF iniciais cadastrados.');
  }

  if (env.isProd) {
    console.log('[seed] Ambiente de produção: dados de exemplo não foram criados.');
    return;
  }

  const cliente = await prisma.usuario.upsert({
    where: { email: 'cliente@exemplo.com.br' },
    update: {},
    create: {
      nome: 'Marcenaria Exemplo',
      email: 'cliente@exemplo.com.br',
      senhaHash: await bcrypt.hash('cliente12345', 12),
      empresa: 'Marcenaria Exemplo LTDA',
      telefone: '(31) 99999-0000',
      documento: '12.345.678/0001-90',
    },
  });

  const jaTemPedido = await prisma.pedido.findFirst({ where: { clienteId: cliente.id } });
  if (jaTemPedido) {
    console.log('[seed] Pedido de exemplo já existe.');
    return;
  }

  const ultimo = await prisma.pedido.aggregate({ _max: { numero: true } });

  const pedido = await prisma.pedido.create({
    data: {
      clienteId: cliente.id,
      numero: (ultimo._max.numero ?? 0) + 1,
      titulo: 'Cozinha Apartamento 302',
      ambiente: 'Cozinha',
      observacoes: 'Retirada na loja.',
      prazoDesejado: '5 dias úteis',
      status: 'ENVIADO',
      enviadoEm: new Date(),
      materiais: {
        create: [
          {
            codigo: 99000,
            descricao: 'MDF Branco TX 15mm',
            espessura: 15,
            cor: 'Branco TX',
            chapaLargura: 2750,
            chapaAltura: 1840,
            fornecidoPeloCliente: false,
            ordem: 0,
          },
          {
            codigo: 99001,
            descricao: 'MDF Amadeirado 18mm',
            espessura: 18,
            cor: 'Carvalho Hanover',
            chapaLargura: 2750,
            chapaAltura: 1840,
            fornecidoPeloCliente: false,
            ordem: 1,
          },
        ],
      },
      historico: {
        create: [
          { status: 'RASCUNHO', nota: 'Pedido criado', autorId: cliente.id },
          { status: 'ENVIADO', nota: 'Plano de corte enviado', autorId: cliente.id },
        ],
      },
    },
    include: { materiais: true },
  });

  const branco = pedido.materiais.find((m) => m.codigo === 99000)!;
  const amadeirado = pedido.materiais.find((m) => m.codigo === 99001)!;

  await prisma.peca.createMany({
    data: [
      {
        pedidoId: pedido.id,
        materialId: branco.id,
        codigo: 1,
        quantidade: 4,
        largura: 700,
        altura: 350,
        descricao: 'Lateral armario superior',
        veio: 'COMPRIMENTO',
        fitaC1: true,
        fitaL1: true,
        ordem: 0,
      },
      {
        pedidoId: pedido.id,
        materialId: branco.id,
        codigo: 2,
        quantidade: 2,
        largura: 1200,
        altura: 350,
        descricao: 'Fundo armario superior',
        fitaC1: true,
        fitaC2: true,
        ordem: 1,
      },
      {
        pedidoId: pedido.id,
        materialId: amadeirado.id,
        codigo: 3,
        quantidade: 6,
        largura: 397,
        altura: 700,
        descricao: 'Porta',
        veio: 'LARGURA',
        fitaC1: true,
        fitaC2: true,
        fitaL1: true,
        fitaL2: true,
        ordem: 2,
      },
      {
        pedidoId: pedido.id,
        materialId: amadeirado.id,
        codigo: 4,
        quantidade: 3,
        largura: 600,
        altura: 150,
        descricao: 'Frente gaveta',
        veio: 'COMPRIMENTO',
        fitaC1: true,
        fitaC2: true,
        fitaL1: true,
        fitaL2: true,
        ordem: 3,
      },
    ],
  });

  console.log(`[seed] Pedido de exemplo #${pedido.numero} criado para ${cliente.email}`);
  console.log('[seed] Acesso cliente: cliente@exemplo.com.br / cliente12345');
}

main()
  .catch((erro) => {
    console.error('[seed] Falhou:', erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
