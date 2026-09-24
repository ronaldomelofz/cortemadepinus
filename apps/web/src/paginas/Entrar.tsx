import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Marca } from '../componentes/Layout';
import { Aviso, Botao, Campo, CampoSenha } from '../componentes/ui';
import { ErroApi } from '../lib/api';
import { destinoPorPapel } from '../lib/destino';
import {
  lembreteLogin,
  oferecerSalvarCredenciais,
  tentarPreencherCredenciaisSalvas,
} from '../lib/lembreteLogin';
import { useSessao } from '../lib/sessao';

const LOCAL = import.meta.env.DEV;

/** Atalhos só em desenvolvimento — senha da central vem do .env da API, não fica no bundle. */
const ACESSOS_TESTE = LOCAL
  ? {
      cliente: { email: 'cliente@exemplo.com.br', senha: 'cliente12345' },
    }
  : null;

export function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [parametros] = useSearchParams();
  const perfilOperador = parametros.get('perfil') === 'operador';
  const perfilCentral = parametros.get('perfil') === 'central';
  const perfilVendedor = parametros.get('perfil') === 'vendedor';
  const perfilCliente = parametros.get('perfil') === 'cliente';
  const perfilInterno = perfilOperador || perfilCentral || perfilVendedor;
  const [email, setEmail] = useState(() => lembreteLogin.lerEmail());
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(() => lembreteLogin.lembrarAtivo());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const salvo = await tentarPreencherCredenciaisSalvas();
      if (cancelado || !salvo) return;
      setEmail(salvo.email);
      setSenha(salvo.senha);
      setLembrar(true);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function autenticar(emailAcesso: string, senhaAcesso: string, persistirLembrete = lembrar) {
    setErro(null);
    setEnviando(true);
    try {
      const usuario = await entrar(emailAcesso, senhaAcesso);
      lembreteLogin.gravar(emailAcesso, persistirLembrete);
      if (persistirLembrete) {
        await oferecerSalvarCredenciais(emailAcesso, senhaAcesso);
      }
      const destinoOriginal = (local.state as { de?: string } | null)?.de;
      navegar(destinoOriginal ?? destinoPorPapel(usuario.role), { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar');
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!ACESSOS_TESTE) return;
    const teste = parametros.get('teste');
    if (teste === 'cliente') void autenticar(ACESSOS_TESTE.cliente.email, ACESSOS_TESTE.cliente.senha, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    await autenticar(email, senha, lembrar);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 py-10">
      <Marca />
      <form
        onSubmit={submeter}
        method="post"
        autoComplete="on"
        className="cartao mt-6 w-full max-w-md space-y-4 p-7"
      >
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            {perfilOperador
              ? 'Acesso do operador'
              : perfilCentral
                ? 'Acesso administrador'
                : perfilVendedor
                  ? 'Acesso do vendedor'
                  : perfilCliente
                    ? 'Acesso do cliente'
                    : 'Entrar na plataforma'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {perfilOperador
              ? 'Entre para imprimir planos, etiquetas e acompanhar o andamento do corte.'
              : perfilCentral
                ? 'Entre com a conta administrador para gerenciar pedidos, cadastros e criar planos.'
                : perfilVendedor
                  ? 'Entre para criar e enviar planos de corte, como no portal do cliente.'
                  : perfilCliente
                    ? 'Entre com seu e-mail para enviar e acompanhar seus planos de corte.'
                    : 'Acesse para enviar e acompanhar seus planos de corte.'}
          </p>
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <Campo
          rotulo={perfilInterno ? 'Usuário' : 'E-mail'}
          name="username"
          id="login-usuario"
          type={perfilInterno ? 'text' : 'email'}
          autoComplete="username"
          inputMode={perfilInterno ? 'text' : 'email'}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoSenha
          rotulo="Senha"
          name="password"
          id="login-senha"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <label className="flex items-start gap-3 rounded-xl bg-stone-50 px-3 py-3 ring-1 ring-inset ring-stone-200">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-stone-300 text-madeira-700 focus:ring-madeira-600"
            checked={lembrar}
            onChange={(e) => setLembrar(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-stone-800">
              Salvar usuário e senha neste navegador
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              O navegador guarda a senha com segurança. Na próxima visita, o acesso pode ser preenchido
              automaticamente.
            </span>
          </span>
        </label>

        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>

        {ACESSOS_TESTE && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Acesso de teste (local)
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="secundario"
                carregando={enviando}
                onClick={() =>
                  void autenticar(ACESSOS_TESTE.cliente.email, ACESSOS_TESTE.cliente.senha, false)
                }
              >
                Entrar como cliente
              </Botao>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-stone-500">
          {perfilInterno ? (
            <Link to="/" className="font-semibold text-madeira-700 hover:underline">
              Voltar ao início
            </Link>
          ) : (
            <>
              Ainda não tem conta?{' '}
              <Link to="/cadastrar" className="font-semibold text-madeira-700 hover:underline">
                Cadastre-se
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
