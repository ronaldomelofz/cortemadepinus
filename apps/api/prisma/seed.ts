import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SERRA_PADRAO_MM, VALOR_CORTE_PADRAO } from '@cortemadepinus/shared';
import { env } from '../src/env';

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

async function main() {
  const senhaHash = await bcrypt.hash(env.ADMIN_SENHA, 12);
  const emailAdmin = env.ADMIN_EMAIL.toLowerCase();

  const contaComEmail = await prisma.usuario.findUnique({ where: { email: emailAdmin } });
  const adminAnterior = await prisma.usuario.findFirst({
    where: { role: 'ADMIN', NOT: { email: emailAdmin } },
  });

  const admin = contaComEmail
    ? await prisma.usuario.update({
        where: { email: emailAdmin },
        data: {
          nome: env.ADMIN_NOME,
          senhaHash,
          role: 'ADMIN',
          ativo: true,
        },
      })
    : adminAnterior
      ? await prisma.usuario.update({
          where: { id: adminAnterior.id },
          data: {
            email: emailAdmin,
            nome: env.ADMIN_NOME,
            senhaHash,
            role: 'ADMIN',
            ativo: true,
          },
        })
      : await prisma.usuario.create({
          data: {
            nome: env.ADMIN_NOME,
            email: emailAdmin,
            senhaHash,
            role: 'ADMIN',
          },
        });

  if (adminAnterior && adminAnterior.id !== admin.id) {
    await prisma.usuario.update({
      where: { id: adminAnterior.id },
      data: { role: 'CLIENTE', ativo: false },
    });
    console.log(`[seed] Admin anterior desativado: ${adminAnterior.email}`);
  }

  console.log(`[seed] Administrador pronto: ${admin.email}`);

  const senhaOperador = await bcrypt.hash(env.OPERADOR_SENHA, 12);
  const emailOperador = env.OPERADOR_EMAIL.toLowerCase();
  const operador = await prisma.usuario.upsert({
    where: { email: emailOperador },
    create: {
      nome: env.OPERADOR_NOME,
      email: emailOperador,
      senhaHash: senhaOperador,
      role: 'OPERADOR',
    },
    update: {
      nome: env.OPERADOR_NOME,
      senhaHash: senhaOperador,
      role: 'OPERADOR',
      ativo: true,
    },
  });
  console.log(`[seed] Operador pronto: ${operador.email}`);

  const senhaVendedor = await bcrypt.hash(env.VENDEDOR_SENHA, 12);
  const emailVendedor = env.VENDEDOR_EMAIL.toLowerCase();
  const vendedor = await prisma.usuario.upsert({
    where: { email: emailVendedor },
    create: {
      nome: env.VENDEDOR_NOME,
      email: emailVendedor,
      senhaHash: senhaVendedor,
      role: 'VENDEDOR',
    },
    update: {
      nome: env.VENDEDOR_NOME,
      senhaHash: senhaVendedor,
      role: 'VENDEDOR',
      ativo: true,
    },
  });
  console.log(`[seed] Vendedor pronto: ${vendedor.email}`);

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
          largura: 1850,
          comprimento: 2750,
          valorUnitario: 0,
          permiteRotacao: true,
        },
        {
          codigo: 99001,
          nome: 'MDF Branco TX 18 mm',
          cor: 'Branco TX',
          espessura: 18,
          largura: 1850,
          comprimento: 2750,
          valorUnitario: 0,
          permiteRotacao: true,
        },
        {
          codigo: 99002,
          nome: 'MDF Amadeirado 15 mm',
          cor: 'Carvalho Hanover',
          espessura: 15,
          largura: 1850,
          comprimento: 2750,
          valorUnitario: 0,
          permiteRotacao: false,
        },
      ],
    });
    console.log('[seed] Produtos MDF iniciais cadastrados.');
  } else {
    await prisma.produtoMdf.updateMany({
      where: { nome: { contains: 'Amadeirado' } },
      data: { permiteRotacao: false },
    });
    await prisma.produtoMdf.updateMany({
      where: { largura: 1840 },
      data: { largura: 1850 },
    });
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
            chapaAltura: 1850,
            fornecidoPeloCliente: false,
            ordem: 0,
          },
          {
            codigo: 99001,
            descricao: 'MDF Amadeirado 18mm',
            espessura: 18,
            cor: 'Carvalho Hanover',
            chapaLargura: 2750,
            chapaAltura: 1850,
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
