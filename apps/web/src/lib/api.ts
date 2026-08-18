import type {
  ConfiguracaoCorte,
  Mensagem,
  Pedido,
  ProdutoMdf,
  ResumoPedido,
  StatusPedido,
  Usuario,
} from '@cortemadepinus/shared';

const bruto = import.meta.env.VITE_API_URL;
export const API_URL = (
  typeof bruto === 'string' && bruto.trim() !== ''
    ? bruto
    : import.meta.env.DEV
      ? ''
      : 'http://localhost:4000'
).replace(/\/$/, '');

/**
 * Detecta o site publicado apontando para a API de desenvolvimento, o que
 * acontece quando VITE_API_URL nao foi definida no ambiente de build.
 */
export const apiMalConfigurada =
  typeof window !== 'undefined' &&
  API_URL.includes('localhost') &&
  API_URL.length > 0 &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname);

const CHAVE_TOKEN = 'madepinus.token';

export const armazenamento = {
  lerToken: () => localStorage.getItem(CHAVE_TOKEN),
  gravarToken: (token: string) => localStorage.setItem(CHAVE_TOKEN, token),
  limparToken: () => localStorage.removeItem(CHAVE_TOKEN),
};

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly detalhes?: Array<{ campo: string; mensagem: string }>,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

interface Opcoes extends Omit<RequestInit, 'body'> {
  body?: unknown;
  semAutenticacao?: boolean;
}

export async function requisitar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { body, semAutenticacao, headers, ...resto } = opcoes;
  const token = armazenamento.lerToken();

  const ehFormData = body instanceof FormData;
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...resto,
    headers: {
      ...(ehFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && !semAutenticacao ? { Authorization: `Bearer ${token}` } : {}),
      ...(API_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
      ...headers,
    },
    body: ehFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new ErroApi(
      0,
      'Não foi possível falar com a central de serviços. Verifique sua conexão ou tente novamente em instantes.',
    );
  });

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : {};

  if (!resposta.ok) {
    if (resposta.status === 401) armazenamento.limparToken();
    throw new ErroApi(resposta.status, dados.erro ?? 'Falha na requisição', dados.detalhes);
  }

  return dados as T;
}

export interface PedidoComResumo extends Pedido {
  resumo: ResumoPedido;
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  itens: T[];
}

export const api = {
  registrar: (body: unknown) =>
    requisitar<{ token: string; usuario: Usuario }>('/api/auth/registrar', {
      method: 'POST',
      body,
      semAutenticacao: true,
    }),

  login: (body: unknown) =>
    requisitar<{ token: string; usuario: Usuario }>('/api/auth/login', {
      method: 'POST',
      body,
      semAutenticacao: true,
    }),

  eu: () => requisitar<{ usuario: Usuario }>('/api/auth/eu'),

  atualizarPerfil: (body: unknown) =>
    requisitar<{ usuario: Usuario }>('/api/auth/eu', { method: 'PUT', body }),

  listarPedidos: (filtros: { status?: string; busca?: string; pagina?: number } = {}) => {
    const query = new URLSearchParams();
    if (filtros.status) query.set('status', filtros.status);
    if (filtros.busca) query.set('busca', filtros.busca);
    if (filtros.pagina) query.set('pagina', String(filtros.pagina));
    return requisitar<Pagina<PedidoComResumo>>(`/api/pedidos?${query}`);
  },

  obterPedido: (id: string) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>(`/api/pedidos/${id}`),

  criarPedido: (body: unknown) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>('/api/pedidos', { method: 'POST', body }),

  atualizarPedido: (id: string, body: unknown) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>(`/api/pedidos/${id}`, {
      method: 'PUT',
      body,
    }),

  excluirPedido: (id: string) => requisitar<void>(`/api/pedidos/${id}`, { method: 'DELETE' }),

  enviarPedido: (id: string) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>(`/api/pedidos/${id}/enviar`, {
      method: 'POST',
    }),

  reabrirPedido: (id: string) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>(`/api/pedidos/${id}/reabrir`, {
      method: 'POST',
    }),

  enviarMensagem: (id: string, texto: string) =>
    requisitar<{ mensagem: Mensagem }>(`/api/pedidos/${id}/mensagens`, {
      method: 'POST',
      body: { texto },
    }),

  enviarAnexos: (id: string, arquivos: FileList | File[]) => {
    const form = new FormData();
    Array.from(arquivos).forEach((arquivo) => form.append('arquivos', arquivo));
    return requisitar<{ pedido: Pedido }>(`/api/pedidos/${id}/anexos`, { method: 'POST', body: form });
  },

  excluirAnexo: (pedidoId: string, anexoId: string) =>
    requisitar<void>(`/api/pedidos/${pedidoId}/anexos/${anexoId}`, { method: 'DELETE' }),

  /** URL autenticada por query string, usada em <a download>. */
  urlDownload: (caminho: string) =>
    `${API_URL}${caminho}${caminho.includes('?') ? '&' : '?'}token=${armazenamento.lerToken() ?? ''}`,

  painelAdmin: () =>
    requisitar<{
      contagemPorStatus: Record<StatusPedido, number>;
      totalClientes: number;
      totalPedidos: number;
      areaEmAberto: number;
      pedidosRecentes: PedidoComResumo[];
    }>('/api/admin/painel'),

  listarPedidosAdmin: (filtros: { status?: string; busca?: string; pagina?: number } = {}) => {
    const query = new URLSearchParams();
    if (filtros.status) query.set('status', filtros.status);
    if (filtros.busca) query.set('busca', filtros.busca);
    if (filtros.pagina) query.set('pagina', String(filtros.pagina));
    return requisitar<Pagina<PedidoComResumo>>(`/api/admin/pedidos?${query}`);
  },

  mudarStatus: (id: string, body: { status: StatusPedido; nota?: string; valorOrcamento?: number | null }) =>
    requisitar<{ pedido: Pedido; resumo: ResumoPedido }>(`/api/admin/pedidos/${id}/status`, {
      method: 'PATCH',
      body,
    }),

  listarClientes: (busca?: string) =>
    requisitar<{ itens: Array<Usuario & { totalPedidos: number }> }>(
      `/api/admin/clientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`,
    ),

  alterarSituacaoCliente: (id: string, ativo: boolean) =>
    requisitar<{ usuario: Usuario }>(`/api/admin/clientes/${id}`, {
      method: 'PATCH',
      body: { ativo },
    }),

  atualizarCliente: (id: string, body: unknown) =>
    requisitar<{ usuario: Usuario }>(`/api/admin/clientes/${id}`, {
      method: 'PUT',
      body,
    }),

  catalogoProdutos: () =>
    requisitar<{ itens: ProdutoMdf[] }>('/api/catalogo/produtos'),

  catalogoConfiguracao: () =>
    requisitar<{ configuracao: ConfiguracaoCorte }>('/api/catalogo/configuracao'),

  listarProdutosAdmin: (busca?: string) =>
    requisitar<{ itens: ProdutoMdf[] }>(
      `/api/admin/produtos${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`,
    ),

  criarProduto: (body: unknown) =>
    requisitar<{ produto: ProdutoMdf }>('/api/admin/produtos', { method: 'POST', body }),

  atualizarProduto: (id: string, body: unknown) =>
    requisitar<{ produto: ProdutoMdf }>(`/api/admin/produtos/${id}`, { method: 'PUT', body }),

  alterarSituacaoProduto: (id: string, ativo: boolean) =>
    requisitar<{ produto: ProdutoMdf }>(`/api/admin/produtos/${id}`, {
      method: 'PATCH',
      body: { ativo },
    }),

  excluirProduto: (id: string) =>
    requisitar<void>(`/api/admin/produtos/${id}`, { method: 'DELETE' }),

  obterConfiguracaoAdmin: () =>
    requisitar<{ configuracao: ConfiguracaoCorte }>('/api/admin/configuracao'),

  salvarConfiguracao: (body: { serraMm: number; valorCorte: number }) =>
    requisitar<{ configuracao: ConfiguracaoCorte }>('/api/admin/configuracao', {
      method: 'PUT',
      body,
    }),
};
