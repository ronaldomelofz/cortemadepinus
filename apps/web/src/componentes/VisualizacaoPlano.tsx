import { useMemo, useState } from 'react';
import {
  formatarM2,
  otimizarPlanos,
  type ChapaDoPlano,
  type ItemParaOtimizar,
  type ResultadoOtimizacao,
} from '@cortemadepinus/shared';

export interface MaterialVisual {
  codigo: number | string;
  descricao: string;
  chapaLargura: number | string;
  chapaAltura: number | string;
}

export interface PecaVisual {
  codigo: number | string;
  descricao: string;
  largura: number | string;
  altura: number | string;
  quantidade: number | string;
  materialCodigo: number | string;
  veio?: string;
}

const CORES = ['#c4a574', '#b0895a', '#d4b896', '#9a7048', '#e0c4a0', '#8b5e34', '#cdb892', '#a67c52'];

function numero(valor: number | string): number {
  if (typeof valor === 'number') return valor;
  const n = Number(String(valor).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function montarResultado(materiais: MaterialVisual[], pecas: PecaVisual[]): ResultadoOtimizacao {
  const chapas = materiais
    .map((m) => ({
      codigo: numero(m.codigo),
      descricao: m.descricao || `Material ${m.codigo}`,
      largura: numero(m.chapaLargura),
      altura: numero(m.chapaAltura),
    }))
    .filter((m) => m.codigo > 0 && m.largura > 0 && m.altura > 0);

  const porMaterial = new Map<number, ItemParaOtimizar[]>();
  pecas.forEach((peca) => {
    const material = numero(peca.materialCodigo);
    const largura = numero(peca.largura);
    const altura = numero(peca.altura);
    const quantidade = numero(peca.quantidade);
    if (!material || largura <= 0 || altura <= 0 || quantidade <= 0) return;
    const lista = porMaterial.get(material) ?? [];
    lista.push({
      codigo: numero(peca.codigo) || lista.length + 1,
      descricao: peca.descricao || `Peça ${peca.codigo}`,
      largura,
      altura,
      quantidade,
      veio: peca.veio === 'COMPRIMENTO' || peca.veio === 'LARGURA' ? peca.veio : 'INDIFERENTE',
    });
    porMaterial.set(material, lista);
  });

  return otimizarPlanos(chapas, porMaterial);
}

export function VisualizacaoPlano({
  materiais,
  pecas,
}: {
  materiais: MaterialVisual[];
  pecas: PecaVisual[];
}) {
  const resultado = useMemo(() => montarResultado(materiais, pecas), [materiais, pecas]);
  const [folha, setFolha] = useState(0);
  const chapa = resultado.chapas[Math.min(folha, Math.max(0, resultado.chapas.length - 1))];

  if (resultado.chapas.length === 0 && resultado.naoEncaixadas.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Lance largura, altura e quantidade das peças para ver o plano de corte nesta tela.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">Pré-visualização do plano de corte</h3>
          <p className="text-sm text-stone-500">
            Disposição preliminar nas chapas (corte tipo guilhotina, serra 4,4 mm). Confira as medidas
            antes de enviar. A central refaz a otimização no Corte Certo.
          </p>
        </div>
        {resultado.chapas.length > 0 && (
          <p className="text-sm font-semibold text-stone-700">
            {resultado.totalChapas} chapa(s) · aproveitamento médio {resultado.aproveitamentoMedio.toLocaleString('pt-BR')}%
          </p>
        )}
      </div>

      {resultado.naoEncaixadas.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          <p className="font-semibold">Peças que não cabem na chapa</p>
          <ul className="mt-1 list-inside list-disc">
            {resultado.naoEncaixadas.slice(0, 8).map((item, i) => (
              <li key={`${item.codigo}-${i}`}>
                {item.codigo} · {item.descricao} ({item.largura}×{item.altura} mm) — {item.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado.chapas.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {resultado.chapas.map((c, indice) => (
              <button
                key={`${c.materialCodigo}-${c.indice}`}
                type="button"
                onClick={() => setFolha(indice)}
                className={
                  indice === folha
                    ? 'rounded-lg bg-madeira-700 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-300 hover:bg-stone-50'
                }
              >
                {c.materialDescricao} · chapa {c.indice}
              </button>
            ))}
          </div>
          {chapa && <DesenhoChapa chapa={chapa} />}
        </>
      )}
    </div>
  );
}

function DesenhoChapa({ chapa }: { chapa: ChapaDoPlano }) {
  const maxLargura = 920;
  const escala = maxLargura / chapa.chapaLargura;
  const larguraSvg = chapa.chapaLargura * escala;
  const alturaSvg = chapa.chapaAltura * escala;
  const areaChapaM2 = (chapa.chapaLargura * chapa.chapaAltura) / 1_000_000;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-4 text-xs text-stone-600">
        <span>
          Chapa {chapa.chapaLargura} × {chapa.chapaAltura} mm
        </span>
        <span>{chapa.pecas.length} peça(s)</span>
        <span>usada {formatarM2(chapa.areaUsadaMm2 / 1_000_000)} de {formatarM2(areaChapaM2)}</span>
        <span className="font-semibold text-madeira-800">{chapa.aproveitamento}% de aproveitamento</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-300 bg-stone-100 p-3">
        <svg
          viewBox={`0 0 ${chapa.chapaLargura} ${chapa.chapaAltura}`}
          width={larguraSvg}
          height={alturaSvg}
          className="mx-auto max-w-full bg-[#f3e6d0] shadow-inner"
          role="img"
          aria-label={`Plano de corte da chapa ${chapa.indice}`}
        >
          <rect x="0" y="0" width={chapa.chapaLargura} height={chapa.chapaAltura} fill="#ead7b7" />
          {chapa.pecas.map((peca, indice) => {
            const cor = CORES[peca.codigo % CORES.length];
            const fonte = Math.max(18, Math.min(peca.largura, peca.altura) * 0.12);
            return (
              <g key={`${peca.codigo}-${indice}-${peca.x}-${peca.y}`}>
                <rect
                  x={peca.x}
                  y={peca.y}
                  width={peca.largura}
                  height={peca.altura}
                  fill={cor}
                  stroke="#5c3719"
                  strokeWidth={Math.max(2, chapa.chapaLargura / 400)}
                />
                <text
                  x={peca.x + peca.largura / 2}
                  y={peca.y + peca.altura / 2 - fonte * 0.4}
                  textAnchor="middle"
                  fill="#3d2411"
                  fontSize={fonte}
                  fontWeight={700}
                >
                  {peca.codigo} · {peca.descricao}
                </text>
                <text
                  x={peca.x + peca.largura / 2}
                  y={peca.y + peca.altura / 2 + fonte * 0.8}
                  textAnchor="middle"
                  fill="#5c3719"
                  fontSize={fonte * 0.85}
                >
                  {peca.largura}×{peca.altura} mm{peca.girada ? ' (girada)' : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
