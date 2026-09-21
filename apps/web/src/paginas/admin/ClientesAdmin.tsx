import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminClienteCriarSchema,
  adminClienteSchema,
  formatarData,
  type Usuario,
} from '@cortemadepinus/shared';
import { Aviso, Botao, Campo, Carregando, Vazio } from '../../componentes/ui';
import { api, ErroApi } from '../../lib/api';

type Cliente = Usuario & { totalPedidos: number };

type FormularioCliente = {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  documento: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  senha: string;
};

type ModoModal = 'criar' | 'editar';

function formularioVazio(): FormularioCliente {
  return {
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    documento: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    senha: '',
  };
}

function formularioDoCliente(cliente: Cliente): FormularioCliente {
  return {
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone ?? '',
    empresa: cliente.empresa ?? '',
    documento: cliente.documento ?? '',
    rua: cliente.rua ?? '',
    numero: cliente.numero ?? '',
    bairro: cliente.bairro ?? '',
    cidade: cliente.cidade ?? '',
    estado: cliente.estado ?? '',
    cep: cliente.cep ?? '',
    senha: '',
  };
}

function rotuloEndereco(cliente: Cliente): string {
  const partes = [
    [cliente.rua, cliente.numero].filter(Boolean).join(', '),
    cliente.bairro,
    [cliente.cidade, cliente.estado].filter(Boolean).join(' / '),
    cliente.cep,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : '—';
}

export function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoModal | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState<FormularioCliente | null>(null);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    const atrasar = setTimeout(() => {
      api
        .listarClientes(busca || undefined)
        .then((resposta) => setClientes(resposta.itens))
        .catch((falha) => setErro(falha instanceof ErroApi ? falha.message : 'Falha ao carregar'))
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(atrasar);
  }, [busca]);

  async function alternar(cliente: Cliente) {
    try {
      const { usuario } = await api.alterarSituacaoCliente(cliente.id, !cliente.ativo);
      setClientes((atual) =>
        [...atual.map((c) => (c.id === cliente.id ? { ...c, ativo: usuario.ativo } : c))].sort(
          (a, b) => Number(a.ativo) - Number(b.ativo),
        ),
      );
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível alterar o cliente');
    }
  }

  function abrirCriacao() {
    setErro(null);
    setErrosCampos({});
    setModo('criar');
    setEditando(null);
    setFormulario(formularioVazio());
  }

  function abrirEdicao(cliente: Cliente) {
    setErro(null);
    setErrosCampos({});
    setModo('editar');
    setEditando(cliente);
    setFormulario(formularioDoCliente(cliente));
  }

  function fecharModal(forcar = false) {
    if (salvando && !forcar) return;
    setModo(null);
    setEditando(null);
    setFormulario(null);
    setErrosCampos({});
  }

  const alterarCampo =
    (campo: keyof FormularioCliente) => (evento: React.ChangeEvent<HTMLInputElement>) =>
      setFormulario((atual) => (atual ? { ...atual, [campo]: evento.target.value } : atual));

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!modo || !formulario) return;

    const schema = modo === 'criar' ? adminClienteCriarSchema : adminClienteSchema;
    const validacao = schema.safeParse(formulario);
    if (!validacao.success) {
      setErrosCampos(
        Object.fromEntries(validacao.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setErrosCampos({});
    setSalvando(true);
    try {
      if (modo === 'criar') {
        const { usuario, totalPedidos } = await api.criarCliente(validacao.data);
        setClientes((atual) => [{ ...usuario, totalPedidos }, ...atual]);
      } else if (editando) {
        const { usuario } = await api.atualizarCliente(editando.id, validacao.data);
        setClientes((atual) =>
          atual.map((c) => (c.id === usuario.id ? { ...c, ...usuario } : c)),
        );
      }
      setModo(null);
      setEditando(null);
      setFormulario(null);
      setErrosCampos({});
    } catch (falha) {
      if (falha instanceof ErroApi) {
        if (falha.detalhes?.length) {
          setErrosCampos(Object.fromEntries(falha.detalhes.map((d) => [d.campo, d.mensagem])));
        }
        setErro(falha.message);
      } else {
        setErro(
          modo === 'criar'
            ? 'Não foi possível cadastrar o cliente'
            : 'Não foi possível salvar os dados do cliente',
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  const aguardandoLiberacao = clientes.filter((c) => !c.ativo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clientes</h1>
          <p className="mt-1 text-sm text-stone-500">
            Marcenarias e profissionais cadastrados. Contas criadas pelo site ficam bloqueadas até você
            liberar o acesso.
          </p>
        </div>
        <Botao type="button" onClick={abrirCriacao}>
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
            <path d="M10 3a.75.75 0 0 1 .75.75V9.25h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5V3.75A.75.75 0 0 1 10 3Z" />
          </svg>
          Novo cliente
        </Botao>
      </div>

      <input
        className="campo max-w-sm"
        placeholder="Buscar por nome, e-mail, empresa ou cidade"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {!carregando && aguardandoLiberacao > 0 && (
        <Aviso tipo="atencao" titulo="Aguardando liberação">
          {aguardandoLiberacao === 1
            ? 'Há 1 cliente aguardando liberação para usar o sistema.'
            : `Há ${aguardandoLiberacao} clientes aguardando liberação para usar o sistema.`}{' '}
          Use o botão <strong>Liberar acesso</strong> na linha correspondente.
        </Aviso>
      )}

      {carregando ? (
        <Carregando />
      ) : clientes.length === 0 ? (
        <Vazio
          titulo="Nenhum cliente"
          descricao="Cadastre o primeiro cliente ou ajuste o critério de busca."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2 text-left font-semibold">Contato</th>
                <th className="px-3 py-2 text-left font-semibold">Endereço</th>
                <th className="px-3 py-2 text-left font-semibold">Documento</th>
                <th className="px-3 py-2 text-right font-semibold">Pedidos</th>
                <th className="px-3 py-2 text-left font-semibold">Cadastro</th>
                <th className="px-3 py-2 text-left font-semibold">Acesso</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  className={!cliente.ativo ? 'bg-amber-50/60' : undefined}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-stone-800">{cliente.nome}</p>
                    <p className="text-xs text-stone-500">{cliente.empresa || '—'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-stone-700">{cliente.email}</p>
                    <p className="text-xs text-stone-500">{cliente.telefone || '—'}</p>
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-stone-600">
                    {rotuloEndereco(cliente)}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{cliente.documento || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/admin/pedidos?busca=${encodeURIComponent(cliente.nome)}`}
                      className="font-semibold tabular-nums text-madeira-700 hover:underline"
                    >
                      {cliente.totalPedidos}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">{formatarData(cliente.criadoEm)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        cliente.ativo
                          ? 'inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          : 'inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200'
                      }
                    >
                      {cliente.ativo ? 'Liberado' : 'Aguardando liberação'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      {cliente.ativo ? (
                        <button
                          type="button"
                          onClick={() => void alternar(cliente)}
                          className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-200"
                        >
                          Bloquear acesso
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void alternar(cliente)}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
                        >
                          Liberar acesso
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirEdicao(cliente)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-madeira-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-madeira-800"
                      >
                        <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
                          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.25 8.25a.75.75 0 0 1-.265.177l-3.25 1.083a.5.5 0 0 1-.634-.634l1.083-3.25a.75.75 0 0 1 .177-.265l8.25-8.25Z" />
                        </svg>
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modo && formulario && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={(e) => void salvar(e)} className="cartao my-8 w-full max-w-2xl p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  {modo === 'criar' ? 'Novo cliente' : 'Editar cliente'}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {modo === 'criar'
                    ? 'Cadastre a marcenaria ou profissional com dados de contato e endereço.'
                    : 'Atualize os dados cadastrais desta marcenaria ou profissional.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fecharModal()}
                className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  rotulo="Nome completo *"
                  value={formulario.nome}
                  onChange={alterarCampo('nome')}
                  erro={errosCampos.nome}
                />
                <Campo
                  rotulo="E-mail *"
                  type="email"
                  value={formulario.email}
                  onChange={alterarCampo('email')}
                  erro={errosCampos.email}
                />
                <Campo
                  rotulo="Telefone / WhatsApp"
                  value={formulario.telefone}
                  onChange={alterarCampo('telefone')}
                  erro={errosCampos.telefone}
                />
                <Campo
                  rotulo="CPF / CNPJ"
                  value={formulario.documento}
                  onChange={alterarCampo('documento')}
                  erro={errosCampos.documento}
                />
                <div className="sm:col-span-2">
                  <Campo
                    rotulo="Empresa / Marcenaria"
                    value={formulario.empresa}
                    onChange={alterarCampo('empresa')}
                    erro={errosCampos.empresa}
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Endereço
                </p>
                <div className="grid gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-4">
                    <Campo
                      rotulo="Rua"
                      value={formulario.rua}
                      onChange={alterarCampo('rua')}
                      erro={errosCampos.rua}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Campo
                      rotulo="Número"
                      value={formulario.numero}
                      onChange={alterarCampo('numero')}
                      erro={errosCampos.numero}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Campo
                      rotulo="Bairro"
                      value={formulario.bairro}
                      onChange={alterarCampo('bairro')}
                      erro={errosCampos.bairro}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Campo
                      rotulo="Cidade"
                      value={formulario.cidade}
                      onChange={alterarCampo('cidade')}
                      erro={errosCampos.cidade}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Campo
                      rotulo="Estado (UF)"
                      value={formulario.estado}
                      onChange={alterarCampo('estado')}
                      erro={errosCampos.estado}
                      maxLength={2}
                      placeholder="MG"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Campo
                      rotulo="CEP"
                      value={formulario.cep}
                      onChange={alterarCampo('cep')}
                      erro={errosCampos.cep}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </div>

              <Campo
                rotulo={modo === 'criar' ? 'Senha de acesso *' : 'Nova senha'}
                type="password"
                autoComplete="new-password"
                value={formulario.senha}
                onChange={alterarCampo('senha')}
                erro={errosCampos.senha}
                ajuda={
                  modo === 'criar'
                    ? 'Mínimo de 8 caracteres. O cliente usará esta senha para entrar.'
                    : 'Deixe em branco para manter a senha atual.'
                }
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Botao type="button" variante="secundario" onClick={() => fecharModal()} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={salvando}>
                {modo === 'criar' ? 'Cadastrar cliente' : 'Salvar alterações'}
              </Botao>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
