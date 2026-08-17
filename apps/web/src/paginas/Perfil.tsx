import { useState } from 'react';
import { perfilSchema } from '@cortemadepinus/shared';
import { Aviso, Botao, Campo } from '../componentes/ui';
import { api, ErroApi } from '../lib/api';
import { useSessao } from '../lib/sessao';

export function Perfil() {
  const { usuario, atualizarUsuario } = useSessao();
  const [dados, setDados] = useState({
    nome: usuario?.nome ?? '',
    telefone: usuario?.telefone ?? '',
    empresa: usuario?.empresa ?? '',
    documento: usuario?.documento ?? '',
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const alterar = (campo: keyof typeof dados) => (evento: React.ChangeEvent<HTMLInputElement>) =>
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setMensagem(null);
    const validacao = perfilSchema.safeParse(dados);
    if (!validacao.success) {
      setErros(Object.fromEntries(validacao.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErros({});
    setSalvando(true);
    try {
      const { usuario: atualizado } = await api.atualizarPerfil(validacao.data);
      atualizarUsuario(atualizado);
      setMensagem({ tipo: 'sucesso', texto: 'Dados atualizados.' });
    } catch (falha) {
      setMensagem({
        tipo: 'erro',
        texto: falha instanceof ErroApi ? falha.message : 'Não foi possível salvar',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Meus dados</h1>
        <p className="mt-1 text-sm text-stone-500">
          Usamos essas informações para contato sobre orçamentos e retirada das peças.
        </p>
      </div>

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <form onSubmit={submeter} className="cartao space-y-4 p-5">
        <Campo rotulo="E-mail" value={usuario?.email ?? ''} disabled />
        <Campo rotulo="Nome completo" value={dados.nome} onChange={alterar('nome')} erro={erros.nome} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone / WhatsApp" value={dados.telefone} onChange={alterar('telefone')} />
          <Campo rotulo="CPF / CNPJ" value={dados.documento} onChange={alterar('documento')} />
        </div>
        <Campo rotulo="Empresa / Marcenaria" value={dados.empresa} onChange={alterar('empresa')} />
        <Botao type="submit" carregando={salvando}>
          Salvar alterações
        </Botao>
      </form>
    </div>
  );
}
