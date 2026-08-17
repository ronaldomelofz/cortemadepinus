import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatarData, type Usuario } from '@cortemadepinus/shared';
import { Aviso, Carregando, Vazio } from '../../componentes/ui';
import { api, ErroApi } from '../../lib/api';

type Cliente = Usuario & { totalPedidos: number };

export function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
        atual.map((c) => (c.id === cliente.id ? { ...c, ativo: usuario.ativo } : c)),
      );
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível alterar o cliente');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Clientes</h1>
        <p className="mt-1 text-sm text-stone-500">
          Marcenarias e profissionais cadastrados na plataforma.
        </p>
      </div>

      <input
        className="campo max-w-sm"
        placeholder="Buscar por nome, e-mail ou empresa"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <Carregando />
      ) : clientes.length === 0 ? (
        <Vazio titulo="Nenhum cliente" descricao="Ainda não há clientes com esse critério de busca." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2 text-left font-semibold">Contato</th>
                <th className="px-3 py-2 text-left font-semibold">Documento</th>
                <th className="px-3 py-2 text-right font-semibold">Pedidos</th>
                <th className="px-3 py-2 text-left font-semibold">Cadastro</th>
                <th className="px-3 py-2 text-right font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-stone-800">{cliente.nome}</p>
                    <p className="text-xs text-stone-500">{cliente.empresa || '—'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-stone-700">{cliente.email}</p>
                    <p className="text-xs text-stone-500">{cliente.telefone || '—'}</p>
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
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void alternar(cliente)}
                      className={
                        cliente.ativo
                          ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          : 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200'
                      }
                    >
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
