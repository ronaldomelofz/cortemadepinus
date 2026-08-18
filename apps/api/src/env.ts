import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Raiz do pacote da API, usada para resolver caminhos relativos. */
const raizApi = path.resolve(__dirname, '..');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** 0.0.0.0 libera acesso pela rede local; 127.0.0.1 restringe a este computador. */
  HOST: z.string().default('0.0.0.0'),
  /** Pasta com o site compilado (index.html). Vazio = só API. */
  PUBLICO_DIR: z.string().optional().or(z.literal('')),

  /**
   * SQLite nao exige instalacao nem senha e atende bem uma central de servicos;
   * PostgreSQL entra quando houver banco gerenciado ou varios servidores.
   */
  DB_PROVIDER: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().min(24, 'JWT_SECRET precisa de pelo menos 24 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** Lista separada por virgula com as origens autorizadas (Netlify, localhost...). */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default(path.join(raizApi, 'uploads')),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(20),
  ADMIN_EMAIL: z.string().email().default('admin@madepinus.com.br'),
  ADMIN_SENHA: z.string().min(8).default('MudarEsteAcesso1'),
  ADMIN_NOME: z.string().default('Central de Serviços MadePinus'),
});

const resultado = schema.safeParse(process.env);

if (!resultado.success) {
  const detalhes = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`);
}

const dados = resultado.data;

/**
 * Sem DATABASE_URL o SQLite cai num arquivo dentro de apps/api/dados.
 * O caminho vai absoluto porque o Prisma resolve caminhos relativos a partir
 * do schema, e nao do diretorio de execucao.
 */
function resolverUrlDoBanco(): string {
  if (dados.DATABASE_URL) return dados.DATABASE_URL;
  if (dados.DB_PROVIDER === 'postgresql') {
    throw new Error('Defina DATABASE_URL para usar o PostgreSQL (veja apps/api/.env.example).');
  }
  const pasta = path.join(raizApi, 'dados');
  fs.mkdirSync(pasta, { recursive: true });
  return `file:${path.join(pasta, 'cortemadepinus.db').replace(/\\/g, '/')}`;
}

export const env = {
  ...dados,
  DATABASE_URL: resolverUrlDoBanco(),
  PUBLICO_DIR: resolverPublico(),
  corsOrigins: dados.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: dados.NODE_ENV === 'production',
  ehPostgres: dados.DB_PROVIDER === 'postgresql',
};

function resolverPublico(): string | null {
  const informado = dados.PUBLICO_DIR?.trim();
  if (!informado) return null;
  return path.isAbsolute(informado) ? informado : path.resolve(raizApi, informado);
}

// O Prisma Client le DATABASE_URL do ambiente; garante o valor ja resolvido.
process.env.DATABASE_URL = env.DATABASE_URL;
