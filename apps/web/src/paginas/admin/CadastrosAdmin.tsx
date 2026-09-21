import { useEffect, useState } from 'react';
import {
  formatarMoeda,
  SERRA_PADRAO_MM,
  VALOR_CORTE_PADRAO,
  type ConfiguracaoCorte,
  type ProdutoMdf,
} from '@cortemadepinus/shared';
import { Aviso, Botao, Campo, Carregando, Vazio } from '../../componentes/ui';
import { api, ErroApi } from '../../lib/api';

interface FormProduto {
  codigo: string;
  nome: string;
  cor: string;
  espessura: string;
  largura: string;
  comprimento: string;
  valorUnitario: string;
  permiteRotacao: boolean;
}

const produtoVazio = (): FormProduto => ({
  codigo: '',
  nome: '',
  cor: '',
  espessura: '15',
  largura: '1850',
  comprimento: '2750',
  valorUnitario: '0',
  permiteRotacao: true,
});

function numero(texto: string): number {
  const limpo = String(texto)
    .trim()
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '');
  if (!limpo) return Number.NaN;
  // Aceita 180 | 180,50 | 1.180,50
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function CadastrosAdmin() {
  const [produtos, setProdutos] = useState<ProdutoMdf[]>([]);
  const [config, setConfig] = useState<ConfiguracaoCorte | null>(null);
  const [serraMm, setSerraMm] = useState(String(SERRA_PADRAO_MM).replace('.', ','));
  const [valorCorte, setValorCorte] = useState(String(VALOR_CORTE_PADRAO).replace('.', ','));
  const [form, setForm] = useState<FormProduto>(produtoVazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function recarregarProdutos(filtro = busca) {
    const lista = await api.listarProdutosAdmin(filtro || undefined);
    setProdutos(lista.itens);
  }

  useEffect(() => {
    setCarregando(true);
    api
      .obterConfiguracaoAdmin()
      .then((conf) => {
        setConfig(conf.configuracao);
        setSerraMm(String(conf.configuracao.serraMm).replace('.', ','));
        setValorCorte(String(conf.configuracao.valorCorte).replace('.', ','));
      })
      .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar cadastros'));
  }, []);

  useEffect(() => {
    setCarregando(true);
    const atrasar = setTimeout(() => {
      recarregarProdutos()
        .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar cadastros'))
        .finally(() => setCarregando(false));
    }, 200);
    return () => clearTimeout(atrasar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  async function salvarConfiguracao() {
    setErro(null);
    setOk(null);
    const serra = numero(serraMm);
    const valor = numero(valorCorte);
    if (!Number.isFinite(serra) || !Number.isFinite(valor)) {
      setErro('Informe a espessura da serra e o valor do corte em números.');
      return;
    }
    setSalvandoConfig(true);
    try {
      const { configuracao } = await api.salvarConfiguracao({ serraMm: serra, valorCorte: valor });
      setConfig(configuracao);
      setOk('Parâmetros de corte salvos. O plano e o orçamento passam a usar estes valores.');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar a configuração');
    } finally {
      setSalvandoConfig(false);
    }
  }

  function preencher(produto: ProdutoMdf) {
    setEditandoId(produto.id);
    setForm({
      codigo: String(produto.codigo),
      nome: produto.nome,
      cor: produto.cor,
      espessura: String(produto.espessura).replace('.', ','),
      largura: String(produto.largura),
      comprimento: String(produto.comprimento),
      valorUnitario: String(produto.valorUnitario).replace('.', ','),
      permiteRotacao: produto.permiteRotacao !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function limparFormulario() {
    setEditandoId(null);
    setForm(produtoVazio());
  }

  async function salvarProduto() {
    setErro(null);
    setOk(null);
    const payload = {
      codigo: form.codigo.trim() ? numero(form.codigo) : undefined,
      nome: form.nome,
      cor: form.cor,
      espessura: numero(form.espessura),
      largura: numero(form.largura),
      comprimento: numero(form.comprimento),
      valorUnitario: numero(form.valorUnitario),
      permiteRotacao: form.permiteRotacao,
    };
    if (!Number.isFinite(payload.valorUnitario) || payload.valorUnitario < 0) {
      setErro('Informe o valor unitário da chapa em reais (0 ou maior).');
      return;
    }
    setSalvandoProduto(true);
    try {
      if (editandoId) {
        await api.atualizarProduto(editandoId, payload);
        setOk('Produto atualizado.');
      } else {
        await api.criarProduto(payload);
        setOk('Produto cadastrado. Os clientes já podem escolhê-lo no plano de corte.');
      }
      limparFormulario();
      await recarregarProdutos();
    } catch (falha) {
      if (falha instanceof ErroApi) {
        const detalhe = falha.detalhes?.map((d) => d.mensagem).join(' ');
        setErro(detalhe ? `${falha.message}: ${detalhe}` : falha.message);
      } else {
        setErro('Não foi possível salvar o produto');
      }
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function alternarAtivo(produto: ProdutoMdf) {
    try {
      const { produto: atualizado } = await api.alterarSituacaoProduto(produto.id, !produto.ativo);
      setProdutos((atual) => atual.map((item) => (item.id === produto.id ? atualizado : item)));
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível alterar o produto');
    }
  }

  async function excluir(produto: ProdutoMdf) {
    if (!confirm(`Excluir o MDF "${produto.nome}"? Pedidos já enviados não são alterados.`)) return;
    try {
      await api.excluirProduto(produto.id);
      if (editandoId === produto.id) limparFormulario();
      await recarregarProdutos();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível excluir o produto');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Cadastros da central</h1>
        <p className="mt-1 text-sm text-stone-500">
          Produtos MDF, espessura da serra (usada no plano de corte e no aparo das bordas) e valor de cada
          corte em reais.
        </p>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {ok && <Aviso tipo="sucesso">{ok}</Aviso>}

      <section className="cartao p-5">
        <h2 className="text-base font-bold text-stone-900">Parâmetros de corte</h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          A espessura da serra entra no aproveitamento das chapas e nos cortes de aparar as bordas. O valor
          em R$ é multiplicado pela quantidade de cortes do plano.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo
            rotulo="Espessura da serra (mm)"
            inputMode="decimal"
            value={serraMm}
            onChange={(e) => setSerraMm(e.target.value)}
            ajuda="Usada entre as peças e para aparar as quatro bordas da chapa."
          />
          <Campo
            rotulo="Valor do corte (R$)"
            inputMode="decimal"
            value={valorCorte}
            onChange={(e) => setValorCorte(e.target.value)}
            ajuda="Preço de cada passe da serra, inclusive o aparo."
          />
          <div className="flex items-end">
            <Botao type="button" onClick={() => void salvarConfiguracao()} carregando={salvandoConfig}>
              Salvar parâmetros
            </Botao>
          </div>
        </div>
        {config && (
          <p className="mt-3 text-xs text-stone-500">
            Atual: serra {config.serraMm.toLocaleString('pt-BR')} mm · {formatarMoeda(config.valorCorte)} por
            corte
          </p>
        )}
      </section>

      <section className="cartao p-5">
        <h2 className="text-base font-bold text-stone-900">
          {editandoId ? 'Editar produto MDF' : 'Cadastrar produto MDF'}
        </h2>
        <p className="mt-1 mb-4 text-sm text-stone-500">
          Nome, cor, espessura, dimensões e valor unitário da chapa. O cliente vê estes dados no
          orçamento estimado (produtos + cortes).
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Campo
            rotulo="Nome *"
            placeholder="Ex.: MDF Branco TX 15 mm"
            value={form.nome}
            onChange={(e) => setForm((a) => ({ ...a, nome: e.target.value }))}
          />
          <Campo
            rotulo="Cor *"
            placeholder="Ex.: Branco TX"
            value={form.cor}
            onChange={(e) => setForm((a) => ({ ...a, cor: e.target.value }))}
          />
          <Campo
            rotulo="Espessura (mm) *"
            inputMode="decimal"
            value={form.espessura}
            onChange={(e) => setForm((a) => ({ ...a, espessura: e.target.value }))}
          />
          <Campo
            rotulo="Comprimento (mm) *"
            inputMode="decimal"
            value={form.comprimento}
            onChange={(e) => setForm((a) => ({ ...a, comprimento: e.target.value }))}
            ajuda="Lado maior da chapa. Padrão de mercado: 2750 mm."
          />
          <Campo
            rotulo="Largura (mm) *"
            inputMode="decimal"
            value={form.largura}
            onChange={(e) => setForm((a) => ({ ...a, largura: e.target.value }))}
            ajuda="Lado menor da chapa. Padrão de mercado: 1850 mm."
          />
          <Campo
            rotulo="Valor unitário (R$) *"
            inputMode="decimal"
            value={form.valorUnitario}
            onChange={(e) => setForm((a) => ({ ...a, valorUnitario: e.target.value }))}
            ajuda="Preço de uma chapa. Entra no orçamento: chapas estimadas × este valor."
          />
          <Campo
            rotulo="Código (Corte MadePinus)"
            inputMode="numeric"
            value={form.codigo}
            onChange={(e) => setForm((a) => ({ ...a, codigo: e.target.value }))}
            ajuda="Opcional. Se vazio, a central gera a partir de 99000."
          />
          <label className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 md:col-span-2 lg:col-span-3">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-stone-300 text-madeira-700 focus:ring-madeira-600"
                checked={form.permiteRotacao}
                onChange={(e) => setForm((a) => ({ ...a, permiteRotacao: e.target.checked }))}
              />
              <span>
                <span className="block text-sm font-semibold text-stone-800">
                  Chapa permite rotação de peças
                </span>
                <span className="mt-1 block text-xs text-stone-500">
                  Marque em padrões lisos (cores sólidas). Desmarque em padrões amadeirados com veio —
                  nesses casos as peças não giram no plano de corte.
                </span>
              </span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao type="button" onClick={() => void salvarProduto()} carregando={salvandoProduto}>
            {editandoId ? 'Atualizar produto' : 'Cadastrar produto'}
          </Botao>
          {editandoId && (
            <Botao type="button" variante="secundario" onClick={limparFormulario}>
              Cancelar edição
            </Botao>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-bold text-stone-900">MDFs cadastrados</h2>
          <input
            className="campo max-w-sm"
            placeholder="Buscar por nome ou cor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {carregando ? (
          <Carregando />
        ) : produtos.length === 0 ? (
          <Vazio
            titulo="Nenhum MDF cadastrado"
            descricao="Cadastre as chapas que a central trabalha para os clientes escolherem no pedido."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-stone-100 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Cód.</th>
                  <th className="px-3 py-2 text-left font-semibold">Nome</th>
                  <th className="px-3 py-2 text-left font-semibold">Cor</th>
                  <th className="px-3 py-2 text-right font-semibold">Espessura</th>
                  <th className="px-3 py-2 text-right font-semibold">Chapa</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor unit.</th>
                  <th className="px-3 py-2 text-center font-semibold">Rotação</th>
                  <th className="px-3 py-2 text-right font-semibold">Situação</th>
                  <th className="px-3 py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td className="px-3 py-2 tabular-nums text-stone-600">{produto.codigo}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{produto.nome}</td>
                    <td className="px-3 py-2 text-stone-600">{produto.cor}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{produto.espessura} mm</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {produto.comprimento} × {produto.largura} mm
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-stone-800">
                      {formatarMoeda(produto.valorUnitario)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-medium text-stone-600">
                      {produto.permiteRotacao !== false ? 'Permite' : 'Sem rotação'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void alternarAtivo(produto)}
                        className={
                          produto.ativo
                            ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200'
                            : 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200'
                        }
                      >
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-3 text-xs font-semibold text-madeira-700 hover:underline"
                        onClick={() => preencher(produto)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() => void excluir(produto)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
