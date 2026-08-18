import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { ErroHttp, tratadorDeErros } from './lib/erros';
import { rotasAdmin } from './rotas/admin';
import { rotasAutenticacao } from './rotas/autenticacao';
import { rotasCatalogo } from './rotas/catalogo';
import { rotasPedidos } from './rotas/pedidos';
import { prisma } from './prisma';

function origemDaRedeLocal(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function criarApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.PUBLICO_DIR ? false : undefined,
  }));
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
        if (/^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.(app|dev)$/.test(origin)) {
          return callback(null, true);
        }
        if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) {
          return callback(null, true);
        }
        // Computadores na mesma rede (Vite :5173 ou pacote :4000).
        if (origemDaRedeLocal(origin)) {
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
      res.json({
        ok: true,
        banco: env.DB_PROVIDER,
        conexao: 'ok',
        versao: '1.0.0',
        horario: new Date().toISOString(),
      });
    } catch (erro) {
      res.status(503).json({ ok: false, banco: 'indisponível', detalhes: String(erro) });
    }
  });

  app.use('/api/auth', rotasAutenticacao);
  app.use('/api/pedidos', rotasPedidos);
  app.use('/api/catalogo', rotasCatalogo);
  app.use('/api/admin', rotasAdmin);

  if (env.PUBLICO_DIR && fs.existsSync(env.PUBLICO_DIR)) {
    app.use(express.static(env.PUBLICO_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path === '/saude') return next();
      res.sendFile(path.join(env.PUBLICO_DIR!, 'index.html'), (erro) => {
        if (erro) next(erro);
      });
    });
  }

  app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
  app.use(tratadorDeErros);

  return app;
}
