import { env } from '../env';

function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith('55')) return digitos;
  return digitos;
}

/** Envia mensagem de texto via Evolution API (ou apenas registra em log se desativado). */
export async function enviarWhatsApp(destino: string, texto: string): Promise<void> {
  const numero = normalizarTelefone(destino);
  if (!numero) return;

  if (!env.WHATSAPP_ENABLED) {
    console.log(`[whatsapp] (desativado) ${numero}: ${texto}`);
    return;
  }

  const url = `${env.WHATSAPP_API_URL.replace(/\/$/, '')}/message/sendText/${env.WHATSAPP_INSTANCE}`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.WHATSAPP_API_KEY,
    },
    body: JSON.stringify({ number: numero, text: texto }),
  }).catch((erro) => {
    console.error('[whatsapp] Falha na requisição:', erro);
    return null;
  });

  if (!resposta?.ok) {
    const detalhe = resposta ? await resposta.text().catch(() => '') : 'sem resposta';
    console.error(`[whatsapp] Erro ${resposta?.status ?? '—'}: ${detalhe}`);
  }
}

export async function notificarPagamentoConfirmadoCliente(dados: {
  telefone?: string | null;
  nome: string;
  numeroPedido: number;
  titulo: string;
}): Promise<void> {
  if (!dados.telefone) return;
  const texto =
    `Olá, ${dados.nome}! O pagamento do pedido #${String(dados.numeroPedido).padStart(5, '0')} ` +
    `(${dados.titulo}) foi confirmado pela MadePinus. O serviço de corte será iniciado em breve.`;
  await enviarWhatsApp(dados.telefone, texto);
}

export async function notificarNovoPedidoOperador(dados: {
  telefone?: string | null;
  numeroPedido: number;
  titulo: string;
  cliente: string;
}): Promise<void> {
  if (!dados.telefone) return;
  const texto =
    `Novo pedido em produção: #${String(dados.numeroPedido).padStart(5, '0')} · ${dados.titulo} · ` +
    `Cliente ${dados.cliente}. Acesse o portal do operador.`;
  await enviarWhatsApp(dados.telefone, texto);
}
