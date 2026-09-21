import clsx from 'clsx';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { apiMalConfigurada } from '../lib/api';
import { useSessao } from '../lib/sessao';

/** Aviso exibido quando o site publicado ainda aponta para a API local. */
export function AvisoConfiguracao() {
  if (!apiMalConfigurada) return null;
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      Este site ainda não está ligado ao servidor da central. Defina a variável{' '}
      <code className="rounded bg-amber-100/70 px-1 font-mono">VITE_API_URL</code> no Netlify com o endereço
      público da API e refaça o deploy.
    </div>
  );
}

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-madeira-700 text-madeira-100 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h12M3 18h15" strokeLinecap="round" />
          <path d="M17 10l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={clsx('block text-base font-extrabold tracking-tight', claro ? 'text-white' : 'text-stone-900')}>
          MadePinus
        </span>
        <span className={clsx('block text-[11px] font-medium', claro ? 'text-madeira-200' : 'text-stone-500')}>
          Central de Serviços de Corte
        </span>
      </span>
    </Link>
  );
}

const LINKS_CLIENTE = [
  { para: '/app', rotulo: 'Meus pedidos', fim: true },
  { para: '/app/novo', rotulo: 'Novo plano de corte' },
  { para: '/app/perfil', rotulo: 'Meus dados' },
];

const LINKS_VENDEDOR = [
  { para: '/vendedor', rotulo: 'Meus pedidos', fim: true },
  { para: '/vendedor/novo', rotulo: 'Novo plano de corte' },
  { para: '/vendedor/perfil', rotulo: 'Meus dados' },
];

const LINKS_ADMIN = [
  { para: '/admin', rotulo: 'Painel', fim: true },
  { para: '/admin/novo', rotulo: 'Novo plano de corte' },
  { para: '/admin/pedidos', rotulo: 'Pedidos' },
  { para: '/admin/clientes', rotulo: 'Clientes' },
  { para: '/admin/cadastros', rotulo: 'Cadastros' },
];

const LINKS_OPERADOR = [{ para: '/operador', rotulo: 'Fila de produção', fim: true }];

export function LayoutApp() {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();
  const ehAdmin = usuario?.role === 'ADMIN';
  const ehOperador = usuario?.role === 'OPERADOR';
  const ehVendedor = usuario?.role === 'VENDEDOR';
  const links = ehAdmin
    ? LINKS_ADMIN
    : ehOperador
      ? LINKS_OPERADOR
      : ehVendedor
        ? LINKS_VENDEDOR
        : LINKS_CLIENTE;

  return (
    <div className="min-h-screen bg-transparent">
      <AvisoConfiguracao />
      <header className="sticky top-0 z-30 border-b border-madeira-200/60 bg-white/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3.5">
          <Marca />

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.para}
                to={link.para}
                end={link.fim}
                className={({ isActive }) =>
                  clsx(
                    'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-madeira-700 text-white shadow-sm shadow-madeira-700/25'
                      : 'text-stone-600 hover:bg-madeira-100/80 hover:text-madeira-900',
                  )
                }
              >
                {link.rotulo}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-stone-800">{usuario?.nome}</p>
              <p className="text-xs text-stone-500">
                {ehAdmin
                  ? 'Central de serviços'
                  : ehOperador
                    ? 'Operador de produção'
                    : ehVendedor
                      ? 'Vendedor'
                      : (usuario?.empresa ?? 'Cliente')}
              </p>
            </div>
            <button
              onClick={() => {
                sair();
                navegar('/entrar');
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            >
              Sair
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-madeira-100/80 px-4 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.para}
              to={link.para}
              end={link.fim}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold',
                  isActive ? 'bg-madeira-700 text-white' : 'text-stone-600',
                )
              }
            >
              {link.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-2 text-xs text-stone-500/80">
        MadePinus · Planos de corte no padrão Corte MadePinus · Corte em seccionadora
      </footer>
    </div>
  );
}
