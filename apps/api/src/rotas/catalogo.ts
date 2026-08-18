import { Router } from 'express';
import { SERRA_PADRAO_MM, VALOR_CORTE_PADRAO } from '@cortemadepinus/shared';
import { exigirAutenticacao } from '../lib/auth';
import { assincrono } from '../lib/erros';
import { mapearConfiguracao, mapearProduto } from '../lib/mapear';
import { prisma } from '../prisma';

export const rotasCatalogo = Router();

rotasCatalogo.use(exigirAutenticacao);

export async function obterConfiguracao() {
  const atual = await prisma.configuracao.findUnique({ where: { id: 'padrao' } });
  if (atual) return mapearConfiguracao(atual);
  const criada = await prisma.configuracao.create({
    data: { id: 'padrao', serraMm: SERRA_PADRAO_MM, valorCorte: VALOR_CORTE_PADRAO },
  });
  return mapearConfiguracao(criada);
}

rotasCatalogo.get(
  '/produtos',
  assincrono(async (_req, res) => {
    const produtos = await prisma.produtoMdf.findMany({
      where: { ativo: true },
      orderBy: [{ espessura: 'asc' }, { nome: 'asc' }, { cor: 'asc' }],
    });
    res.json({ itens: produtos.map(mapearProduto) });
  }),
);

rotasCatalogo.get(
  '/configuracao',
  assincrono(async (_req, res) => {
    res.json({ configuracao: await obterConfiguracao() });
  }),
);
