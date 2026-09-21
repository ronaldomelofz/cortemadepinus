import { type ReactNode } from 'react';
import clsx from 'clsx';
import { VEIO_LABEL, type ProdutoMdf, type Veio } from '@cortemadepinus/shared';
import { type MaterialForm, type PecaForm } from '../lib/formularioPedido';
import { SeletorMaterialBusca } from './SeletorMaterialBusca';

/** Aceita só dígitos (quantidade, largura e altura em mm inteiros). */
function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Veio definido pelo cadastro do produto (não editável no plano). */
export function veioDoMaterial(permiteRotacao: boolean | undefined): Veio {
  return permiteRotacao === false ? 'COMPRIMENTO' : 'INDIFERENTE';
}

function Cabecalho({
  children,
  alinhamento = 'left',
  dica,
}: {
  children: ReactNode;
  alinhamento?: 'left' | 'right' | 'center';
  dica?: string;
}) {
  return (
    <th
      className={clsx(
        'border-r border-white/10 px-2.5 py-0 font-semibold last:border-r-0',
        alinhamento === 'right' && 'text-right',
        alinhamento === 'center' && 'text-center',
        alinhamento === 'left' && 'text-left',
      )}
    >
      <div
        className={clsx(
          'flex min-h-11 flex-col justify-center gap-0.5',
          alinhamento === 'right' && 'items-end',
          alinhamento === 'center' && 'items-center',
          alinhamento === 'left' && 'items-start',
        )}
      >
        <span className="leading-none">{children}</span>
        {dica ? (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-madeira-100/90">
            {dica}
          </span>
        ) : null}
      </div>
    </th>
  );
}

interface Props {
  pecas: PecaForm[];
  materiais: MaterialForm[];
  produtosCatalogo?: ProdutoMdf[];
  erros: Record<number, string>;
  /** Chaves das peças recém-incluídas — recebem destaque visual. */
  chavesDestaque?: Set<string>;
  aoAlterar: (indice: number, campo: keyof PecaForm, valor: string | boolean) => void;
  aoRemover: (indice: number) => void;
  aoDuplicar: (indice: number) => void;
  aoColar: (texto: string) => void;
}

export function TabelaPecas({
  pecas,
  materiais,
  produtosCatalogo = [],
  erros,
  chavesDestaque,
  aoAlterar,
  aoRemover,
  aoDuplicar,
  aoColar,
}: Props) {
  return (
    <div
      className="overflow-x-auto rounded-2xl border border-stone-200/90 bg-white shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]"
      onPaste={(evento) => {
        const texto = evento.clipboardData.getData('text/plain');
        if (texto.includes('\n') || texto.includes('\t')) {
          evento.preventDefault();
          aoColar(texto);
        }
      }}
    >
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[52px]" />
          <col className="w-[72px]" />
          <col className="w-[22%]" />
          <col className="w-[72px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col />
          <col className="w-[132px]" />
          <col className="w-[76px]" />
        </colgroup>

        <thead className="sticky top-0 z-10 bg-madeira-800 text-[10px] uppercase tracking-[0.12em] text-white shadow-[0_1px_0_rgb(63_38_21/0.35)]">
          <tr className="bg-gradient-to-b from-madeira-700 to-madeira-800">
            <Cabecalho alinhamento="center">#</Cabecalho>
            <Cabecalho>Cód.</Cabecalho>
            <Cabecalho>Material</Cabecalho>
            <Cabecalho alinhamento="right">Qtd</Cabecalho>
            <Cabecalho alinhamento="right" dica="máx. 1850 mm">
              Largura
            </Cabecalho>
            <Cabecalho alinhamento="right" dica="máx. 2750 mm">
              Altura
            </Cabecalho>
            <Cabecalho>Descrição</Cabecalho>
            <Cabecalho>Veio</Cabecalho>
            <Cabecalho alinhamento="center">Ações</Cabecalho>
          </tr>
        </thead>

        <tbody>
          {pecas.map((peca, indice) => {
            const erro = erros[indice];
            const nova = chavesDestaque?.has(peca.chave);
            return (
              <tr
                key={peca.chave}
                className={clsx(
                  'align-middle border-b border-stone-100 transition-colors last:border-b-0',
                  erro && 'bg-rose-50/70',
                  !erro && nova && 'linha-peca-nova',
                  !erro && !nova && indice % 2 === 1 && 'bg-stone-50/70',
                  !erro && !nova && indice % 2 === 0 && 'bg-white',
                )}
              >
                <td className="px-2 py-2 text-center">
                  <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-madeira-100/80 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-madeira-800">
                    {indice + 1}
                  </span>
                  {nova && (
                    <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-madeira-600">
                      nova
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    value={peca.codigo}
                    onChange={(e) => aoAlterar(indice, 'codigo', e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <SeletorMaterialBusca
                    materiais={materiais}
                    produtosCatalogo={produtosCatalogo}
                    valor={peca.materialCodigo}
                    onChange={(codigo) => {
                      aoAlterar(indice, 'materialCodigo', codigo);
                      const material = materiais.find((m) => m.codigo === codigo);
                      const produto = produtosCatalogo.find((p) => String(p.codigo) === codigo);
                      const permiteRotacao =
                        material?.permiteRotacao ??
                        (produto ? produto.permiteRotacao !== false : undefined);
                      aoAlterar(indice, 'veio', veioDoMaterial(permiteRotacao));
                    }}
                    onAvancar={() => {
                      const proximo = document.querySelector<HTMLInputElement>(
                        `input[data-campo="quantidade-${indice}"]`,
                      );
                      proximo?.focus();
                      proximo?.select();
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    data-campo={`quantidade-${indice}`}
                    value={peca.quantidade}
                    onChange={(e) => aoAlterar(indice, 'quantidade', soDigitos(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const proximo = document.querySelector<HTMLInputElement>(
                        `input[data-campo="largura-${indice}"]`,
                      );
                      proximo?.focus();
                      proximo?.select();
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="mm"
                    data-campo={`largura-${indice}`}
                    value={peca.largura}
                    onChange={(e) => aoAlterar(indice, 'largura', soDigitos(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const proximo = document.querySelector<HTMLInputElement>(
                        `input[data-campo="altura-${indice}"]`,
                      );
                      proximo?.focus();
                      proximo?.select();
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="mm"
                    data-campo={`altura-${indice}`}
                    value={peca.altura}
                    onChange={(e) => aoAlterar(indice, 'altura', soDigitos(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const proximo = document.querySelector<HTMLInputElement>(
                        `input[data-campo="descricao-${indice}"]`,
                      );
                      proximo?.focus();
                      proximo?.select();
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="celula-texto"
                    placeholder="Ex.: lateral do armário"
                    data-campo={`descricao-${indice}`}
                    value={peca.descricao}
                    onChange={(e) => aoAlterar(indice, 'descricao', e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const material = materiais.find((m) => m.codigo === peca.materialCodigo);
                    const veio = veioDoMaterial(material?.permiteRotacao);
                    return (
                      <span
                        className="block truncate rounded-lg border border-madeira-100 bg-madeira-50 px-2.5 py-2 text-xs font-medium text-madeira-800"
                        title="Definido no cadastro do produto — não pode ser alterado no plano"
                      >
                        {VEIO_LABEL[veio]}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-1.5 py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      title="Duplicar peça"
                      onClick={() => aoDuplicar(indice)}
                      className="rounded-lg p-1.5 text-stone-400 transition hover:bg-madeira-50 hover:text-madeira-700"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 012-2h10" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Remover peça"
                      onClick={() => aoRemover(indice)}
                      className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 7h12M10 11v6M14 11v6M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {Object.keys(erros).length > 0 && (
        <ul className="space-y-1 border-t border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {Object.entries(erros).map(([indice, mensagem]) => (
            <li key={indice}>
              <strong>Linha {Number(indice) + 1}:</strong> {mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
