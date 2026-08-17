import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Marca } from '../componentes/Layout';
import { Aviso, Botao, Campo } from '../componentes/ui';
import { ErroApi } from '../lib/api';
import { useSessao } from '../lib/sessao';

export function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const usuario = await entrar(email, senha);
      const destinoOriginal = (local.state as { de?: string } | null)?.de;
      navegar(destinoOriginal ?? (usuario.role === 'ADMIN' ? '/admin' : '/app'), { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 py-10">
      <Marca />
      <form onSubmit={submeter} className="cartao mt-6 w-full max-w-md space-y-4 p-7">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Entrar na plataforma</h1>
          <p className="mt-1 text-sm text-stone-500">Acesse para enviar e acompanhar seus planos de corte.</p>
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>

        <p className="text-center text-sm text-stone-500">
          Ainda não tem conta?{' '}
          <Link to="/cadastrar" className="font-semibold text-madeira-700 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
}
