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

const LINKS_ADMIN = [
  { para: '/admin', rotulo: 'Painel', fim: true },
  { para: '/admin/pedidos', rotulo: 'Pedidos' },
  { para: '/admin/clientes', rotulo: 'Clientes' },
  { para: '/admin/cadastros', rotulo: 'Cadastros' },
];

export function LayoutApp() {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();
  const ehAdmin = usuario?.role === 'ADMIN';
  const links = ehAdmin ? LINKS_ADMIN : LINKS_CLIENTE;

  return (
    <div className="min-h-screen bg-stone-50">
      <AvisoConfiguracao />
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Marca />

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.para}
                to={link.para}
                end={link.fim}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-madeira-50 text-madeira-800' : 'text-stone-600 hover:bg-stone-100',
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
                {ehAdmin ? 'Central de serviços' : (usuario?.empresa ?? 'Cliente')}
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

        <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-4 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.para}
              to={link.para}
              end={link.fim}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-madeira-50 text-madeira-800' : 'text-stone-600',
                )
              }
            >
              {link.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-xs text-stone-400">
        MadePinus · Planos de corte no padrão Corte Certo · Corte em seccionadora
      </footer>
    </div>
  );
}
