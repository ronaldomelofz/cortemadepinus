import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@cortemadepinus/shared';
import { env } from '../env';
import { naoAutorizado, proibido } from './erros';

export interface Autenticado {
  id: string;
  email: string;
  role: Role;
  nome: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: Autenticado;
    }
  }
}

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function gerarToken(usuario: Autenticado): string {
  const conteudo: Autenticado = {
    id: usuario.id,
    email: usuario.email,
    role: usuario.role,
    nome: usuario.nome,
  };
  return jwt.sign(conteudo, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function lerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const query = req.query.token;
  return typeof query === 'string' && query ? query : null;
}

/** Exige um token valido. O download de arquivos aceita o token via query string. */
export function exigirAutenticacao(req: Request, _res: Response, next: NextFunction): void {
  const token = lerToken(req);
  if (!token) return next(naoAutorizado('Faça login para continuar'));
  try {
    const dados = jwt.verify(token, env.JWT_SECRET) as Autenticado & { iat: number; exp: number };
    req.usuario = { id: dados.id, email: dados.email, role: dados.role, nome: dados.nome };
    next();
  } catch {
    next(naoAutorizado());
  }
}

export function exigirAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.usuario) return next(naoAutorizado());
  if (req.usuario.role !== 'ADMIN') return next(proibido('Área restrita à central de serviços'));
  next();
}
