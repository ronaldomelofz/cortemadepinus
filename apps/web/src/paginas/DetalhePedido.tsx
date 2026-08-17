import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  calcularResumo,
  formatarData,
  formatarM2,
  formatarMoeda,
  STATUS_LABEL,
  VEIO_LABEL,
  type Pedido,
  type ResumoPedido,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { Aviso, Botao, Carregando, EtiquetaStatus, Metrica } from '../componentes/ui';
import { VisualizacaoPlano } from '../componentes/VisualizacaoPlano';
import { api, ErroApi } from '../lib/api';
import { useSessao } from '../lib/sessao';

const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  RASCUNHO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE: ['ORCAMENTO_ENVIADO', 'APROVADO', 'CANCELADO'],
  ORCAMENTO_ENVIADO: ['APROVADO', 'EM_ANALISE', 'CANCELADO'],
  APROVADO: ['EM_PRODUCAO', 'CANCELADO'],
  EM_PRODUCAO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

export function DetalhePedido() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { usuario } = useSessao();
  const ehAdmin = usuario?.role === 'ADMIN';

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [resumo, setResumo] = useState<ResumoPedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState('');

  async function recarregar() {
    if (!id) return;
    const resposta = await api.obterPedido(id);
    setPedido(resposta.pedido);
    setResumo(resposta.resumo ?? calcularResumo(resposta.pedido));
  }

  useEffect(() => {
    setCarregando(true);
    recarregar()
      .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar o pedido'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      await recarregar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Operação não concluída');
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) return <Carregando texto="Carregando pedido..." />;
  if (!pedido || !resumo) return <Aviso tipo="erro">{erro ?? 'Pedido não encontrado'}</Aviso>;

  const materiaisPorId = new Map(pedido.materiais.map((m) => [m.id, m]));
  const podeEditar = pedido.status === 'RASCUNHO';

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold tabular-nums text-stone-600">
              #{String(pedido.numero).padStart(5, '0')}
            </span>
            <EtiquetaStatus status={pedido.status} />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">{pedido.titulo}</h1>
          <p className="text-sm text-stone-500">
            {pedido.ambiente ? `${pedido.ambiente} · ` : ''}
            Criado em {formatarData(pedido.criadoEm)}
            {pedido.enviadoEm ? ` · Enviado em ${formatarData(pedido.enviadoEm)}` : ''}
          </p>
          {ehAdmin && pedido.cliente && (
            <p className="mt-1 text-sm text-stone-600">
              Cliente: <strong>{pedido.cliente.nome}</strong>
              {pedido.cliente.empresa ? ` · ${pedido.cliente.empresa}` : ''} · {pedido.cliente.email}
              {pedido.cliente.telefone ? ` · ${pedido.cliente.telefone}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {podeEditar && !ehAdmin && (
            <>
              <Link to={`/app/pedidos/${pedido.id}/editar`}>
                <Botao variante="secundario">Editar</Botao>
              </Link>
              <Botao
                carregando={ocupado}
                onClick={() => void executar(() => api.enviarPedido(pedido.id))}
              >
                Enviar para a central
              </Botao>
            </>
          )}
          {podeEditar && (
            <Botao
              variante="perigo"
              carregando={ocupado}
              onClick={() => {
                if (!confirm('Excluir este rascunho? A ação não pode ser desfeita.')) return;
                void executar(async () => {
                  await api.excluirPedido(pedido.id);
                  navegar(ehAdmin ? '/admin/pedidos' : '/app');
                });
              }}
            >
              Excluir
            </Botao>
          )}
        </div>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica rotulo="Itens" valor={resumo.totalItens} />
        <Metrica rotulo="Peças" valor={resumo.totalPecas} />
        <Metrica rotulo="Área total" valor={formatarM2(resumo.areaTotalM2)} />
        <Metrica
          rotulo="Orçamento"
          valor={pedido.valorOrcamento != null ? formatarMoeda(pedido.valorOrcamento) : '—'}
        />
      </div>

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Arquivos para a produção</h2>
        <p className="mb-4 text-sm text-stone-500">
          O CSV e o TXT seguem o layout oficial de importação do Corte Certo. A planilha de produção traz veio
          e material por extenso.
        </p>
        <div className="flex flex-wrap gap-2">
          <BotaoDownload pedidoId={pedido.id} formato="csv" rotulo="CSV Corte Certo" />
          <BotaoDownload pedidoId={pedido.id} formato="txt" rotulo="TXT Corte Certo (TAB)" />
          <BotaoDownload pedidoId={pedido.id} formato="producao" rotulo="Planilha de produção" />
        </div>
      </section>

      {ehAdmin && <PainelStatus pedido={pedido} ocupado={ocupado} executar={executar} />}

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Materiais</h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Cód.</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-left font-semibold">Cor</th>
                <th className="px-3 py-2 text-right font-semibold">Espessura</th>
                <th className="px-3 py-2 text-right font-semibold">Chapa</th>
                <th className="px-3 py-2 text-right font-semibold">Área</th>
                <th className="px-3 py-2 text-right font-semibold">Chapas est.</th>
                <th className="px-3 py-2 text-left font-semibold">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {pedido.materiais.map((material) => {
                const linha = resumo.porMaterial.find((m) => m.materialId === material.id);
                return (
                  <tr key={material.id}>
                    <td className="px-3 py-2 tabular-nums">{material.codigo}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{material.descricao}</td>
                    <td className="px-3 py-2 text-stone-600">{material.cor || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{material.espessura} mm</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {material.chapaLargura} × {material.chapaAltura}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatarM2(linha?.areaM2 ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{linha?.chapasEstimadas ?? 0}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {material.fornecidoPeloCliente
                        ? `Cliente${material.quantidadeChapas ? ` (${material.quantidadeChapas} chapas)` : ''}`
                        : 'MadePinus'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Lista de peças</h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Cód.</th>
                <th className="px-3 py-2 text-right font-semibold">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold">Largura</th>
                <th className="px-3 py-2 text-right font-semibold">Altura</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-left font-semibold">Material</th>
                <th className="px-3 py-2 text-left font-semibold">Veio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {pedido.pecas.map((peca) => {
                return (
                  <tr key={peca.id}>
                    <td className="px-3 py-2 tabular-nums">{peca.codigo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{peca.quantidade}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{peca.largura}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{peca.altura}</td>
                    <td className="px-3 py-2 text-stone-800">{peca.descricao}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {materiaisPorId.get(peca.materialId)?.descricao ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{VEIO_LABEL[peca.veio]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pedido.observacoes && (
          <div className="mt-4">
            <p className="rotulo">Observações do cliente</p>
            <p className="whitespace-pre-line text-sm text-stone-700">{pedido.observacoes}</p>
          </div>
        )}
      </section>

      <section className="cartao p-5">
        <VisualizacaoPlano
          materiais={pedido.materiais}
          pecas={pedido.pecas.map((peca) => ({
            ...peca,
            materialCodigo: materiaisPorId.get(peca.materialId)?.codigo ?? 0,
          }))}
        />
      </section>

      <Anexos pedido={pedido} podeEditar={podeEditar || ehAdmin} executar={executar} ocupado={ocupado} />

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Conversa sobre o pedido</h2>
        <div className="space-y-3">
          {(pedido.mensagens ?? []).length === 0 && (
            <p className="text-sm text-stone-500">Nenhuma mensagem ainda.</p>
          )}
          {(pedido.mensagens ?? []).map((mensagem) => (
            <div
              key={mensagem.id}
              className={
                mensagem.autorRole === 'ADMIN'
                  ? 'rounded-xl bg-madeira-50 p-3 ring-1 ring-inset ring-madeira-100'
                  : 'rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200'
              }
            >
              <p className="text-xs font-semibold text-stone-600">
                {mensagem.autorNome}
                {mensagem.autorRole === 'ADMIN' && ' · Central de serviços'}
                <span className="ml-2 font-normal text-stone-400">{formatarData(mensagem.criadoEm)}</span>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-stone-800">{mensagem.texto}</p>
            </div>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!texto.trim()) return;
            void executar(async () => {
              await api.enviarMensagem(pedido.id, texto.trim());
              setTexto('');
            });
          }}
        >
          <input
            className="campo"
            placeholder="Escreva uma mensagem para a central..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Botao type="submit" carregando={ocupado}>
            Enviar
          </Botao>
        </form>
      </section>

      <section className="cartao p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">Histórico</h2>
        <ol className="space-y-3 border-l-2 border-stone-200 pl-4">
          {(pedido.historico ?? []).map((evento) => (
            <li key={evento.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-madeira-500" />
              <p className="text-sm font-semibold text-stone-800">{STATUS_LABEL[evento.status]}</p>
              <p className="text-xs text-stone-500">
                {formatarData(evento.criadoEm)}
                {evento.autorNome ? ` · ${evento.autorNome}` : ''}
              </p>
              {evento.nota && <p className="mt-0.5 text-sm text-stone-600">{evento.nota}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function BotaoDownload({
  pedidoId,
  formato,
  rotulo,
}: {
  pedidoId: string;
  formato: 'csv' | 'txt' | 'producao';
  rotulo: string;
}) {
  return (
    <a
      href={api.urlDownload(`/api/pedidos/${pedidoId}/exportar/${formato}`)}
      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
      </svg>
      {rotulo}
    </a>
  );
}

function PainelStatus({
  pedido,
  ocupado,
  executar,
}: {
  pedido: Pedido;
  ocupado: boolean;
  executar: (acao: () => Promise<unknown>) => Promise<void>;
}) {
  const opcoes = TRANSICOES[pedido.status];
  const [novoStatus, setNovoStatus] = useState<StatusPedido | ''>(opcoes[0] ?? '');
  const [nota, setNota] = useState('');
  const [valor, setValor] = useState(pedido.valorOrcamento != null ? String(pedido.valorOrcamento) : '');

  return (
    <section className="cartao border-madeira-200 bg-madeira-50/40 p-5">
      <h2 className="mb-3 text-base font-bold text-stone-900">Central de serviços · atualizar pedido</h2>
      {opcoes.length === 0 ? (
        <p className="text-sm text-stone-600">Este pedido está finalizado e não aceita novas transições.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="rotulo">Novo status</span>
            <select
              className="campo"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as StatusPedido)}
            >
              {opcoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {STATUS_LABEL[opcao]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="rotulo">Valor do orçamento (R$)</span>
            <input
              className="campo"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="rotulo">Nota para o cliente</span>
            <input
              className="campo"
              placeholder="Ex.: plano otimizado, previsão de corte para quinta-feira"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </label>
          <div className="md:col-span-4">
            <Botao
              carregando={ocupado}
              disabled={!novoStatus}
              onClick={() =>
                void executar(() =>
                  api.mudarStatus(pedido.id, {
                    status: novoStatus as StatusPedido,
                    nota: nota || undefined,
                    valorOrcamento: valor ? Number(valor.replace(',', '.')) : undefined,
                  }),
                )
              }
            >
              Atualizar pedido
            </Botao>
          </div>
        </div>
      )}
    </section>
  );
}

function Anexos({
  pedido,
  podeEditar,
  executar,
  ocupado,
}: {
  pedido: Pedido;
  podeEditar: boolean;
  executar: (acao: () => Promise<unknown>) => Promise<void>;
  ocupado: boolean;
}) {
  return (
    <section className="cartao p-5">
      <h2 className="mb-3 text-base font-bold text-stone-900">Anexos</h2>
      <p className="mb-4 text-sm text-stone-500">
        Projetos em PDF, DXF, fotos de referência ou a planilha original. Até 20 MB por arquivo.
      </p>

      {pedido.anexos.length > 0 && (
        <ul className="mb-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
          {pedido.anexos.map((anexo) => (
            <li key={anexo.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <a
                href={api.urlDownload(`/api/pedidos/${pedido.id}/anexos/${anexo.id}`)}
                className="flex-1 font-medium text-madeira-700 hover:underline"
              >
                {anexo.nomeOriginal}
              </a>
              <span className="text-xs text-stone-400">{(anexo.tamanho / 1024).toFixed(0)} KB</span>
              {podeEditar && (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600 hover:underline"
                  onClick={() => void executar(() => api.excluirAnexo(pedido.id, anexo.id))}
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50">
          {ocupado ? 'Enviando...' : 'Anexar arquivos'}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(evento) => {
              const arquivos = evento.target.files;
              if (arquivos?.length) void executar(() => api.enviarAnexos(pedido.id, arquivos));
              evento.target.value = '';
            }}
          />
        </label>
      )}
    </section>
  );
}
