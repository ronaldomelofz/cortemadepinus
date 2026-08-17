import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { STATUS_COR, STATUS_LABEL, type StatusPedido } from '@cortemadepinus/shared';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-madeira-700 text-white hover:bg-madeira-800 focus-visible:outline-madeira-700 disabled:bg-madeira-300',
  secundario:
    'bg-white text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  perigo: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  fantasma: 'bg-transparent text-stone-600 hover:bg-stone-100',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
}

export function Botao({ variante = 'primario', carregando, className, children, ...props }: BotaoProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  ajuda?: string;
}

export function Campo({ rotulo, erro, ajuda, className, ...props }: CampoProps) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input {...props} className={clsx('campo', erro && 'border-rose-400 ring-rose-100', className)} />
      {ajuda && !erro && <span className="mt-1 block text-xs text-stone-500">{ajuda}</span>}
      {erro && <span className="mt-1 block text-xs font-medium text-rose-600">{erro}</span>}
    </label>
  );
}

interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string;
  erro?: string;
}

export function AreaTexto({ rotulo, erro, className, ...props }: AreaTextoProps) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <textarea {...props} className={clsx('campo min-h-24', erro && 'border-rose-400', className)} />
      {erro && <span className="mt-1 block text-xs font-medium text-rose-600">{erro}</span>}
    </label>
  );
}

export function EtiquetaStatus({ status }: { status: StatusPedido }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        STATUS_COR[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Aviso({
  tipo = 'info',
  titulo,
  children,
}: {
  tipo?: 'info' | 'erro' | 'sucesso' | 'atencao';
  titulo?: string;
  children: ReactNode;
}) {
  const cores = {
    info: 'bg-blue-50 text-blue-800 ring-blue-200',
    erro: 'bg-rose-50 text-rose-800 ring-rose-200',
    sucesso: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    atencao: 'bg-amber-50 text-amber-900 ring-amber-200',
  }[tipo];

  return (
    <div className={clsx('rounded-xl px-4 py-3 text-sm ring-1 ring-inset', cores)}>
      {titulo && <p className="mb-1 font-semibold">{titulo}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-stone-500">
      <span className="size-5 animate-spin rounded-full border-2 border-madeira-500 border-t-transparent" />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return (
    <div className="cartao flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-madeira-100 text-madeira-700">
        <svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h10M4 17h13" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-base font-semibold text-stone-800">{titulo}</p>
      <p className="max-w-md text-sm text-stone-500">{descricao}</p>
      {acao}
    </div>
  );
}

export function Metrica({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
}) {
  return (
    <div className="cartao px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{valor}</p>
      {detalhe && <p className="text-xs text-stone-500">{detalhe}</p>}
    </div>
  );
}
