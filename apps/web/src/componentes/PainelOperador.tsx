import {
  labelAcaoOperador,
  STATUS_OPERADOR_LABEL,
  transicoesOperador,
  type Pedido,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { Aviso, Botao } from './ui';
import { api } from '../lib/api';

export function PainelOperador({
  pedido,
  ocupado,
  executar,
}: {
  pedido: Pedido;
  ocupado: boolean;
  executar: (acao: () => Promise<unknown>) => Promise<void>;
}) {
  const opcoes = transicoesOperador(pedido.status);
  const situacao = STATUS_OPERADOR_LABEL[pedido.status] ?? pedido.status;

  return (
    <section className="cartao border-purple-200 bg-purple-50/40 p-5">
      <h2 className="mb-1 text-base font-bold text-stone-900">Produção · andamento do corte</h2>
      <p className="mb-4 text-sm text-stone-600">
        Situação atual: <strong>{situacao}</strong>
      </p>

      {pedido.status === 'PRONTO' ? (
        <Aviso tipo="sucesso">
          Corte concluído. O pedido aguarda retirada ou entrega pela central de serviços.
        </Aviso>
      ) : opcoes.length === 0 ? (
        <Aviso tipo="atencao">
          Pedido recebido da central. Você já pode conferir peças, imprimir planos e etiquetas.
          O corte só pode ser iniciado depois que o administrador aprovar o pedido.
        </Aviso>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((novoStatus) => (
            <Botao
              key={novoStatus}
              variante={novoStatus === 'PRONTO' ? 'primario' : novoStatus === 'PAUSADO' ? 'secundario' : 'primario'}
              carregando={ocupado}
              onClick={() => {
                const confirmar =
                  novoStatus === 'PRONTO'
                    ? confirm(`Marcar o pedido #${String(pedido.numero).padStart(5, '0')} como concluído?`)
                    : true;
                if (!confirmar) return;
                void executar(() =>
                  api.mudarStatusOperador(pedido.id, { status: novoStatus as StatusPedido }),
                );
              }}
            >
              {labelAcaoOperador(pedido.status, novoStatus)}
            </Botao>
          ))}
        </div>
      )}
    </section>
  );
}
