import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatarData,
  formatarM2,
  pedidoEditavelPeloCliente,
  STATUS_LABEL,
  STATUS_PEDIDO,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { Aviso, Botao, Carregando, EtiquetaStatus, Metrica, Vazio } from '../componentes/ui';
import { api, ErroApi, type PedidoComResumo } from '../lib/api';

export function MeusPedidos() {
  const [pedidos, setPedidos] = useState<PedidoComResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | StatusPedido>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setCarregando(true);
    const atrasar = setTimeout(() => {
      api
        .listarPedidos({ status: status || undefined, busca: busca || undefined })
        .then((pagina) => setPedidos(pagina.itens))
        .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar'))
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(atrasar);
  }, [status, busca]);

  const indicadores = useMemo(
    () => ({
      abertos: pedidos.filter((p) => !['ENTREGUE', 'CANCELADO', 'RASCUNHO'].includes(p.status)).length,
      rascunhos: pedidos.filter((p) => p.status === 'RASCUNHO').length,
      area: pedidos.reduce((total, p) => total + p.resumo.areaTotalM2, 0),
    }),
    [pedidos],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Meus planos de corte</h1>
          <p className="mt-1 text-sm text-stone-500">
            Acompanhe o andamento de cada pedido enviado à central de serviços.
          </p>
        </div>
        <Link to="/app/novo">
          <Botao>+ Novo plano de corte</Botao>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica rotulo="Pedidos em andamento" valor={indicadores.abertos} />
        <Metrica rotulo="Rascunhos" valor={indicadores.rascunhos} detalhe="ainda não enviados" />
        <Metrica rotulo="Área listada" valor={formatarM2(indicadores.area)} detalhe="nesta consulta" />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="campo max-w-xs"
          placeholder="Buscar por título ou ambiente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="campo max-w-56"
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | StatusPedido)}
        >
          <option value="">Todos os status</option>
          {STATUS_PEDIDO.map((valor) => (
            <option key={valor} value={valor}>
              {STATUS_LABEL[valor]}
            </option>
          ))}
        </select>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <Carregando />
      ) : pedidos.length === 0 ? (
        <Vazio
          titulo="Nenhum pedido por aqui"
          descricao="Crie seu primeiro plano de corte: cadastre os materiais, lance as medidas e envie para a nossa central."
          acao={
            <Link to="/app/novo">
              <Botao>Criar plano de corte</Botao>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {pedidos.map((pedido) => {
            const rascunho = pedidoEditavelPeloCliente(pedido.status);
            return (
              <div
                key={pedido.id}
                className="cartao flex flex-wrap items-center gap-4 p-4 transition hover:border-madeira-300 hover:shadow-md"
              >
                <Link to={`/app/pedidos/${pedido.id}`} className="min-w-56 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold tabular-nums text-stone-600">
                      #{String(pedido.numero).padStart(5, '0')}
                    </span>
                    <EtiquetaStatus status={pedido.status} />
                  </div>
                  <p className="mt-2 text-base font-semibold text-stone-900">{pedido.titulo}</p>
                  <p className="text-xs text-stone-500">
                    {pedido.ambiente ? `${pedido.ambiente} · ` : ''}
                    Criado em {formatarData(pedido.criadoEm)}
                  </p>
                </Link>

                <dl className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Peças</dt>
                    <dd className="font-semibold tabular-nums text-stone-800">{pedido.resumo.totalPecas}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Área</dt>
                    <dd className="font-semibold tabular-nums text-stone-800">
                      {formatarM2(pedido.resumo.areaTotalM2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-stone-400">Materiais</dt>
                    <dd className="font-semibold tabular-nums text-stone-800">{pedido.materiais.length}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {rascunho && (
                    <Link to={`/app/pedidos/${pedido.id}/editar`}>
                      <Botao>Editar</Botao>
                    </Link>
                  )}
                  <Link to={`/app/pedidos/${pedido.id}`}>
                    <Botao variante="secundario">{rascunho ? 'Ver' : 'Abrir'}</Botao>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
