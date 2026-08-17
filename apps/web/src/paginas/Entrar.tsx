import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Marca } from '../componentes/Layout';
import { Aviso, Botao, Campo } from '../componentes/ui';
import { ErroApi } from '../lib/api';
import { useSessao } from '../lib/sessao';

const LOCAL = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const ACESSOS_TESTE = {
  central: { email: 'admin@madepinus.com.br', senha: 'MudarEsteAcesso1' },
  cliente: { email: 'cliente@exemplo.com.br', senha: 'cliente12345' },
} as const;

export function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [parametros] = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function autenticar(emailAcesso: string, senhaAcesso: string) {
    setErro(null);
    setEnviando(true);
    try {
      const usuario = await entrar(emailAcesso, senhaAcesso);
      const destinoOriginal = (local.state as { de?: string } | null)?.de;
      navegar(destinoOriginal ?? (usuario.role === 'ADMIN' ? '/admin' : '/app'), { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar');
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!LOCAL) return;
    const teste = parametros.get('teste');
    if (teste === 'central') void autenticar(ACESSOS_TESTE.central.email, ACESSOS_TESTE.central.senha);
    if (teste === 'cliente') void autenticar(ACESSOS_TESTE.cliente.email, ACESSOS_TESTE.cliente.senha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    await autenticar(email, senha);
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

        {LOCAL && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Acesso de teste (local)</p>
            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="secundario"
                carregando={enviando}
                onClick={() => void autenticar(ACESSOS_TESTE.central.email, ACESSOS_TESTE.central.senha)}
              >
                Entrar como central
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                carregando={enviando}
                onClick={() => void autenticar(ACESSOS_TESTE.cliente.email, ACESSOS_TESTE.cliente.senha)}
              >
                Entrar como cliente
              </Botao>
            </div>
          </div>
        )}

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
