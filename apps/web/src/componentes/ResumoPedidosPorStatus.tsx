import { Link } from 'react-router-dom';
import {
  STATUS_FILA_OPERADOR,
  STATUS_LABEL,
  STATUS_OPERADOR_LABEL,
  type StatusPedido,
} from '@cortemadepinus/shared';

interface Props {
  contagem: Partial<Record<StatusPedido, number>>;
  /** Rota base para filtrar (ex.: /operador ou /admin/pedidos). */
  basePath: string;
  /** Usa rótulos da visão do operador quando disponível. */
  visaoOperador?: boolean;
  statuses?: readonly StatusPedido[];
}

export function ResumoPedidosPorStatus({
  contagem,
  basePath,
  visaoOperador = false,
  statuses = STATUS_FILA_OPERADOR,
}: Props) {
  const rotulo = (status: StatusPedido) =>
    visaoOperador ? (STATUS_OPERADOR_LABEL[status] ?? STATUS_LABEL[status]) : STATUS_LABEL[status];

  return (
    <section className="cartao p-5">
      <h2 className="mb-3 text-base font-bold text-stone-900">Pedidos por status</h2>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Link
            key={status}
            to={`${basePath}?status=${status}`}
            className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm ring-1 ring-inset ring-stone-200 transition hover:bg-stone-100"
          >
            <span className="text-stone-600">{rotulo(status)}</span>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-stone-800 ring-1 ring-inset ring-stone-200">
              {contagem[status] ?? 0}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
