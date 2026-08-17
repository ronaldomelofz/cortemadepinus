import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = 'ErroHttp';
  }
}

export const naoEncontrado = (recurso = 'Recurso') => new ErroHttp(404, `${recurso} não encontrado`);
export const naoAutorizado = (msg = 'Sessão inválida ou expirada') => new ErroHttp(401, msg);
export const proibido = (msg = 'Você não tem permissão para esta operação') => new ErroHttp(403, msg);
export const requisicaoInvalida = (msg: string, detalhes?: unknown) => new ErroHttp(400, msg, detalhes);

/** Envolve handlers async para que rejeicoes cheguem ao middleware de erro. */
export function assincrono<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res, next).catch(next);
  };
}

export function tratadorDeErros(
  erro: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (erro instanceof ZodError) {
    res.status(422).json({
      erro: 'Dados inválidos',
      detalhes: erro.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
    return;
  }

  if (erro instanceof ErroHttp) {
    res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
    return;
  }

  const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido';
  console.error('[erro-nao-tratado]', erro);
  res.status(500).json({ erro: 'Erro interno do servidor', detalhes: mensagem });
}
