import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { ErroHttp, tratadorDeErros } from './lib/erros';
import { rotasAdmin } from './rotas/admin';
import { rotasAutenticacao } from './rotas/autenticacao';
import { rotasPedidos } from './rotas/pedidos';
import { prisma } from './prisma';

export function criarApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!env.isProd) app.use(morgan('dev'));

  app.use(
    cors({
      origin(origin, callback) {
        // Requisicoes sem Origin (curl, health check do tunel) sao liberadas.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Libera qualquer deploy preview do projeto no Netlify.
        if (/^https:\/\/[a-z0-9-]+--cortemadepinus\.netlify\.app$/.test(origin)) {
          return callback(null, true);
        }
        callback(new ErroHttp(403, `Origem ${origin} não autorizada`));
      },
      credentials: false,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/saude', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, banco: 'conectado', versao: '1.0.0', horario: new Date().toISOString() });
    } catch (erro) {
      res.status(503).json({ ok: false, banco: 'indisponível', detalhes: String(erro) });
    }
  });

  app.use('/api/auth', rotasAutenticacao);
  app.use('/api/pedidos', rotasPedidos);
  app.use('/api/admin', rotasAdmin);

  app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
  app.use(tratadorDeErros);

  return app;
}
