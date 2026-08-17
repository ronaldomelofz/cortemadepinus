import { env } from '../env';

/**
 * Filtro "contem" independente de banco.
 *
 * O PostgreSQL precisa de `mode: 'insensitive'` para ignorar maiusculas;
 * o SQLite ja compara LIKE sem diferenciar caixa para caracteres ASCII e
 * rejeita esse parametro.
 */
export function contemTexto(valor?: string) {
  if (!valor?.trim()) return undefined;
  const termo = valor.trim();
  return env.ehPostgres ? { contains: termo, mode: 'insensitive' as const } : { contains: termo };
}
