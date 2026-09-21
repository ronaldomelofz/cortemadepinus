/** Mensagem de confirmação antes de enviar o plano à central. */
export function confirmarEnvioParaCentral(totalPecas: number): boolean {
  return confirm(
    `Enviar o plano com ${totalPecas} peça(s) para a central MadePinus?\n\n` +
      'A central analisará o pedido e liberará para produção. ' +
      'Enquanto aguardar, você ainda pode reabrir o plano para corrigir.',
  );
}
