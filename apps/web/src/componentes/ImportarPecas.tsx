import { useMemo, useState } from 'react';
import { importarPecas, type PecaImportada } from '@cortemadepinus/shared';
import { Aviso, Botao } from './ui';

interface Props {
  materialPadrao: string;
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: (pecas: PecaImportada[], substituir: boolean) => void;
}

const EXEMPLO = `1,4,700,350,99000,Lateral armario
2,2,1200,350,99000,Fundo armario
3,6,397,700,99001,Porta`;

export function ImportarPecas({ materialPadrao, aberto, aoFechar, aoConfirmar }: Props) {
  const [conteudo, setConteudo] = useState('');
  const [substituir, setSubstituir] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  const resultado = useMemo(
    () => (conteudo.trim() ? importarPecas(conteudo, { materialPadrao: Number(materialPadrao) || 99000 }) : null),
    [conteudo, materialPadrao],
  );

  if (!aberto) return null;

  async function lerArquivo(arquivo: File) {
    setNomeArquivo(arquivo.name);
    setConteudo(await arquivo.text());
  }

  function fechar() {
    setConteudo('');
    setNomeArquivo(null);
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 backdrop-blur-sm">
      <div className="cartao my-8 w-full max-w-3xl p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Importar lista de peças</h2>
            <p className="mt-1 text-sm text-stone-500">
              Aceita arquivos CSV/TXT no layout do Corte MadePinus ou dados copiados do Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <Aviso tipo="info" titulo="Ordem esperada das colunas">
          <p>
            <code className="rounded bg-white/70 px-1">
              código, quantidade, largura, altura, código do material, descrição
            </code>
          </p>
          <p className="text-xs">
            O separador (vírgula, ponto e vírgula ou TAB) é detectado automaticamente. Linhas iniciadas por
            &quot;/&quot; ou &quot;#&quot; são ignoradas, assim como o cabeçalho.
          </p>
        </Aviso>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
            </svg>
            Escolher arquivo
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void lerArquivo(arquivo);
              }}
            />
          </label>
          {nomeArquivo && <span className="text-xs text-stone-500">{nomeArquivo}</span>}
          <button
            type="button"
            onClick={() => setConteudo(EXEMPLO)}
            className="text-xs font-semibold text-madeira-700 hover:underline"
          >
            usar exemplo
          </button>
        </div>

        <textarea
          className="campo mt-3 min-h-40 font-mono text-xs"
          placeholder="Cole aqui as linhas copiadas do Excel ou o conteúdo do arquivo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
        />

        {resultado && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-semibold text-emerald-700">
                {resultado.pecas.length} peça(s) reconhecida(s)
              </span>
              {resultado.erros.length > 0 && (
                <span className="font-semibold text-rose-600">
                  {resultado.erros.length} linha(s) ignorada(s)
                </span>
              )}
              <span className="text-stone-500">
                Separador detectado: {resultado.separador === '\t' ? 'TAB' : `"${resultado.separador}"`}
              </span>
            </div>

            {resultado.erros.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {resultado.erros.slice(0, 20).map((erro) => (
                  <p key={erro.linha}>
                    Linha {erro.linha}: {erro.mensagem}
                  </p>
                ))}
              </div>
            )}

            {resultado.pecas.length > 0 && <Previa pecas={resultado.pecas} />}
          </div>
        )}

        <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            className="size-4 rounded border-stone-300 text-madeira-700 focus:ring-madeira-500"
            checked={substituir}
            onChange={(e) => setSubstituir(e.target.checked)}
          />
          Substituir as peças já lançadas (em vez de adicionar ao final)
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <Botao type="button" variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao
            type="button"
            disabled={!resultado || resultado.pecas.length === 0}
            onClick={() => {
              if (resultado) aoConfirmar(resultado.pecas, substituir);
              fechar();
            }}
          >
            Importar {resultado?.pecas.length ? `${resultado.pecas.length} peça(s)` : ''}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function Previa({ pecas }: { pecas: PecaImportada[] }) {
  return (
    <div className="max-h-56 overflow-auto rounded-lg border border-stone-200">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-stone-100 text-stone-500">
          <tr>
            <th className="px-2 py-1.5 text-left">Cód.</th>
            <th className="px-2 py-1.5 text-right">Qtd</th>
            <th className="px-2 py-1.5 text-right">Largura</th>
            <th className="px-2 py-1.5 text-right">Altura</th>
            <th className="px-2 py-1.5 text-right">Material</th>
            <th className="px-2 py-1.5 text-left">Descrição</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {pecas.slice(0, 100).map((peca, indice) => (
            <tr key={`${peca.codigo}-${indice}`}>
              <td className="px-2 py-1 tabular-nums">{peca.codigo}</td>
              <td className="px-2 py-1 text-right tabular-nums">{peca.quantidade}</td>
              <td className="px-2 py-1 text-right tabular-nums">{peca.largura}</td>
              <td className="px-2 py-1 text-right tabular-nums">{peca.altura}</td>
              <td className="px-2 py-1 text-right tabular-nums">{peca.materialCodigo}</td>
              <td className="px-2 py-1">{peca.descricao}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pecas.length > 100 && (
        <p className="bg-stone-50 px-2 py-1 text-center text-[11px] text-stone-500">
          Mostrando as 100 primeiras de {pecas.length} peças.
        </p>
      )}
    </div>
  );
}
