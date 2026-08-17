#!/usr/bin/env node
/**
 * Monta prisma/<provider>/schema.prisma juntando o bloco datasource do banco
 * escolhido com os modelos de prisma/modelos.prisma.
 *
 * O provider vem de DB_PROVIDER (sqlite | postgresql) ou do primeiro argumento.
 * Sem argumento algum, gera os dois — util para versionar as migracoes.
 *
 *   node scripts/preparar-schema.mjs            # gera sqlite e postgresql
 *   node scripts/preparar-schema.mjs sqlite     # gera apenas o sqlite
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizApi = dirname(dirname(fileURLToPath(import.meta.url)));
const pastaPrisma = join(raizApi, 'prisma');

export const PROVIDERS = ['sqlite', 'postgresql'];

const cabecalho = (provider) => `// ARQUIVO GERADO — não edite à mão.
// Fonte: prisma/modelos.prisma · Gerador: scripts/preparar-schema.mjs
// Regenere com: npm run prisma:schema --workspace @cortemadepinus/api

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`;

function gerar(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Provider inválido: "${provider}". Use ${PROVIDERS.join(' ou ')}.`);
  }
  const modelos = readFileSync(join(pastaPrisma, 'modelos.prisma'), 'utf8');
  const destino = join(pastaPrisma, provider);
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'schema.prisma'), `${cabecalho(provider)}\n${modelos}`, 'utf8');
  return join('prisma', provider, 'schema.prisma');
}

const alvo = process.argv[2] ?? process.env.DB_PROVIDER;
const providers = alvo ? [alvo] : PROVIDERS;
for (const provider of providers) {
  console.log(`[schema] gerado ${gerar(provider)}`);
}
