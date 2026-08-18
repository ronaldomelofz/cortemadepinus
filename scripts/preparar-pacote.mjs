#!/usr/bin/env node
/**
 * Gera a pasta pacote-madepinus/ pronta para copiar a outro computador.
 * Dê dois cliques em Pagina-inicial.bat para abrir o sistema.
 *
 *   npm run pacote
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const destino = join(raiz, 'pacote-madepinus');
const sistema = join(destino, 'sistema');

function rodar(comando, args, opcoes = {}) {
  console.log(`\n> ${comando} ${args.join(' ')}`);
  const resultado = spawnSync(comando, args, {
    cwd: raiz,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...opcoes.env },
    ...opcoes,
  });
  if (resultado.status !== 0) {
    throw new Error(`Falhou: ${comando} ${args.join(' ')}`);
  }
}

function copiarSeExiste(origem, destinoArquivo) {
  if (!existsSync(origem)) return false;
  cpSync(origem, destinoArquivo, { recursive: true });
  return true;
}

console.log('==> Limpando pasta pacote-madepinus');
rmSync(destino, { recursive: true, force: true });
mkdirSync(sistema, { recursive: true });

console.log('==> Compilando API e regras de negócio');
rodar('npm', ['run', 'build:api']);

console.log('==> Compilando o site (mesma origem da API)');
rodar('npm', ['run', 'build', '--workspace', '@cortemadepinus/web'], {
  env: { VITE_API_URL: '' },
});

console.log('==> Copiando o servidor');
cpSync(join(raiz, 'apps/api/dist'), join(sistema, 'dist'), { recursive: true });
cpSync(join(raiz, 'apps/api/prisma'), join(sistema, 'prisma'), { recursive: true });
mkdirSync(join(sistema, 'publico'), { recursive: true });
cpSync(join(raiz, 'apps/web/dist'), join(sistema, 'publico'), { recursive: true });
mkdirSync(join(sistema, 'dados'), { recursive: true });
mkdirSync(join(sistema, 'uploads'), { recursive: true });

const banco = join(raiz, 'apps/api/dados/cortemadepinus.db');
if (copiarSeExiste(banco, join(sistema, 'dados/cortemadepinus.db'))) {
  copiarSeExiste(`${banco}-wal`, join(sistema, 'dados/cortemadepinus.db-wal'));
  copiarSeExiste(`${banco}-shm`, join(sistema, 'dados/cortemadepinus.db-shm'));
  console.log('==> Banco SQLite copiado (produtos e cadastros atuais)');
}

writeFileSync(
  join(sistema, 'package.json'),
  `${JSON.stringify(
    {
      name: 'madepinus-pacote',
      private: true,
      version: '1.0.0',
      type: 'commonjs',
      dependencies: {
        '@prisma/client': '^6.1.0',
        bcryptjs: '^2.4.3',
        compression: '^1.7.5',
        cors: '^2.8.5',
        dotenv: '^16.4.7',
        express: '^4.21.2',
        'express-rate-limit': '^7.5.0',
        helmet: '^8.0.0',
        jsonwebtoken: '^9.0.2',
        morgan: '^1.10.0',
        multer: '^2.0.1',
        prisma: '^6.1.0',
        zod: '^3.23.8',
      },
    },
    null,
    2,
  )}\n`,
);

const jwt = randomBytes(48).toString('hex');
writeFileSync(
  join(sistema, '.env'),
  `NODE_ENV=production
PORT=4000
HOST=0.0.0.0
DB_PROVIDER=sqlite
JWT_SECRET="${jwt}"
JWT_EXPIRES_IN=7d
CORS_ORIGINS=*
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=20
PUBLICO_DIR=./publico
ADMIN_NOME="Central de Servicos MadePinus"
ADMIN_EMAIL=admin@madepinus.com.br
ADMIN_SENHA=MudarEsteAcesso1
`,
);

console.log('==> Instalando dependências do pacote');
rodar('npm', ['install', '--omit=dev'], { cwd: sistema });

const sharedDestino = join(sistema, 'node_modules/@cortemadepinus/shared');
mkdirSync(sharedDestino, { recursive: true });
cpSync(join(raiz, 'packages/shared/dist'), join(sharedDestino, 'dist'), { recursive: true });
writeFileSync(
  join(sharedDestino, 'package.json'),
  `${JSON.stringify(
    {
      name: '@cortemadepinus/shared',
      version: '1.0.0',
      type: 'commonjs',
      main: './dist/index.js',
      types: './dist/index.d.ts',
    },
    null,
    2,
  )}\n`,
);

console.log('==> Gerando Prisma Client');
rodar('npx', ['prisma', 'generate', '--schema', 'prisma/sqlite/schema.prisma'], {
  cwd: sistema,
  env: { DATABASE_URL: `file:${join(sistema, 'dados/cortemadepinus.db').replace(/\\/g, '/')}` },
});

writeFileSync(
  join(destino, 'Pagina-inicial.bat'),
  `@echo off
chcp 65001 >nul
cd /d "%~dp0sistema"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Este pacote precisa do Node.js 20 ou superior.
  echo Baixe em https://nodejs.org e instale, depois abra este arquivo de novo.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

echo Iniciando a Central de Servicos MadePinus...
start "MadePinus" /min cmd /c "node dist\\index.js"
timeout /t 3 /nobreak >nul
start http://localhost:4000/
echo.
echo Pagina inicial aberta no navegador.
echo Para outro computador na mesma rede, use o endereco http://IP-DESTE-PC:4000
echo.
`,
);

writeFileSync(
  join(destino, 'LEIA-ME.txt'),
  `MadePinus · pacote para outro computador
========================================

COMO ABRIR
----------
1. Copie esta pasta inteira (pacote-madepinus) para o outro computador.
2. Instale o Node.js 20+ se ainda não tiver: https://nodejs.org
3. Dê dois cliques em Pagina-inicial.bat
   O navegador abre a página inicial do sistema.

OUTRO COMPUTADOR NA MESMA REDE
------------------------------
No PC onde o sistema está rodando, a janela do servidor mostra um endereço
como http://192.168.1.150:4000
Abra esse endereço no navegador do outro computador.

Se não abrir, no Windows: Firewall → permitir Node.js / porta 4000
na rede privada.

ACESSOS
-------
Administrador:  admin@madepinus.com.br
Cliente teste:  cliente@exemplo.com.br  (senha: cliente12345)
                — só existe se o banco de exemplo foi copiado.

Troque as senhas depois do primeiro acesso.

PARAR
-----
Feche a janela "MadePinus" na barra de tarefas ou use o Gerenciador de Tarefas
e encerre o processo node.exe deste pacote.
`,
);

console.log('');
console.log(`Pronto: ${destino}`);
console.log('Abra Pagina-inicial.bat para entrar no sistema.');
