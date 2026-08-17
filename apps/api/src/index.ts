import { criarApp } from './app';
import { env } from './env';
import { desconectarPrisma } from './prisma';

const app = criarApp();

const servidor = app.listen(env.PORT, () => {
  console.log(`[api] Central de Serviços MadePinus ouvindo em http://localhost:${env.PORT}`);
  console.log(`[api] Origens liberadas: ${env.corsOrigins.join(', ') || '(nenhuma)'}`);
});

async function encerrar(sinal: string) {
  console.log(`[api] Recebido ${sinal}, encerrando...`);
  servidor.close(() => void 0);
  await desconectarPrisma();
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));
