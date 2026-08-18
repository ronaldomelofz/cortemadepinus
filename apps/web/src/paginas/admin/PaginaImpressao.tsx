import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  SERRA_PADRAO_MM,
  VALOR_CORTE_PADRAO,
  type ConfiguracaoCorte,
  type Pedido,
} from '@cortemadepinus/shared';
import { DesenhoChapa, montarResultado } from '../../componentes/VisualizacaoPlano';
import { Botao, Carregando } from '../../componentes/ui';
import { api, ErroApi } from '../../lib/api';

const TIPOS = ['planos', 'etiquetas'] as const;
type TipoImpressao = (typeof TIPOS)[number];

export function PaginaImpressao() {
  const { id, tipo } = useParams<{ id: string; tipo: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [config, setConfig] = useState<ConfiguracaoCorte>({
    serraMm: SERRA_PADRAO_MM,
    valorCorte: VALOR_CORTE_PADRAO,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const tipoValido = TIPOS.includes(tipo as TipoImpressao) ? (tipo as TipoImpressao) : null;

  useEffect(() => {
    if (!id || !tipoValido) return;
    setCarregando(true);
    Promise.all([api.obterPedido(id), api.catalogoConfiguracao().catch(() => null)])
      .then(([resposta, catalogo]) => {
        setPedido(resposta.pedido);
        if (catalogo) setConfig(catalogo.configuracao);
      })
      .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar o pedido'))
      .finally(() => setCarregando(false));
  }, [id, tipoValido]);

  if (!tipoValido) return <Navigate to="/admin/pedidos" replace />;

  if (carregando) return <Carregando texto="Preparando impressão..." />;
  if (erro || !pedido) {
    return (
      <div className="p-8 text-center">
        <p className="text-rose-700">{erro ?? 'Pedido não encontrado'}</p>
        <Link to="/admin/pedidos" className="mt-4 inline-block font-semibold text-madeira-700">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  return tipoValido === 'planos' ? (
    <ImpressaoPlanos pedido={pedido} config={config} />
  ) : (
    <ImpressaoEtiquetas pedido={pedido} />
  );
}

function BarraImpressao({ titulo, pedido }: { titulo: string; pedido: Pedido }) {
  return (
    <div className="nao-imprimir sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-bold text-stone-900">{titulo}</p>
        <p className="text-xs text-stone-500">
          Pedido #{String(pedido.numero).padStart(5, '0')} · {pedido.titulo}
        </p>
      </div>
      <div className="flex gap-2">
        <Botao type="button" onClick={() => window.print()}>
          Imprimir
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => window.close()}>
          Fechar
        </Botao>
      </div>
    </div>
  );
}

function CabecalhoPedido({ pedido }: { pedido: Pedido }) {
  return (
    <header className="mb-4 border-b border-stone-300 pb-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-madeira-800">
        MadePinus · Central de Serviços de Corte
      </p>
      <h1 className="mt-1 text-xl font-bold text-stone-900">
        Pedido #{String(pedido.numero).padStart(5, '0')} · {pedido.titulo}
      </h1>
      <p className="mt-1 text-sm text-stone-700">
        Cliente: <strong>{pedido.cliente?.nome ?? '—'}</strong>
        {pedido.cliente?.empresa ? ` · ${pedido.cliente.empresa}` : ''}
      </p>
    </header>
  );
}

function ImpressaoPlanos({ pedido, config }: { pedido: Pedido; config: ConfiguracaoCorte }) {
  const resultado = useMemo(() => {
    const pecas = pedido.pecas.map((peca) => ({
      ...peca,
      materialCodigo: pedido.materiais.find((m) => m.id === peca.materialId)?.codigo ?? 0,
    }));
    return montarResultado(pedido.materiais, pecas, config.serraMm);
  }, [pedido, config.serraMm]);

  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="bg-white text-stone-900">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } }`}</style>
      <BarraImpressao titulo="Impressão dos planos de corte" pedido={pedido} />
      <div className="px-6 py-4">
        {resultado.chapas.length === 0 ? (
          <p className="text-sm text-stone-600">Não há chapas para imprimir neste pedido.</p>
        ) : (
          resultado.chapas.map((chapa, indice) => (
            <section
              key={`${chapa.materialCodigo}-${chapa.indice}`}
              className={indice < resultado.chapas.length - 1 ? 'quebra-pagina mb-8' : 'mb-4'}
            >
              <CabecalhoPedido pedido={pedido} />
              <p className="mb-3 text-sm font-semibold text-stone-800">
                {chapa.materialDescricao} · Chapa {chapa.indice} de {resultado.totalChapas} ·{' '}
                {chapa.chapaLargura} × {chapa.chapaAltura} mm · {chapa.aproveitamento}% de aproveitamento
              </p>
              <DesenhoChapa chapa={chapa} valorCorte={0} larguraMaxima={1080} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function ImpressaoEtiquetas({ pedido }: { pedido: Pedido }) {
  const materiaisPorId = useMemo(
    () => new Map(pedido.materiais.map((m) => [m.id, m])),
    [pedido.materiais],
  );

  const etiquetas = useMemo(() => {
    const lista: Array<{
      chave: string;
      cliente: string;
      projeto: string;
      peca: string;
      medidas: string;
      material: string;
      sequencia: string;
    }> = [];
    const cliente = pedido.cliente?.nome?.trim() || 'Cliente';
    const projeto = pedido.titulo.trim();

    for (const peca of pedido.pecas) {
      const material = materiaisPorId.get(peca.materialId);
      for (let i = 1; i <= peca.quantidade; i += 1) {
        lista.push({
          chave: `${peca.id}-${i}`,
          cliente,
          projeto,
          peca: peca.descricao,
          medidas: `${peca.largura} × ${peca.altura} mm`,
          material: material?.descricao ?? '—',
          sequencia: `${i}/${peca.quantidade}`,
        });
      }
    }
    return lista;
  }, [pedido, materiaisPorId]);

  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="bg-white text-stone-900">
      <style>{`@media print { @page { size: A4 portrait; margin: 8mm; } }`}</style>
      <BarraImpressao titulo="Impressão de etiquetas" pedido={pedido} />
      <div className="px-4 py-4">
        <p className="nao-imprimir mb-3 text-sm text-stone-500">
          Cada etiqueta traz nome do cliente, nome do projeto e nome da peça. Uma etiqueta por peça física.
        </p>
        {etiquetas.length === 0 ? (
          <p className="text-sm text-stone-600">Não há peças para gerar etiquetas.</p>
        ) : (
          <div className="grade-etiquetas">
            {etiquetas.map((item) => (
              <article key={item.chave} className="etiqueta-peca">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-madeira-800">
                  MadePinus · Pedido #{String(pedido.numero).padStart(5, '0')}
                </p>
                <p className="mt-1 text-sm font-extrabold leading-tight text-stone-900">{item.cliente}</p>
                <p className="mt-0.5 text-sm font-semibold leading-tight text-stone-800">{item.projeto}</p>
                <p className="mt-1 text-base font-extrabold leading-tight text-madeira-800">{item.peca}</p>
                <p className="mt-2 text-xs text-stone-600">
                  {item.medidas} · {item.sequencia} · {item.material}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
