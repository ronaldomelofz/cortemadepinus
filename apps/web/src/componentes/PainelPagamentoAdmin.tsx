import { pedidoAguardandoConfirmacaoPagamento, type Pedido } from '@cortemadepinus/shared';
import { Botao } from './ui';
import { api } from '../lib/api';

export function PainelPagamentoAdmin({
  pedido,
  ocupado,
  executar,
}: {
  pedido: Pedido;
  ocupado: boolean;
  executar: (acao: () => Promise<unknown>) => Promise<void>;
}) {
  if (!pedidoAguardandoConfirmacaoPagamento(pedido.status)) return null;

  return (
    <section className="cartao border-emerald-200 bg-emerald-50/40 p-5">
      <h2 className="mb-1 text-base font-bold text-stone-900">Confirmação de pagamento</h2>
      <p className="mb-4 text-sm text-stone-600">
        Ao confirmar, o cliente será avisado por WhatsApp (se configurado) e o pedido seguirá para a
        fila do operador.
      </p>

      <Botao
        carregando={ocupado}
        onClick={() => {
          if (
            !confirm(
              `Confirmar pagamento do pedido #${String(pedido.numero).padStart(5, '0')} e liberar para produção?`,
            )
          ) {
            return;
          }
          void executar(() => api.confirmarPagamento(pedido.id));
        }}
      >
        Pagamento confirmado
      </Botao>
    </section>
  );
}
