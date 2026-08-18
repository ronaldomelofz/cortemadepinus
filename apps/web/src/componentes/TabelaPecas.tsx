import clsx from 'clsx';
import { VEIOS, VEIO_LABEL } from '@cortemadepinus/shared';
import { rotuloMaterial, type MaterialForm, type PecaForm } from '../lib/formularioPedido';

interface Props {
  pecas: PecaForm[];
  materiais: MaterialForm[];
  erros: Record<number, string>;
  aoAlterar: (indice: number, campo: keyof PecaForm, valor: string | boolean) => void;
  aoRemover: (indice: number) => void;
  aoDuplicar: (indice: number) => void;
  aoColar: (texto: string) => void;
}

export function TabelaPecas({
  pecas,
  materiais,
  erros,
  aoAlterar,
  aoRemover,
  aoDuplicar,
  aoColar,
}: Props) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-stone-200"
      onPaste={(evento) => {
        const texto = evento.clipboardData.getData('text/plain');
        // Colagem de varias celulas/linhas vem do Excel: trata como importacao.
        if (texto.includes('\n') || texto.includes('\t')) {
          evento.preventDefault();
          aoColar(texto);
        }
      }}
    >
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="w-10 px-2 py-2 text-left font-semibold">#</th>
            <th className="w-20 px-2 py-2 text-left font-semibold">Cód.</th>
            <th className="min-w-64 px-2 py-2 text-left font-semibold">Material</th>
            <th className="w-20 px-2 py-2 text-right font-semibold">Qtd</th>
            <th className="w-24 px-2 py-2 text-right font-semibold">Largura</th>
            <th className="w-24 px-2 py-2 text-right font-semibold">Altura</th>
            <th className="min-w-48 px-2 py-2 text-left font-semibold">Descrição</th>
            <th className="w-40 px-2 py-2 text-left font-semibold">Veio</th>
            <th className="w-16 px-2 py-2 text-center font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {pecas.map((peca, indice) => {
            const erro = erros[indice];
            return (
              <tr key={peca.chave} className={clsx('align-middle', erro && 'bg-rose-50/60')}>
                <td className="px-2 py-1.5 text-xs text-stone-400">{indice + 1}</td>
                <td className="px-2 py-1.5">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    value={peca.codigo}
                    onChange={(e) => aoAlterar(indice, 'codigo', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="celula-texto"
                    value={peca.materialCodigo}
                    onChange={(e) => aoAlterar(indice, 'materialCodigo', e.target.value)}
                  >
                    {materiais.map((material) => (
                      <option key={material.chave} value={material.codigo}>
                        {rotuloMaterial(material)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="celula-numerica"
                    inputMode="numeric"
                    value={peca.quantidade}
                    onChange={(e) => aoAlterar(indice, 'quantidade', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="celula-numerica"
                    inputMode="decimal"
                    placeholder="mm"
                    value={peca.largura}
                    onChange={(e) => aoAlterar(indice, 'largura', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="celula-numerica"
                    inputMode="decimal"
                    placeholder="mm"
                    value={peca.altura}
                    onChange={(e) => aoAlterar(indice, 'altura', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="celula-texto"
                    placeholder="Ex.: lateral do armário"
                    value={peca.descricao}
                    onChange={(e) => aoAlterar(indice, 'descricao', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="celula-texto"
                    value={peca.veio}
                    onChange={(e) => aoAlterar(indice, 'veio', e.target.value)}
                  >
                    {VEIOS.map((veio) => (
                      <option key={veio} value={veio}>
                        {VEIO_LABEL[veio]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      title="Duplicar peça"
                      onClick={() => aoDuplicar(indice)}
                      className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-madeira-700"
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
                      className="rounded p-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
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
