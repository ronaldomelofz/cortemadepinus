import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  formatarM2,
  importarPecas,
  pedidoCompletoSchema,
  type PecaImportada,
} from '@cortemadepinus/shared';
import { EditorMateriais } from '../componentes/EditorMateriais';
import { ImportarPecas } from '../componentes/ImportarPecas';
import { TabelaPecas } from '../componentes/TabelaPecas';
import { Aviso, Botao, Carregando, Metrica } from '../componentes/ui';
import { VisualizacaoPlano } from '../componentes/VisualizacaoPlano';
import { api, ErroApi } from '../lib/api';
import {
  formularioInicial,
  formularioParaPayload,
  materialVazio,
  novaChave,
  pecaVazia,
  pedidoParaFormulario,
  resumirFormulario,
  type MaterialForm,
  type PecaForm,
  type PedidoForm,
} from '../lib/formularioPedido';

export function EditorPedido() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const [formulario, setFormulario] = useState<PedidoForm>(formularioInicial);
  const [carregando, setCarregando] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosGerais, setErrosGerais] = useState<string[]>([]);
  const [errosPecas, setErrosPecas] = useState<Record<number, string>>({});
  const [importando, setImportando] = useState(false);
  const [mensagemOk, setMensagemOk] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    api
      .obterPedido(id)
      .then(({ pedido }) => {
        if (pedido.status !== 'RASCUNHO') {
          setErroGeral('Este pedido já foi enviado e não pode mais ser editado.');
        }
        setFormulario(pedidoParaFormulario(pedido));
      })
      .catch((falha) => setErroGeral(falha instanceof ErroApi ? falha.message : 'Falha ao carregar'))
      .finally(() => setCarregando(false));
  }, [id]);

  const resumo = useMemo(() => resumirFormulario(formulario), [formulario]);

  /* --------------------------- Materiais --------------------------- */

  function alterarMaterial(indice: number, campo: keyof MaterialForm, valor: string | boolean) {
    setFormulario((atual) => {
      const materiais = atual.materiais.map((material, i) =>
        i === indice ? { ...material, [campo]: valor } : material,
      );
      // Mantem as pecas apontando para o material quando o codigo muda.
      if (campo === 'codigo') {
        const anterior = atual.materiais[indice].codigo;
        return {
          ...atual,
          materiais,
          pecas: atual.pecas.map((peca) =>
            peca.materialCodigo === anterior ? { ...peca, materialCodigo: String(valor) } : peca,
          ),
        };
      }
      return { ...atual, materiais };
    });
  }

  function adicionarMaterial() {
    setFormulario((atual) => {
      const maiorCodigo = Math.max(99000, ...atual.materiais.map((m) => Number(m.codigo) || 0));
      return { ...atual, materiais: [...atual.materiais, materialVazio(maiorCodigo + 1)] };
    });
  }

  function removerMaterial(indice: number) {
    setFormulario((atual) => {
      const removido = atual.materiais[indice];
      const materiais = atual.materiais.filter((_, i) => i !== indice);
      const substituto = materiais[0]?.codigo ?? '';
      return {
        ...atual,
        materiais,
        pecas: atual.pecas.map((peca) =>
          peca.materialCodigo === removido.codigo ? { ...peca, materialCodigo: substituto } : peca,
        ),
      };
    });
  }

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
      const codigosConhecidos = new Set(atual.materiais.map((m) => m.codigo));
      const materiais = [...atual.materiais];

      // Cria automaticamente os materiais citados no arquivo que ainda nao existem.
      importadas.forEach((peca) => {
        const codigo = String(peca.materialCodigo);
        if (!codigosConhecidos.has(codigo)) {
          codigosConhecidos.add(codigo);
          materiais.push({ ...materialVazio(peca.materialCodigo), descricao: `Material ${codigo}` });
        }
      });

      const convertidas: PecaForm[] = importadas.map((peca) => ({
        chave: novaChave(),
        codigo: String(peca.codigo),
        materialCodigo: String(peca.materialCodigo),
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
      }));

      const anteriores = substituir
        ? []
        : atual.pecas.filter((p) => p.largura.trim() !== '' || p.descricao.trim() !== '');

      return { ...atual, materiais, pecas: [...anteriores, ...convertidas] };
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
    setErroGeral(null);
    setMensagemOk(null);
    const payload = validar();
    if (!payload) return;

    setSalvando(true);
    try {
      const resposta = id ? await api.atualizarPedido(id, payload) : await api.criarPedido(payload);
      if (enviar) {
        await api.enviarPedido(resposta.pedido.id);
        navegar(`/app/pedidos/${resposta.pedido.id}`, { replace: true });
        return;
      }
      setMensagemOk('Rascunho salvo com sucesso.');
      if (!id) navegar(`/app/pedidos/${resposta.pedido.id}/editar`, { replace: true });
    } catch (falha) {
      setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar o pedido');
    } finally {
      setSalvando(false);
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
            Lance as medidas em milímetros. Salvamos como rascunho até você enviar para a central.
          </p>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => salvar(false)} carregando={salvando}>
            Salvar rascunho
          </Botao>
          <Botao onClick={() => salvar(true)} carregando={salvando}>
            Enviar para a central
          </Botao>
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
        <h2 className="mb-1 text-base font-bold text-stone-900">2. Materiais e chapas</h2>
        <p className="mb-4 text-sm text-stone-500">
          O código do material é o mesmo enviado ao Corte Certo. Use um código diferente para cada cor e
          espessura.
        </p>
        <EditorMateriais
          materiais={formulario.materiais}
          aoAlterar={alterarMaterial}
          aoAdicionar={adicionarMaterial}
          aoRemover={removerMaterial}
        />
      </section>

      <section className="cartao p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">3. Lista de peças</h2>
            <p className="text-sm text-stone-500">
              Digite, cole direto do Excel (Ctrl+V sobre a tabela) ou importe um arquivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante="secundario" onClick={() => setImportando(true)}>
              Importar CSV/TXT
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => adicionarPecas(1)}>
              + 1 peça
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => adicionarPecas(10)}>
              + 10 peças
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
        <h2 className="mb-4 text-base font-bold text-stone-900">4. Resumo do plano</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metrica rotulo="Itens" valor={resumo.totalItens} detalhe="linhas na lista" />
          <Metrica rotulo="Peças" valor={resumo.totalPecas} detalhe="somando quantidades" />
          <Metrica rotulo="Área total" valor={formatarM2(resumo.areaTotalM2)} />
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
        <VisualizacaoPlano materiais={formulario.materiais} pecas={formulario.pecas} />
      </section>

      <div className="flex flex-wrap justify-end gap-3 pb-6">
        <Botao variante="secundario" onClick={() => navegar('/app')}>
          Voltar
        </Botao>
        <Botao variante="secundario" onClick={() => salvar(false)} carregando={salvando}>
          Salvar rascunho
        </Botao>
        <Botao onClick={() => salvar(true)} carregando={salvando}>
          Enviar para a central
        </Botao>
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
