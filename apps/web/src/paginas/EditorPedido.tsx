import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { VisualizacaoPlano } from '../componentes/VisualizacaoPlano';
import { api, ErroApi } from '../lib/api';
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

export function EditorPedido() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const [formulario, setFormulario] = useState<PedidoForm>(formularioInicial);
  const [carregando, setCarregando] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosGerais, setErrosGerais] = useState<string[]>([]);
  const [errosPecas, setErrosPecas] = useState<Record<number, string>>({});
  const [importando, setImportando] = useState(false);
  const [mensagemOk, setMensagemOk] = useState<string | null>(null);
  const [statusPedido, setStatusPedido] = useState<StatusPedido | null>(id ? null : 'RASCUNHO');
  const [produtos, setProdutos] = useState<ProdutoMdf[]>([]);
  const [catalogoPronto, setCatalogoPronto] = useState(false);
  const [configCorte, setConfigCorte] = useState<ConfiguracaoCorte>({
    serraMm: SERRA_PADRAO_MM,
    valorCorte: VALOR_CORTE_PADRAO,
  });

  const podeEditar = !statusPedido || pedidoEditavelPeloCliente(statusPedido);
  const podeReabrir = Boolean(statusPedido && pedidoReabivelPeloCliente(statusPedido));

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

      if (!id) {
        setFormulario((atual) => aplicarCatalogo(atual, catalogo.itens));
        return;
      }

      setCarregando(true);
      try {
        const { pedido } = await api.obterPedido(id);
        if (cancelado) return;
        setStatusPedido(pedido.status);
        setFormulario(aplicarCatalogo(pedidoParaFormulario(pedido), catalogo.itens));
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
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const resumo = useMemo(() => resumirFormulario(formulario), [formulario]);
  const cortes = useMemo(
    () => resumirCortes(formulario, configCorte),
    [formulario, configCorte],
  );

  /* ----------------------------- Peças ----------------------------- */

  function alterarPeca(indice: number, campo: keyof PecaForm, valor: string | boolean) {
    setFormulario((atual) => ({
      ...atual,
      pecas: atual.pecas.map((peca, i) => (i === indice ? { ...peca, [campo]: valor } : peca)),
    }));
  }

  function proximoCodigo(pecas: PecaForm[]): number {
    return Math.max(0, ...pecas.map((p) => Number(p.codigo) || 0)) + 1;
  }

  function adicionarPecas(quantidade = 1) {
    setFormulario((atual) => {
      const material = atual.materiais[0]?.codigo ?? '99000';
      const novas: PecaForm[] = [];
      let codigo = proximoCodigo(atual.pecas);
      for (let i = 0; i < quantidade; i += 1) {
        novas.push(pecaVazia(codigo, material));
        codigo += 1;
      }
      return { ...atual, pecas: [...atual.pecas, ...novas] };
    });
  }

  function duplicarPeca(indice: number) {
    setFormulario((atual) => {
      const original = atual.pecas[indice];
      const copia: PecaForm = {
        ...original,
        chave: novaChave(),
        codigo: String(proximoCodigo(atual.pecas)),
      };
      const pecas = [...atual.pecas];
      pecas.splice(indice + 1, 0, copia);
      return { ...atual, pecas };
    });
  }

  function removerPeca(indice: number) {
    setFormulario((atual) => ({
      ...atual,
      pecas: atual.pecas.length === 1 ? atual.pecas : atual.pecas.filter((_, i) => i !== indice),
    }));
  }

  function aplicarImportacao(importadas: PecaImportada[], substituir: boolean) {
    setFormulario((atual) => {
      const conhecidos = new Set(atual.materiais.map((m) => m.codigo));
      const padrao = atual.materiais[0]?.codigo ?? '';

      const convertidas: PecaForm[] = importadas.map((peca) => {
        const codigo = String(peca.materialCodigo);
        return {
          chave: novaChave(),
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
    setMensagemOk(`${importadas.length} peça(s) importada(s).`);
  }

  /* ---------------------------- Gravação ---------------------------- */

  function validar() {
    const payload = formularioParaPayload(formulario);
    const validacao = pedidoCompletoSchema.safeParse(payload);
    if (validacao.success) {
      setErrosPecas({});
      setErrosGerais([]);
      return payload;
    }

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
    return null;
  }

  async function salvar(enviar: boolean) {
    if (!podeEditar) return;
    setErroGeral(null);
    setMensagemOk(null);
    const payload = validar();
    if (!payload) return;

    setSalvando(true);
    try {
      const resposta = id ? await api.atualizarPedido(id, payload) : await api.criarPedido(payload);
      setStatusPedido(resposta.pedido.status);
      if (enviar) {
        await api.enviarPedido(resposta.pedido.id);
        navegar(`/app/pedidos/${resposta.pedido.id}`, { replace: true });
        return;
      }
      setMensagemOk('Rascunho salvo. Você pode continuar editando até enviar para a central.');
      if (!id) navegar(`/app/pedidos/${resposta.pedido.id}/editar`, { replace: true });
    } catch (falha) {
      setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar o pedido');
    } finally {
      setSalvando(false);
    }
  }

  async function reabrirParaEditar() {
    if (!id) return;
    setErroGeral(null);
    setReabrindo(true);
    try {
      const resposta = await api.reabrirPedido(id);
      setStatusPedido(resposta.pedido.status);
      setFormulario(aplicarCatalogo(pedidoParaFormulario(resposta.pedido), produtos));
      setMensagemOk('Pedido reaberto como rascunho. Ajuste o plano e envie de novo para a central.');
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
            {id ? 'Editar plano de corte' : 'Novo plano de corte'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Lance as medidas em milímetros e escolha o MDF cadastrado pela central em cada peça.
          </p>
        </div>
        <div className="flex gap-2">
          {podeReabrir && (
            <Botao onClick={() => void reabrirParaEditar()} carregando={reabrindo}>
              Reabrir e editar
            </Botao>
          )}
          {podeEditar && (
            <>
              <Botao variante="secundario" onClick={() => salvar(false)} carregando={salvando}>
                Salvar rascunho
              </Botao>
              <Botao onClick={() => salvar(true)} carregando={salvando}>
                Enviar para a central
              </Botao>
            </>
          )}
          {!podeEditar && !podeReabrir && id && (
            <Botao variante="secundario" onClick={() => navegar(`/app/pedidos/${id}`)}>
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
          <label className="block md:col-span-2">
            <span className="rotulo">Título do projeto *</span>
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
          <label className="block">
            <span className="rotulo">Prazo desejado</span>
            <input
              className="campo"
              placeholder="Ex.: 5 dias úteis"
              value={formulario.prazoDesejado}
              onChange={(e) => setFormulario((a) => ({ ...a, prazoDesejado: e.target.value }))}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="rotulo">Observações para a central</span>
            <textarea
              className="campo min-h-20"
              placeholder="Instruções de corte, retirada ou entrega..."
              value={formulario.observacoes}
              onChange={(e) => setFormulario((a) => ({ ...a, observacoes: e.target.value }))}
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
              Importar CSV/TXT
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
          erros={errosPecas}
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
            rotulo="Valor estimado dos cortes"
            valor={formatarMoeda(cortes.valorEstimado)}
            detalhe={`${cortes.totalCortes} corte(s) × ${formatarMoeda(cortes.valorUnitario)}`}
          />
        </div>

        {resumo.porMaterial.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Material</th>
                  <th className="px-3 py-2 text-right font-semibold">Peças</th>
                  <th className="px-3 py-2 text-right font-semibold">Área</th>
                  <th className="px-3 py-2 text-right font-semibold">Chapas (estimativa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {resumo.porMaterial.map((linha) => (
                  <tr key={linha.codigo}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-stone-800">{linha.descricao}</span>
                      <span className="ml-2 text-xs text-stone-400">cód. {linha.codigo}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{linha.totalPecas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatarM2(linha.areaM2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{linha.chapasEstimadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-stone-500">
          A estimativa de chapas considera 85% de aproveitamento. O desenho abaixo é uma prévia para
          conferência; o número exato sai da otimização no Corte Certo pela central.
        </p>
      </section>

      <section className="cartao p-5">
        <VisualizacaoPlano
          materiais={formulario.materiais}
          pecas={formulario.pecas}
          serraMm={configCorte.serraMm}
          valorCorte={configCorte.valorCorte}
        />
      </section>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pb-6">
        <Botao variante="secundario" onClick={() => navegar(id ? `/app/pedidos/${id}` : '/app')}>
          Voltar
        </Botao>
        {podeEditar && (
          <>
            <Botao variante="secundario" onClick={() => salvar(false)} carregando={salvando}>
              Salvar rascunho
            </Botao>
            <Botao onClick={() => salvar(true)} carregando={salvando}>
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
