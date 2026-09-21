import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  formatarM2,
  formatarMoeda,
  importarPecas,
  pedidoCompletoSchema,
  pedidoEditavelPeloCliente,
  pedidoReabivelPeloCliente,
  SERRA_PADRAO_MM,
  VALOR_CORTE_PADRAO,
  type ConfiguracaoCorte,
  type PecaImportada,
  type ProdutoMdf,
  type StatusPedido,
} from '@cortemadepinus/shared';
import { ImportarPecas } from '../componentes/ImportarPecas';
import { TabelaPecas } from '../componentes/TabelaPecas';
import { Aviso, Botao, Carregando, Metrica } from '../componentes/ui';
import { VisualizacaoPlano, type AlteracaoPecaNoPlano } from '../componentes/VisualizacaoPlano';
import { api, ErroApi } from '../lib/api';
import { basePedidosPorPapel } from '../lib/destino';
import { confirmarEnvioParaCentral } from '../lib/pedidoCliente';
import {
  aplicarCatalogo,
  formularioInicial,
  formularioParaPayload,
  novaChave,
  pecaVazia,
  pedidoParaFormulario,
  resumirCortes,
  resumirFormulario,
  type PecaForm,
  type PedidoForm,
} from '../lib/formularioPedido';
import { useSessao } from '../lib/sessao';
import { rascunhoLocal } from '../lib/rascunhoLocal';

type EstadoNavegacaoEditor = { mensagemOk?: string };
type StatusAutosave = 'ocioso' | 'pendente' | 'salvando' | 'salvo' | 'local' | 'erro';

const ATRASO_AUTOSAVE_MS = 1200;
const ATRASO_RASCUNHO_LOCAL_MS = 400;

function payloadValido(formulario: PedidoForm) {
  const payload = formularioParaPayload(formulario);
  const validacao = pedidoCompletoSchema.safeParse(payload);
  return validacao.success ? validacao.data : null;
}

function rotuloAutosave(status: StatusAutosave, salvoEm: Date | null): string | null {
  if (status === 'pendente') return 'Alterações pendentes…';
  if (status === 'salvando') return 'Salvando rascunho…';
  if (status === 'local') return 'Rascunho guardado neste aparelho (aguardando dados completos para o servidor)';
  if (status === 'erro') return 'Falha ao salvar no servidor — o rascunho continua neste aparelho';
  if (status === 'salvo' && salvoEm) {
    return `Rascunho salvo às ${salvoEm.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }
  return null;
}

function formularioTemConteudo(formulario: PedidoForm): boolean {
  if (formulario.titulo.trim() || formulario.ambiente.trim() || formulario.observacoes.trim()) {
    return true;
  }
  return formulario.pecas.some(
    (peca) =>
      peca.descricao.trim() ||
      peca.largura.trim() ||
      peca.altura.trim() ||
      (peca.quantidade.trim() && peca.quantidade.trim() !== '1') ||
      peca.materialCodigo.trim(),
  );
}

export function EditorPedido() {
  const { id: idRota } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const location = useLocation();
  const { usuario } = useSessao();
  const base = basePedidosPorPapel(usuario?.role);
  const ehAdmin = usuario?.role === 'ADMIN';
  const usuarioId = usuario?.id ?? '';
  const [pedidoId, setPedidoId] = useState<string | undefined>(idRota);
  const [formulario, setFormulario] = useState<PedidoForm>(() => formularioInicial());
  const [carregando, setCarregando] = useState(Boolean(idRota));
  const [salvando, setSalvando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosGerais, setErrosGerais] = useState<string[]>([]);
  const [errosPecas, setErrosPecas] = useState<Record<number, string>>({});
  const [importando, setImportando] = useState(false);
  const [mensagemOk, setMensagemOk] = useState<string | null>(null);
  const [statusPedido, setStatusPedido] = useState<StatusPedido | null>(idRota ? null : 'RASCUNHO');
  const [produtos, setProdutos] = useState<ProdutoMdf[]>([]);
  const [catalogoPronto, setCatalogoPronto] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string; empresa?: string | null }>>([]);
  const [configCorte, setConfigCorte] = useState<ConfiguracaoCorte>({
    serraMm: SERRA_PADRAO_MM,
    valorCorte: VALOR_CORTE_PADRAO,
  });
  const [chavesDestaque, setChavesDestaque] = useState<Set<string>>(() => new Set());
  const [autoStatus, setAutoStatus] = useState<StatusAutosave>('ocioso');
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);

  const formularioRef = useRef(formulario);
  const pedidoIdRef = useRef(pedidoId);
  const clienteIdRef = useRef(clienteId);
  const pularProximoCarregamento = useRef(false);
  const pausarAutosave = useRef(true);
  const ultimoPayloadSalvo = useRef('');
  const geracaoAutosave = useRef(0);
  const emGravacao = useRef(false);

  formularioRef.current = formulario;
  pedidoIdRef.current = pedidoId;
  clienteIdRef.current = clienteId;

  const podeEditar = !statusPedido || pedidoEditavelPeloCliente(statusPedido);
  const podeReabrir = Boolean(statusPedido && pedidoReabivelPeloCliente(statusPedido));
  const textoAutosave = rotuloAutosave(autoStatus, salvoEm);

  function destacarChaves(chaves: string[]) {
    setChavesDestaque(new Set(chaves));
    window.setTimeout(() => {
      setChavesDestaque((atual) => {
        const proximo = new Set(atual);
        chaves.forEach((chave) => proximo.delete(chave));
        return proximo;
      });
    }, 12_000);
  }

  /** Grava o plano em Meus pedidos e deixa o editor pronto para o próximo. */
  function prepararNovoPlano(mensagem: string) {
    pausarAutosave.current = true;
    ultimoPayloadSalvo.current = '';
    if (usuarioId) {
      rascunhoLocal.limpar(usuarioId, pedidoIdRef.current);
      rascunhoLocal.limpar(usuarioId, null);
    }
    setPedidoId(undefined);
    setAutoStatus('ocioso');
    setSalvoEm(null);
    setStatusPedido('RASCUNHO');
    setErrosPecas({});
    setErrosGerais([]);
    setErroGeral(null);
    setChavesDestaque(new Set());
    setClienteId('');
    setFormulario(aplicarCatalogo(formularioInicial(), produtos));
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (idRota) {
      navegar(`${base}/novo`, {
        replace: true,
        state: { mensagemOk: mensagem } satisfies EstadoNavegacaoEditor,
      });
      return;
    }
    setMensagemOk(mensagem);
    window.setTimeout(() => {
      pausarAutosave.current = false;
    }, 400);
  }

  useEffect(() => {
    const estado = location.state as EstadoNavegacaoEditor | null;
    if (!estado?.mensagemOk) return;
    setMensagemOk(estado.mensagemOk);
    navegar(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navegar]);

  useEffect(() => {
    if (idRota && idRota !== pedidoIdRef.current) {
      setPedidoId(idRota);
    }
  }, [idRota]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const [catalogo, conf] = await Promise.all([
        api.catalogoProdutos().catch(() => ({ itens: [] as ProdutoMdf[] })),
        api
          .catalogoConfiguracao()
          .catch(() => ({ configuracao: { serraMm: SERRA_PADRAO_MM, valorCorte: VALOR_CORTE_PADRAO } })),
      ]);
      if (cancelado) return;
      setProdutos(catalogo.itens);
      setConfigCorte(conf.configuracao);
      setCatalogoPronto(true);

      if (!idRota) {
        const local = usuarioId ? rascunhoLocal.ler(usuarioId, null) : null;
        if (local?.formulario && formularioTemConteudo(local.formulario)) {
          setFormulario(aplicarCatalogo(local.formulario, catalogo.itens));
          setClienteId(local.clienteId || '');
          setAutoStatus('local');
          setMensagemOk('Rascunho recuperado deste aparelho. Continue de onde parou — o salvamento automático está ativo.');
        } else {
          setFormulario((atual) => aplicarCatalogo(atual, catalogo.itens));
        }
        pausarAutosave.current = false;
        return;
      }

      if (pularProximoCarregamento.current) {
        pularProximoCarregamento.current = false;
        if (usuarioId) rascunhoLocal.promover(usuarioId, idRota);
        pausarAutosave.current = false;
        setCarregando(false);
        return;
      }

      pausarAutosave.current = true;
      setCarregando(true);
      try {
        const { pedido } = await api.obterPedido(idRota);
        if (cancelado) return;
        setPedidoId(pedido.id);
        setStatusPedido(pedido.status);
        const formServidor = aplicarCatalogo(pedidoParaFormulario(pedido), catalogo.itens);
        const local = usuarioId ? rascunhoLocal.ler(usuarioId, idRota) : null;
        const localMaisNovo =
          local &&
          pedidoEditavelPeloCliente(pedido.status) &&
          new Date(local.atualizadoEm).getTime() > new Date(pedido.atualizadoEm).getTime();

        if (localMaisNovo && formularioTemConteudo(local.formulario)) {
          setFormulario(aplicarCatalogo(local.formulario, catalogo.itens));
          setClienteId(local.clienteId || '');
          setAutoStatus('local');
          setMensagemOk(
            'Há alterações mais recentes neste aparelho. Elas foram restauradas e serão sincronizadas com o servidor.',
          );
        } else {
          setFormulario(formServidor);
          ultimoPayloadSalvo.current = JSON.stringify(formularioParaPayload(formServidor));
        }

        if (pedidoReabivelPeloCliente(pedido.status)) {
          setErroGeral(null);
          setMensagemOk(
            'Este pedido já foi enviado. Para editar, ele volta a rascunho e precisa ser enviado de novo à central.',
          );
        } else if (!pedidoEditavelPeloCliente(pedido.status)) {
          setErroGeral('A central já iniciou este serviço. O plano não pode mais ser editado por aqui.');
        }
      } catch (falha) {
        if (!cancelado) setErroGeral(falha instanceof ErroApi ? falha.message : 'Falha ao carregar');
      } finally {
        if (!cancelado) {
          setCarregando(false);
          window.setTimeout(() => {
            pausarAutosave.current = false;
          }, 300);
        }
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [idRota, usuarioId]);

  useEffect(() => {
    if (!ehAdmin || pedidoId) return;
    api
      .listarClientes()
      .then((resposta) => setClientes(resposta.itens))
      .catch(() => setClientes([]));
  }, [ehAdmin, pedidoId]);

  const resumo = useMemo(() => resumirFormulario(formulario), [formulario]);
  const cortes = useMemo(() => {
    const precosPorCodigo = new Map(produtos.map((p) => [p.codigo, p.valorUnitario]));
    return resumirCortes(formulario, { ...configCorte, precosPorCodigo });
  }, [formulario, configCorte, produtos]);

  /* ----------------------------- Peças ----------------------------- */

  function alterarPeca(indice: number, campo: keyof PecaForm, valor: string | boolean) {
    setFormulario((atual) => ({
      ...atual,
      pecas: atual.pecas.map((peca, i) => (i === indice ? { ...peca, [campo]: valor } : peca)),
    }));
  }

  function alterarMedidasPecaNoPlano(alteracao: AlteracaoPecaNoPlano): number {
    let codigoFinal = alteracao.codigo;
    setFormulario((atual) => {
      const indice = atual.pecas.findIndex((peca) => Number(peca.codigo) === alteracao.codigo);
      if (indice < 0) return atual;
      const peca = atual.pecas[indice];
      const quantidade = Math.max(1, Math.round(Number(String(peca.quantidade).replace(',', '.')) || 1));
      const larguraAtual = Number(String(peca.largura).replace(',', '.'));
      const alturaAtual = Number(String(peca.altura).replace(',', '.'));
      if (larguraAtual === alteracao.largura && alturaAtual === alteracao.altura) return atual;
      if (quantidade <= 1) {
        return {
          ...atual,
          pecas: atual.pecas.map((item, i) =>
            i === indice
              ? { ...item, largura: String(alteracao.largura), altura: String(alteracao.altura) }
              : item,
          ),
        };
      }
      const pecas = atual.pecas.map((item, i) =>
        i === indice ? { ...item, quantidade: String(quantidade - 1) } : item,
      );
      codigoFinal = proximoCodigo(pecas);
      pecas.splice(indice + 1, 0, {
        ...peca,
        chave: novaChave(),
        codigo: String(codigoFinal),
        quantidade: '1',
        largura: String(alteracao.largura),
        altura: String(alteracao.altura),
      });
      return { ...atual, pecas };
    });
    return codigoFinal;
  }

  function excluirPecaNoPlano(codigo: number) {
    setFormulario((atual) => {
      const indice = atual.pecas.findIndex((peca) => Number(peca.codigo) === codigo);
      if (indice < 0) return atual;
      const peca = atual.pecas[indice];
      const quantidade = Math.max(1, Math.round(Number(String(peca.quantidade).replace(',', '.')) || 1));
      if (quantidade > 1) {
        return {
          ...atual,
          pecas: atual.pecas.map((item, i) =>
            i === indice ? { ...item, quantidade: String(quantidade - 1) } : item,
          ),
        };
      }
      if (atual.pecas.length === 1) {
        return { ...atual, pecas: [pecaVazia(Number(peca.codigo) || 1, peca.materialCodigo)] };
      }
      return { ...atual, pecas: atual.pecas.filter((_, i) => i !== indice) };
    });
  }

  function proximoCodigo(pecas: PecaForm[]): number {
    return Math.max(0, ...pecas.map((p) => Number(p.codigo) || 0)) + 1;
  }

  function adicionarPecas(quantidade = 1) {
    let geradas: PecaForm[] = [];
    setFormulario((atual) => {
      const material = atual.materiais[0]?.codigo ?? '99000';
      geradas = [];
      let codigo = proximoCodigo(atual.pecas);
      for (let i = 0; i < quantidade; i += 1) {
        geradas.push(pecaVazia(codigo, material));
        codigo += 1;
      }
      return { ...atual, pecas: [...atual.pecas, ...geradas] };
    });
    destacarChaves(geradas.map((peca) => peca.chave));
  }

  function duplicarPeca(indice: number) {
    let chaveNova = '';
    setFormulario((atual) => {
      const original = atual.pecas[indice];
      const copia: PecaForm = {
        ...original,
        chave: novaChave(),
        codigo: String(proximoCodigo(atual.pecas)),
      };
      chaveNova = copia.chave;
      const pecas = [...atual.pecas];
      pecas.splice(indice + 1, 0, copia);
      return { ...atual, pecas };
    });
    if (chaveNova) destacarChaves([chaveNova]);
  }

  function removerPeca(indice: number) {
    setFormulario((atual) => ({
      ...atual,
      pecas: atual.pecas.length === 1 ? atual.pecas : atual.pecas.filter((_, i) => i !== indice),
    }));
  }

  function aplicarImportacao(importadas: PecaImportada[], substituir: boolean) {
    const novasChaves: string[] = [];
    setFormulario((atual) => {
      const conhecidos = new Set(atual.materiais.map((m) => m.codigo));
      const padrao = atual.materiais[0]?.codigo ?? '';

      const convertidas: PecaForm[] = importadas.map((peca) => {
        const codigo = String(peca.materialCodigo);
        const chave = novaChave();
        novasChaves.push(chave);
        return {
          chave,
          codigo: String(peca.codigo),
          materialCodigo: conhecidos.has(codigo) ? codigo : padrao,
          quantidade: String(peca.quantidade),
          largura: String(peca.largura),
          altura: String(peca.altura),
          descricao: peca.descricao,
          veio: peca.veio ?? 'INDIFERENTE',
          fitaC1: false,
          fitaC2: false,
          fitaL1: false,
          fitaL2: false,
          observacao: peca.observacao ?? '',
        };
      });

      const anteriores = substituir
        ? []
        : atual.pecas.filter((p) => p.largura.trim() !== '' || p.descricao.trim() !== '');

      return { ...atual, pecas: [...anteriores, ...convertidas] };
    });
    destacarChaves(novasChaves);
    setMensagemOk(`${importadas.length} peça(s) importada(s).`);
  }

  /* ---------------------------- Gravação ---------------------------- */

  function validar(mostrarErros = true) {
    const payload = formularioParaPayload(formulario);
    const validacao = pedidoCompletoSchema.safeParse(payload);
    if (validacao.success) {
      if (mostrarErros) {
        setErrosPecas({});
        setErrosGerais([]);
      }
      return validacao.data;
    }

    if (mostrarErros) {
      const porPeca: Record<number, string> = {};
      const gerais: string[] = [];
      validacao.error.issues.forEach((problema) => {
        if (problema.path[0] === 'pecas' && typeof problema.path[1] === 'number') {
          porPeca[problema.path[1]] = problema.message;
        } else {
          gerais.push(problema.message);
        }
      });
      setErrosPecas(porPeca);
      setErrosGerais([...new Set(gerais)]);
    }
    return null;
  }

  async function persistirRascunho(opcoes: {
    automatico: boolean;
    payload?: NonNullable<ReturnType<typeof payloadValido>>;
  }) {
    const payload =
      opcoes.payload ?? (opcoes.automatico ? payloadValido(formularioRef.current) : validar(true));
    if (!payload) {
      if (opcoes.automatico) {
        // Plano incompleto: mantém só o rascunho local (já gravado no efeito dedicado).
        setAutoStatus(formularioTemConteudo(formularioRef.current) ? 'local' : 'ocioso');
      }
      return null;
    }

    const assinatura = JSON.stringify(payload);
    if (opcoes.automatico && assinatura === ultimoPayloadSalvo.current) {
      setAutoStatus('salvo');
      return pedidoIdRef.current ?? null;
    }

    if (emGravacao.current && opcoes.automatico) {
      setAutoStatus('pendente');
      window.setTimeout(() => {
        void persistirRascunho({ automatico: true });
      }, ATRASO_AUTOSAVE_MS);
      return null;
    }

    const idAtual = pedidoIdRef.current;
    const geracaoInicio = geracaoAutosave.current;
    if (opcoes.automatico) setAutoStatus('salvando');
    emGravacao.current = true;

    try {
      const resposta = idAtual
        ? await api.atualizarPedido(idAtual, payload)
        : await api.criarPedido(
            payload,
            ehAdmin && clienteIdRef.current ? clienteIdRef.current : undefined,
          );

      ultimoPayloadSalvo.current = assinatura;
      setStatusPedido(resposta.pedido.status);
      setPedidoId(resposta.pedido.id);
      setSalvoEm(new Date());
      if (usuarioId) {
        rascunhoLocal.gravar(usuarioId, resposta.pedido.id, {
          pedidoId: resposta.pedido.id,
          clienteId: clienteIdRef.current,
          formulario: formularioRef.current,
        });
        if (!idAtual) rascunhoLocal.promover(usuarioId, resposta.pedido.id);
      }
      if (opcoes.automatico && geracaoInicio !== geracaoAutosave.current) {
        setAutoStatus('pendente');
      } else {
        setAutoStatus('salvo');
      }
      if (opcoes.automatico) setErroGeral(null);

      if (!idAtual) {
        pularProximoCarregamento.current = true;
        navegar(`${base}/pedidos/${resposta.pedido.id}/editar`, { replace: true });
      }

      return resposta.pedido.id;
    } catch (falha) {
      const mensagem = falha instanceof ErroApi ? falha.message : 'Não foi possível salvar o pedido';
      if (opcoes.automatico) setAutoStatus('erro');
      setErroGeral(mensagem);
      return null;
    } finally {
      emGravacao.current = false;
    }
  }

  /** Sempre guarda no aparelho o que já foi digitado (mesmo incompleto). */
  useEffect(() => {
    if (!podeEditar || carregando || !catalogoPronto || !usuarioId || pausarAutosave.current) return;
    if (!formularioTemConteudo(formulario)) return;

    const timer = window.setTimeout(() => {
      rascunhoLocal.gravar(usuarioId, pedidoIdRef.current, {
        pedidoId: pedidoIdRef.current ?? null,
        clienteId: clienteIdRef.current,
        formulario: formularioRef.current,
      });
      setAutoStatus((atual) => (atual === 'salvo' || atual === 'salvando' ? atual : 'local'));
    }, ATRASO_RASCUNHO_LOCAL_MS);

    return () => window.clearTimeout(timer);
  }, [formulario, clienteId, podeEditar, carregando, catalogoPronto, usuarioId]);

  useEffect(() => {
    if (!podeEditar || carregando || !catalogoPronto || pausarAutosave.current) return;

    setAutoStatus((atual) => (atual === 'salvo' || atual === 'ocioso' || atual === 'local' ? 'pendente' : atual));
    const geracao = ++geracaoAutosave.current;
    const timer = window.setTimeout(() => {
      if (geracao !== geracaoAutosave.current) return;
      if (pausarAutosave.current || !podeEditar) return;
      void persistirRascunho({ automatico: true });
    }, ATRASO_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [formulario, clienteId, podeEditar, carregando, catalogoPronto]);

  useEffect(() => {
    const avisar = (evento: BeforeUnloadEvent) => {
      if (autoStatus === 'pendente' || autoStatus === 'salvando' || autoStatus === 'local') {
        evento.preventDefault();
        evento.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [autoStatus]);

  async function salvar(enviar: boolean) {
    if (!podeEditar) return;
    setErroGeral(null);
    setMensagemOk(null);
    const payload = validar(true);
    if (!payload) return;

    if (enviar && !confirmarEnvioParaCentral(payload.pecas.reduce((t, p) => t + p.quantidade, 0))) {
      return;
    }

    setSalvando(true);
    pausarAutosave.current = true;
    try {
      const idSalvo = await persistirRascunho({ automatico: false, payload });
      if (!idSalvo) return;

      if (enviar) {
        await api.enviarPedido(idSalvo);
        prepararNovoPlano(
          'Pedido enviado para a central. Ele já está em Meus pedidos — monte o próximo plano abaixo.',
        );
        return;
      }

      setMensagemOk('Rascunho salvo no servidor. As alterações também ficam guardadas neste aparelho.');
      pausarAutosave.current = false;
    } catch (falha) {
      setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar o pedido');
      pausarAutosave.current = false;
    } finally {
      setSalvando(false);
    }
  }

  async function reabrirParaEditar() {
    if (!pedidoId) return;
    setErroGeral(null);
    setReabrindo(true);
    try {
      const resposta = await api.reabrirPedido(pedidoId);
      setStatusPedido(resposta.pedido.status);
      setFormulario(aplicarCatalogo(pedidoParaFormulario(resposta.pedido), produtos));
      ultimoPayloadSalvo.current = JSON.stringify(formularioParaPayload(pedidoParaFormulario(resposta.pedido)));
      setMensagemOk('Pedido reaberto como rascunho. Ajuste o plano — o salvamento automático está ativo.');
      pausarAutosave.current = false;
    } catch (falha) {
      setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível reabrir o plano');
    } finally {
      setReabrindo(false);
    }
  }

  if (carregando) return <Carregando texto="Carregando pedido..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {pedidoId ? 'Editar plano de corte' : 'Novo plano de corte'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Lance as medidas em milímetros e escolha o MDF cadastrado pela central em cada peça.
          </p>
          {podeEditar && textoAutosave && (
            <p
              className={
                autoStatus === 'erro'
                  ? 'mt-1 text-xs font-medium text-rose-600'
                  : autoStatus === 'salvando' || autoStatus === 'pendente' || autoStatus === 'local'
                    ? 'mt-1 text-xs font-medium text-amber-700'
                    : 'mt-1 text-xs font-medium text-emerald-700'
              }
            >
              {textoAutosave}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {podeReabrir && (
            <Botao onClick={() => void reabrirParaEditar()} carregando={reabrindo}>
              Reabrir e editar
            </Botao>
          )}
          {podeEditar && (
            <>
              <Botao variante="secundario" onClick={() => void salvar(false)} carregando={salvando}>
                Salvar rascunho
              </Botao>
              <Botao onClick={() => void salvar(true)} carregando={salvando}>
                Enviar para a central
              </Botao>
            </>
          )}
          {!podeEditar && !podeReabrir && pedidoId && (
            <Botao variante="secundario" onClick={() => navegar(`${base}/pedidos/${pedidoId}`)}>
              Voltar ao pedido
            </Botao>
          )}
        </div>
      </div>

      {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}
      {mensagemOk && <Aviso tipo="sucesso">{mensagemOk}</Aviso>}
      {errosGerais.length > 0 && (
        <Aviso tipo="atencao" titulo="Corrija antes de continuar">
          <ul className="list-inside list-disc">
            {errosGerais.map((mensagem) => (
              <li key={mensagem}>{mensagem}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {catalogoPronto && produtos.length === 0 && (
        <Aviso tipo="atencao">
          A central ainda não cadastrou MDFs. Peça ao administrador para incluir os produtos em Cadastros
          antes de montar o plano.
        </Aviso>
      )}

      <div className={podeEditar ? undefined : 'pointer-events-none opacity-60'}>
      <section className="cartao p-5">
        <h2 className="mb-4 text-base font-bold text-stone-900">1. Dados do projeto</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ehAdmin && !pedidoId && (
            <label className="block md:col-span-3">
              <span className="rotulo">Cliente do pedido (opcional)</span>
              <select
                className="campo"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Central / sem cliente vinculado</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                    {cliente.empresa ? ` · ${cliente.empresa}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="rotulo">Nome do projeto *</span>
            <input
              className="campo"
              placeholder="Ex.: Cozinha apartamento 302"
              value={formulario.titulo}
              onChange={(e) => setFormulario((a) => ({ ...a, titulo: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="rotulo">Ambiente</span>
            <input
              className="campo"
              placeholder="Ex.: Cozinha, dormitório"
              value={formulario.ambiente}
              onChange={(e) => setFormulario((a) => ({ ...a, ambiente: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="cartao p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">2. Lista de peças</h2>
            <p className="text-sm text-stone-500">
              Em cada linha, escolha o MDF cadastrado pela central. Digite, cole do Excel (Ctrl+V) ou
              importe um arquivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante="secundario" onClick={() => setImportando(true)}>
              Importar CSV/TXT/Excel
            </Botao>
            <Botao
              type="button"
              className="shadow-md shadow-madeira-700/30"
              onClick={() => adicionarPecas(1)}
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
                <path d="M10 3.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 10 3.5Z" />
              </svg>
              Adicionar peça
            </Botao>
          </div>
        </div>

        <TabelaPecas
          pecas={formulario.pecas}
          materiais={formulario.materiais}
          produtosCatalogo={produtos}
          erros={errosPecas}
          chavesDestaque={chavesDestaque}
          aoAlterar={alterarPeca}
          aoRemover={removerPeca}
          aoDuplicar={duplicarPeca}
          aoColar={(texto) => {
            const material = Number(formulario.materiais[0]?.codigo) || 99000;
            const { pecas } = importarPecas(texto, { materialPadrao: material });
            if (pecas.length) aplicarImportacao(pecas, false);
          }}
        />
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 text-base font-bold text-stone-900">3. Resumo do plano</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica rotulo="Itens" valor={resumo.totalItens} detalhe="linhas na lista" />
          <Metrica rotulo="Peças" valor={resumo.totalPecas} detalhe="somando quantidades" />
          <Metrica rotulo="Área total" valor={formatarM2(resumo.areaTotalM2)} />
          <Metrica
            rotulo="Chapas (estimativa)"
            valor={cortes.chapasEstimadas}
            detalhe="para cálculo do material"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-madeira-200 bg-madeira-50/60 p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-madeira-900">
            Orçamento estimado
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metrica
              rotulo="Valor dos cortes"
              valor={formatarMoeda(cortes.valorCortes)}
              detalhe={`${cortes.totalCortes} corte(s) × ${formatarMoeda(cortes.valorPorCorte)}`}
            />
            <Metrica
              rotulo="Valor dos produtos"
              valor={formatarMoeda(cortes.valorProdutos)}
              detalhe={`${cortes.chapasEstimadas} chapa(s) × valor unitário`}
            />
            <Metrica
              rotulo="Valor total"
              valor={formatarMoeda(cortes.valorTotal)}
              detalhe="cortes + produtos"
            />
          </div>
        </div>

        {resumo.porMaterial.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Material</th>
                  <th className="px-3 py-2 text-right font-semibold">Peças</th>
                  <th className="px-3 py-2 text-right font-semibold">Área</th>
                  <th className="px-3 py-2 text-right font-semibold">Chapas</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor unit.</th>
                  <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {resumo.porMaterial.map((linha) => {
                  const codigoNum = Number(linha.codigo);
                  const valorUnitario = produtos.find((p) => p.codigo === codigoNum)?.valorUnitario ?? 0;
                  const subtotal = linha.chapasEstimadas * valorUnitario;
                  return (
                    <tr key={linha.codigo}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-stone-800">{linha.descricao}</span>
                        <span className="ml-2 text-xs text-stone-400">cód. {linha.codigo}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{linha.totalPecas}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarM2(linha.areaM2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{linha.chapasEstimadas}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(valorUnitario)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-stone-800">
                        {formatarMoeda(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-stone-500">
          A estimativa de chapas considera 85% de aproveitamento. O valor dos produtos usa o preço
          unitário cadastrado pela central. O orçamento oficial pode ser ajustado depois pela equipe.
        </p>
      </section>

      <section className="cartao p-5">
        <VisualizacaoPlano
          materiais={formulario.materiais}
          pecas={formulario.pecas}
          serraMm={configCorte.serraMm}
          valorCorte={configCorte.valorCorte}
          editavel={podeEditar}
          aoAlterarMedidas={podeEditar ? alterarMedidasPecaNoPlano : undefined}
          aoExcluirPeca={podeEditar ? excluirPecaNoPlano : undefined}
        />
      </section>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pb-6">
        <Botao
          variante="secundario"
          onClick={() => navegar(pedidoId ? `${base}/pedidos/${pedidoId}` : base)}
        >
          Voltar
        </Botao>
        {podeEditar && (
          <>
            <Botao variante="secundario" onClick={() => void salvar(false)} carregando={salvando}>
              Salvar rascunho
            </Botao>
            <Botao onClick={() => void salvar(true)} carregando={salvando}>
              Enviar para a central
            </Botao>
          </>
        )}
      </div>

      <ImportarPecas
        aberto={importando}
        materialPadrao={formulario.materiais[0]?.codigo ?? '99000'}
        aoFechar={() => setImportando(false)}
        aoConfirmar={aplicarImportacao}
      />
    </div>
  );
}
