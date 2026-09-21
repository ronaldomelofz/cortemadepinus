import type { PedidoForm } from './formularioPedido';

const PREFIXO = 'madepinus.rascunho.v1.';

export type RascunhoLocal = {
  atualizadoEm: string;
  pedidoId: string | null;
  clienteId: string;
  formulario: PedidoForm;
};

function chave(usuarioId: string, pedidoId: string | null | undefined): string {
  return `${PREFIXO}${usuarioId}.${pedidoId ?? 'novo'}`;
}

export const rascunhoLocal = {
  gravar(usuarioId: string, pedidoId: string | null | undefined, dados: Omit<RascunhoLocal, 'atualizadoEm'>) {
    if (!usuarioId) return;
    try {
      const registro: RascunhoLocal = {
        ...dados,
        pedidoId: pedidoId ?? null,
        atualizadoEm: new Date().toISOString(),
      };
      localStorage.setItem(chave(usuarioId, pedidoId), JSON.stringify(registro));
      // Mantém espelho em "novo" enquanto o plano ainda não tem id no servidor.
      if (!pedidoId) return;
      const chaveNovo = chave(usuarioId, null);
      const novo = localStorage.getItem(chaveNovo);
      if (novo) {
        try {
          const parseado = JSON.parse(novo) as RascunhoLocal;
          // Se o rascunho "novo" for o mesmo plano recém-criado, remove para não duplicar.
          if (parseado.formulario.titulo === dados.formulario.titulo) {
            localStorage.removeItem(chaveNovo);
          }
        } catch {
          localStorage.removeItem(chaveNovo);
        }
      }
    } catch {
      /* quota / modo privado */
    }
  },

  ler(usuarioId: string, pedidoId: string | null | undefined): RascunhoLocal | null {
    if (!usuarioId) return null;
    try {
      const bruto = localStorage.getItem(chave(usuarioId, pedidoId));
      if (!bruto) return null;
      const dados = JSON.parse(bruto) as RascunhoLocal;
      if (!dados?.formulario) return null;
      return dados;
    } catch {
      return null;
    }
  },

  limpar(usuarioId: string, pedidoId: string | null | undefined) {
    if (!usuarioId) return;
    try {
      localStorage.removeItem(chave(usuarioId, pedidoId));
      if (pedidoId) localStorage.removeItem(chave(usuarioId, null));
    } catch {
      /* ignore */
    }
  },

  /** Migra rascunho de "novo" para o id criado no servidor. */
  promover(usuarioId: string, pedidoId: string) {
    if (!usuarioId || !pedidoId) return;
    const atual = this.ler(usuarioId, null);
    if (!atual) return;
    this.gravar(usuarioId, pedidoId, {
      pedidoId,
      clienteId: atual.clienteId,
      formulario: atual.formulario,
    });
    this.limpar(usuarioId, null);
  },
};
