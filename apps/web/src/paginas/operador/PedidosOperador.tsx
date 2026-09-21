import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  formatarData,
  formatarM2,
  STATUS_FILA_OPERADOR,
  STATUS_LABEL,
  STATUS_OPERADOR_LABEL,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { Aviso, Carregando, EtiquetaStatus, Vazio } from '../../componentes/ui';
import { ResumoPedidosPorStatus } from '../../componentes/ResumoPedidosPorStatus';
import { api, ErroApi, type PedidoComResumo } from '../../lib/api';

export function PedidosOperador() {
  const [parametros, setParametros] = useSearchParams();
  const status = (parametros.get('status') ?? '') as '' | StatusPedido;
  const [busca, setBusca] = useState(parametros.get('busca') ?? '');
  const [pedidos, setPedidos] = useState<PedidoComResumo[]>([]);
  const [contagemPorStatus, setContagemPorStatus] = useState<Partial<Record<StatusPedido, number>>>({});
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .painelOperador()
      .then((painel) => setContagemPorStatus(painel.contagemPorStatus))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCarregando(true);
    const atrasar = setTimeout(() => {
      api
        .listarPedidosOperador({ status: status || undefined, busca: busca || undefined })
        .then((pagina) => {
          setPedidos(pagina.itens);
          setTotal(pagina.total);
        })
        .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar'))
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(atrasar);
  }, [status, busca]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Fila de produção</h1>
        <p className="mt-1 text-sm text-stone-500">
          {total} pedido(s) recebidos da central, em análise, aprovados ou em corte.
        </p>
      </div>

      <ResumoPedidosPorStatus
        contagem={contagemPorStatus}
        basePath="/operador"
        visaoOperador
      />

      <div className="flex flex-wrap gap-3">
        <input
          className="campo max-w-xs"
          placeholder="Buscar por cliente, empresa ou projeto"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="campo max-w-56"
          value={status}
          onChange={(e) => {
            const valor = e.target.value;
            setParametros(valor ? { status: valor } : {});
          }}
        >
          <option value="">Todos na fila</option>
          {STATUS_FILA_OPERADOR.map((valor) => (
            <option key={valor} value={valor}>
              {STATUS_OPERADOR_LABEL[valor] ?? STATUS_LABEL[valor]}
            </option>
          ))}
        </select>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <Carregando />
      ) : pedidos.length === 0 ? (
        <Vazio titulo="Nada na fila" descricao="Nenhum pedido com pagamento confirmado aguardando produção." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Pedido</th>
                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2 text-left font-semibold">Andamento</th>
                <th className="px-3 py-2 text-right font-semibold">Peças</th>
                <th className="px-3 py-2 text-right font-semibold">Área</th>
                <th className="px-3 py-2 text-right font-semibold">Chapas est.</th>
                <th className="px-3 py-2 text-left font-semibold">Aprovado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="transition hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <Link
                      to={`/operador/pedidos/${pedido.id}`}
                      className="font-semibold text-madeira-700 hover:underline"
                    >
                      #{String(pedido.numero).padStart(5, '0')} · {pedido.titulo}
                    </Link>
                    {pedido.ambiente && <p className="text-xs text-stone-500">{pedido.ambiente}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-stone-800">{pedido.cliente?.nome}</p>
                    <p className="text-xs text-stone-500">{pedido.cliente?.empresa || pedido.cliente?.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <EtiquetaStatus status={pedido.status} />
                    <p className="mt-0.5 text-xs text-stone-500">
                      {STATUS_OPERADOR_LABEL[pedido.status] ?? STATUS_LABEL[pedido.status]}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{pedido.resumo.totalPecas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatarM2(pedido.resumo.areaTotalM2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pedido.resumo.chapasEstimadas}</td>
                  <td className="px-3 py-2 text-stone-600">{formatarData(pedido.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
