/** Abre a página de impressão e aciona o diálogo do sistema quando o conteúdo estiver pronto. */
export function abrirPaginaImpressao(caminho: string): void {
  const janela = window.open(caminho, 'madepinus-impressao');
  if (!janela) {
    window.location.assign(caminho);
  } else {
    janela.focus();
  }
}

/** Dispara o diálogo de impressoras após o layout estar pronto. */
export function agendarDialogoImpressao(atrasoMs = 500): () => void {
  let cancelado = false;
  let timeoutId = 0;
  let frame2 = 0;

  const frame1 = window.requestAnimationFrame(() => {
    frame2 = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (cancelado) return;
        window.focus();
        window.print();
      }, atrasoMs);
    });
  });

  return () => {
    cancelado = true;
    window.cancelAnimationFrame(frame1);
    window.cancelAnimationFrame(frame2);
    window.clearTimeout(timeoutId);
  };
}
