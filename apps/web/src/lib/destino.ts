import type { Role } from '@cortemadepinus/shared';

export function destinoPorPapel(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'OPERADOR') return '/operador';
  if (role === 'VENDEDOR') return '/vendedor';
  return '/app';
}

export function basePedidosPorPapel(
  role: Role | undefined,
): '/admin' | '/operador' | '/vendedor' | '/app' {
  if (role === 'ADMIN') return '/admin';
  if (role === 'OPERADOR') return '/operador';
  if (role === 'VENDEDOR') return '/vendedor';
  return '/app';
}
