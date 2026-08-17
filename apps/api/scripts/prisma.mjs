#!/usr/bin/env node
/**
 * Executa a CLI do Prisma apontando para o schema do banco configurado.
 *
 * Assim os comandos ficam iguais em SQLite e PostgreSQL:
 *   npm run prisma:migrate --workspace @cortemadepinus/api
 * O provider vem de DB_PROVIDER no .env (padrao: sqlite).
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizApi = dirname(dirname(fileURLToPath(import.meta.url)));
const provider = (process.env.DB_PROVIDER ?? 'sqlite').trim();

if (!['sqlite', 'postgresql'].includes(provider)) {
  console.error(`DB_PROVIDER inválido: "${provider}". Use sqlite ou postgresql.`);
  process.exit(1);
}

// Regenera o schema antes de qualquer comando: modelos.prisma e a fonte da verdade.
const preparar = spawnSync(process.execPath, [join(raizApi, 'scripts', 'preparar-schema.mjs'), provider], {
  stdio: 'inherit',
  cwd: raizApi,
});
if (preparar.status !== 0) process.exit(preparar.status ?? 1);

// O SQLite dispensa credenciais: se ninguem configurou, usa um arquivo local.
// O caminho vai absoluto para nao depender de onde o schema esta.
if (provider === 'sqlite' && !process.env.DATABASE_URL) {
  mkdirSync(join(raizApi, 'dados'), { recursive: true });
  process.env.DATABASE_URL = `file:${join(raizApi, 'dados', 'cortemadepinus.db').replace(/\\/g, '/')}`;
}
if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL no arquivo apps/api/.env antes de usar o PostgreSQL.');
  process.exit(1);
}

// Chama o CLI do Prisma pelo caminho resolvido: evita depender do npx, que no
// Windows precisa de shell e engole a saida quando algo falha.
const exigir = createRequire(import.meta.url);
let cliPrisma;
try {
  cliPrisma = exigir.resolve('prisma/build/index.js');
} catch {
  console.error('Prisma CLI não encontrado. Rode "npm install" na raiz do projeto.');
  process.exit(1);
}

const schema = join(raizApi, 'prisma', provider, 'schema.prisma');
const resultado = spawnSync(
  process.execPath,
  [cliPrisma, ...process.argv.slice(2), '--schema', schema],
  { stdio: 'inherit', cwd: raizApi, env: process.env },
);

process.exit(resultado.status ?? 1);
