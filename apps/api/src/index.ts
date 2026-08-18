import os from 'node:os';
import { criarApp } from './app';
import { env } from './env';
import { desconectarPrisma, prepararBanco } from './prisma';

function enderecosLan(): string[] {
  const lista: string[] = [];
  for (const grupo of Object.values(os.networkInterfaces())) {
    for (const item of grupo ?? []) {
      if (item.family === 'IPv4' && !item.internal) lista.push(item.address);
    }
  }
  return lista;
}

const app = criarApp();

const servidor = app.listen(env.PORT, env.HOST, () => {
  console.log(`[api] Central de Serviços MadePinus`);
  console.log(`[api] Neste computador: http://localhost:${env.PORT}`);
  for (const ip of enderecosLan()) {
    console.log(`[api] Na rede local:  http://${ip}:${env.PORT}`);
  }
  if (env.PUBLICO_DIR) console.log(`[api] Site: ${env.PUBLICO_DIR}`);
  console.log(`[api] Banco: ${env.DB_PROVIDER}`);
  console.log(`[api] Origens liberadas: ${env.corsOrigins.join(', ') || '(nenhuma)'}`);
});

prepararBanco().catch((erro) => console.error('[api] Falha ao preparar o banco:', erro));

async function encerrar(sinal: string) {
  console.log(`[api] Recebido ${sinal}, encerrando...`);
  servidor.close(() => void 0);
  await desconectarPrisma();
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));
