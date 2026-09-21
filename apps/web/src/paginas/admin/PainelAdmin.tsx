import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatarData, formatarM2, STATUS_PEDIDO, type StatusPedido } from '@cortemadepinus/shared';
import { Aviso, Carregando, EtiquetaStatus, Metrica } from '../../componentes/ui';
import { ResumoPedidosPorStatus } from '../../componentes/ResumoPedidosPorStatus';
import { api, ErroApi, type PedidoComResumo } from '../../lib/api';

interface Painel {
  contagemPorStatus: Record<StatusPedido, number>;
  totalClientes: number;
  totalPedidos: number;
  areaEmAberto: number;
  pedidosRecentes: PedidoComResumo[];
}

export function PainelAdmin() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .painelAdmin()
      .then(setPainel)
      .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar o painel'));
  }, []);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!painel) return <Carregando texto="Carregando painel..." />;

  const naFila =
    painel.contagemPorStatus.ENVIADO + painel.contagemPorStatus.EM_ANALISE;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Painel da central de serviços</h1>
          <p className="mt-1 text-sm text-stone-500">
            Visão geral dos planos de corte recebidos dos clientes.
          </p>
        </div>
        <Link
          to="/admin/novo"
          className="rounded-lg bg-madeira-700 px-4 py-2 text-sm font-semibold text-white hover:bg-madeira-800"
        >
          Novo plano de corte
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Aguardando análise" valor={naFila} detalhe="enviados + em análise" />
        <Metrica rotulo="Em produção" valor={painel.contagemPorStatus.EM_PRODUCAO} />
        <Metrica rotulo="Clientes cadastrados" valor={painel.totalClientes} />
        <Metrica rotulo="Área em aberto" valor={formatarM2(painel.areaEmAberto)} />
      </div>

      <ResumoPedidosPorStatus
        contagem={painel.contagemPorStatus}
        basePath="/admin/pedidos"
        statuses={STATUS_PEDIDO}
      />

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Pedidos em andamento</h2>
        {painel.pedidosRecentes.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum pedido em andamento no momento.</p>
        ) : (
          <div className="grid gap-3">
            {painel.pedidosRecentes.map((pedido) => (
              <Link
                key={pedido.id}
                to={`/admin/pedidos/${pedido.id}`}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 p-4 transition hover:border-madeira-300 hover:bg-stone-50"
              >
                <div className="min-w-56 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold tabular-nums text-stone-600">
                      #{String(pedido.numero).padStart(5, '0')}
                    </span>
                    <EtiquetaStatus status={pedido.status} />
                  </div>
                  <p className="mt-2 font-semibold text-stone-900">{pedido.titulo}</p>
                  <p className="text-xs text-stone-500">
                    {pedido.cliente?.nome}
                    {pedido.cliente?.empresa ? ` · ${pedido.cliente.empresa}` : ''} ·{' '}
                    {pedido.enviadoEm ? formatarData(pedido.enviadoEm) : 'sem envio'}
                  </p>
                </div>
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Peças</dt>
                    <dd className="font-semibold tabular-nums">{pedido.resumo.totalPecas}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Área</dt>
                    <dd className="font-semibold tabular-nums">{formatarM2(pedido.resumo.areaTotalM2)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Chapas est.</dt>
                    <dd className="font-semibold tabular-nums">{pedido.resumo.chapasEstimadas}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
