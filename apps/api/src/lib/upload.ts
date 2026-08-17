import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../env';
import { requisicaoInvalida } from './erros';

export const PASTA_UPLOAD = path.resolve(env.UPLOAD_DIR);

fs.mkdirSync(PASTA_UPLOAD, { recursive: true });

const EXTENSOES_PERMITIDAS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.csv',
  '.txt',
  '.xls',
  '.xlsx',
  '.dxf',
  '.dwg',
  '.zip',
]);

const armazenamento = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PASTA_UPLOAD),
  filename: (_req, file, cb) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensao}`);
  },
});

export const upload = multer({
  storage: armazenamento,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    if (!EXTENSOES_PERMITIDAS.has(extensao)) {
      cb(requisicaoInvalida(`Extensão ${extensao || 'desconhecida'} não permitida`));
      return;
    }
    cb(null, true);
  },
});

export function caminhoDoAnexo(nomeArmazenado: string): string {
  const destino = path.resolve(PASTA_UPLOAD, nomeArmazenado);
  if (!destino.startsWith(PASTA_UPLOAD)) throw requisicaoInvalida('Caminho de arquivo inválido');
  return destino;
}

export function removerArquivo(nomeArmazenado: string): void {
  try {
    fs.unlinkSync(caminhoDoAnexo(nomeArmazenado));
  } catch {
    /* arquivo ja removido: nada a fazer */
  }
}
