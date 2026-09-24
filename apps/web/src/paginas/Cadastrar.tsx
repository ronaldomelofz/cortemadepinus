import { useState } from 'react';
import { Link } from 'react-router-dom';
import { registroFormularioSchema } from '@cortemadepinus/shared';
import { Marca } from '../componentes/Layout';
import { Aviso, Botao, Campo } from '../componentes/ui';
import { ErroApi } from '../lib/api';
import { useSessao } from '../lib/sessao';

const INICIAL = {
  nome: '',
  email: '',
  senha: '',
  confirmarSenha: '',
  telefone: '',
  empresa: '',
  documento: '',
};

export function Cadastrar() {
  const { cadastrar } = useSessao();
  const [dados, setDados] = useState(INICIAL);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const alterar = (campo: keyof typeof INICIAL) => (evento: React.ChangeEvent<HTMLInputElement>) =>
    setDados((atual) => ({ ...atual, [campo]: evento.target.value }));

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErroGeral(null);
    setSucesso(null);

    const validacao = registroFormularioSchema.safeParse(dados);
    if (!validacao.success) {
      setErros(
        Object.fromEntries(validacao.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      const { confirmarSenha: _confirmacao, ...registro } = validacao.data;
      const resultado = await cadastrar(registro);
      setSucesso(resultado.mensagem);
      setDados(INICIAL);
    } catch (falha) {
      setErroGeral(falha instanceof ErroApi ? falha.message : 'Não foi possível criar a conta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 py-10">
      <Marca />
      <form onSubmit={submeter} className="cartao mt-6 w-full max-w-xl space-y-4 p-7">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Criar conta de cliente</h1>
          <p className="mt-1 text-sm text-stone-500">
            Após o cadastro, a central MadePinus precisa liberar o acesso antes do primeiro login.
          </p>
        </div>

        {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}
        {sucesso && (
          <Aviso tipo="sucesso" titulo="Cadastro recebido">
            {sucesso}{' '}
            <Link to="/entrar" className="font-semibold underline">
              Ir para Entrar
            </Link>
          </Aviso>
        )}

        {!sucesso && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Nome completo *" value={dados.nome} onChange={alterar('nome')} erro={erros.nome} />
              <Campo
                rotulo="E-mail *"
                type="email"
                autoComplete="email"
                value={dados.email}
                onChange={alterar('email')}
                erro={erros.email}
              />
              <Campo
                rotulo="Senha *"
                type="password"
                autoComplete="new-password"
                value={dados.senha}
                onChange={alterar('senha')}
                erro={erros.senha}
                ajuda="Mínimo de 8 caracteres"
              />
              <Campo
                rotulo="Confirmar senha *"
                type="password"
                autoComplete="new-password"
                value={dados.confirmarSenha}
                onChange={alterar('confirmarSenha')}
                erro={erros.confirmarSenha}
              />
              <Campo rotulo="Telefone / WhatsApp" value={dados.telefone} onChange={alterar('telefone')} />
              <Campo rotulo="Empresa / Marcenaria" value={dados.empresa} onChange={alterar('empresa')} />
              <Campo rotulo="CPF / CNPJ" value={dados.documento} onChange={alterar('documento')} />
            </div>

            <Botao type="submit" carregando={enviando} className="w-full">
              Criar conta
            </Botao>
          </>
        )}

        <p className="text-center text-sm text-stone-500">
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-madeira-700 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
