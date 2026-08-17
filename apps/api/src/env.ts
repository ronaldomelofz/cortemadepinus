import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'Defina DATABASE_URL apontando para o PostgreSQL local'),
  JWT_SECRET: z.string().min(24, 'JWT_SECRET precisa de pelo menos 24 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** Lista separada por virgula com as origens autorizadas (Netlify, localhost...). */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default(path.resolve(process.cwd(), 'uploads')),
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

export const env = {
  ...resultado.data,
  corsOrigins: resultado.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: resultado.data.NODE_ENV === 'production',
};
