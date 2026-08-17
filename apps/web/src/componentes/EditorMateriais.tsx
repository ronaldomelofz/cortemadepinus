import { CHAPAS_PADRAO, ESPESSURAS_PADRAO, type MaterialForm } from '../lib/formularioPedido';
import { Botao } from './ui';

interface Props {
  materiais: MaterialForm[];
  aoAlterar: (indice: number, campo: keyof MaterialForm, valor: string | boolean) => void;
  aoAdicionar: () => void;
  aoRemover: (indice: number) => void;
}

export function EditorMateriais({ materiais, aoAlterar, aoAdicionar, aoRemover }: Props) {
  return (
    <div className="space-y-3">
      {materiais.map((material, indice) => (
        <div key={material.chave} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-700">
              Material {indice + 1}
              <span className="ml-2 rounded bg-madeira-100 px-2 py-0.5 text-xs font-bold text-madeira-800">
                código {material.codigo || '—'}
              </span>
            </p>
            {materiais.length > 1 && (
              <button
                type="button"
                onClick={() => aoRemover(indice)}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Remover
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="rotulo">Código (Corte Certo)</span>
              <input
                className="campo"
                inputMode="numeric"
                value={material.codigo}
                onChange={(e) => aoAlterar(indice, 'codigo', e.target.value)}
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="rotulo">Descrição do material *</span>
              <input
                className="campo"
                placeholder="Ex.: MDF Branco TX"
                value={material.descricao}
                onChange={(e) => aoAlterar(indice, 'descricao', e.target.value)}
              />
            </label>

            <label className="block">
              <span className="rotulo">Espessura (mm)</span>
              <input
                className="campo"
                list={`espessuras-${material.chave}`}
                inputMode="decimal"
                value={material.espessura}
                onChange={(e) => aoAlterar(indice, 'espessura', e.target.value)}
              />
              <datalist id={`espessuras-${material.chave}`}>
                {ESPESSURAS_PADRAO.map((valor) => (
                  <option key={valor} value={valor} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="rotulo">Cor / padrão</span>
              <input
                className="campo"
                placeholder="Ex.: Carvalho Hanover"
                value={material.cor}
                onChange={(e) => aoAlterar(indice, 'cor', e.target.value)}
              />
            </label>

            <label className="block">
              <span className="rotulo">Chapa padrão</span>
              <select
                className="campo"
                value={`${material.chapaLargura}x${material.chapaAltura}`}
                onChange={(e) => {
                  const [largura, altura] = e.target.value.split('x');
                  aoAlterar(indice, 'chapaLargura', largura);
                  aoAlterar(indice, 'chapaAltura', altura);
                }}
              >
                {CHAPAS_PADRAO.map((chapa) => (
                  <option key={chapa.rotulo} value={`${chapa.largura}x${chapa.altura}`}>
                    {chapa.rotulo}
                  </option>
                ))}
                <option value={`${material.chapaLargura}x${material.chapaAltura}`}>
                  Personalizada ({material.chapaLargura} × {material.chapaAltura})
                </option>
              </select>
            </label>

            <label className="block">
              <span className="rotulo">Chapa: largura (mm)</span>
              <input
                className="campo"
                inputMode="decimal"
                value={material.chapaLargura}
                onChange={(e) => aoAlterar(indice, 'chapaLargura', e.target.value)}
              />
            </label>

            <label className="block">
              <span className="rotulo">Chapa: altura (mm)</span>
              <input
                className="campo"
                inputMode="decimal"
                value={material.chapaAltura}
                onChange={(e) => aoAlterar(indice, 'chapaAltura', e.target.value)}
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              className="size-4 rounded border-stone-300 text-madeira-700 focus:ring-madeira-500"
              checked={material.fornecidoPeloCliente}
              onChange={(e) => aoAlterar(indice, 'fornecidoPeloCliente', e.target.checked)}
            />
            Chapa fornecida pelo cliente (serviço de corte apenas)
          </label>

          {material.fornecidoPeloCliente && (
            <label className="mt-3 block max-w-56">
              <span className="rotulo">Quantidade de chapas entregues</span>
              <input
                className="campo"
                inputMode="numeric"
                value={material.quantidadeChapas}
                onChange={(e) => aoAlterar(indice, 'quantidadeChapas', e.target.value)}
              />
            </label>
          )}
        </div>
      ))}

      <Botao type="button" variante="secundario" onClick={aoAdicionar}>
        + Adicionar material
      </Botao>
    </div>
  );
}
