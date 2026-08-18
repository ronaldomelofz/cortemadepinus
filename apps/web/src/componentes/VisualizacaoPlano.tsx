import { useMemo, useState, type ReactNode } from 'react';
import {
  formatarM2,
  formatarMoeda,
  otimizarPlanos,
  SERRA_PADRAO_MM,
  type ChapaDoPlano,
  type FaseCorte,
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

export function montarResultado(
  materiais: MaterialVisual[],
  pecas: PecaVisual[],
  serraMm: number,
): ResultadoOtimizacao {
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

  return otimizarPlanos(chapas, porMaterial, { serraMm, apararBordas: true });
}

const FASE_CORTE_LABEL: Record<FaseCorte, string> = {
  APARAR: 'Aparar',
  LONGO: 'Longo',
  CURTO: 'Curto',
};

export function VisualizacaoPlano({
  materiais,
  pecas,
  serraMm = SERRA_PADRAO_MM,
  valorCorte = 0,
  acoes,
}: {
  materiais: MaterialVisual[];
  pecas: PecaVisual[];
  serraMm?: number;
  valorCorte?: number;
  acoes?: ReactNode;
}) {
  const resultado = useMemo(
    () => montarResultado(materiais, pecas, serraMm),
    [materiais, pecas, serraMm],
  );
  const grupos = useMemo(() => {
    const mapa = new Map<
      number,
      { codigo: number; descricao: string; indices: number[]; cortes: number; aproveitamento: number }
    >();
    resultado.chapas.forEach((c, indice) => {
      const atual = mapa.get(c.materialCodigo) ?? {
        codigo: c.materialCodigo,
        descricao: c.materialDescricao,
        indices: [],
        cortes: 0,
        aproveitamento: 0,
      };
      atual.indices.push(indice);
      atual.cortes += c.cortes.length;
      atual.aproveitamento += c.aproveitamento;
      mapa.set(c.materialCodigo, atual);
    });
    return [...mapa.values()].map((grupo) => ({
      ...grupo,
      aproveitamento:
        grupo.indices.length > 0 ? Math.round((grupo.aproveitamento / grupo.indices.length) * 10) / 10 : 0,
    }));
  }, [resultado.chapas]);
  const [folha, setFolha] = useState(0);
  const chapa = resultado.chapas[Math.min(folha, Math.max(0, resultado.chapas.length - 1))];
  const custoCortes = resultado.totalCortes * valorCorte;

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
            Disposição otimizada nas chapas (faixas para seccionadora, serra{' '}
            {serraMm.toLocaleString('pt-BR')} mm). As quatro bordas são aparadas com essa espessura antes
            das peças. A chapa entra no sentido do comprimento ou da largura: primeiro o aparo e os cortes
            longos, depois os curtos de cada faixa.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {acoes}
          {resultado.chapas.length > 0 && (
            <p className="text-sm font-semibold text-stone-700">
              {resultado.totalChapas} chapa(s) · {resultado.totalCortes} corte(s)
              {valorCorte > 0 ? ` · ${formatarMoeda(custoCortes)}` : ''} · aproveitamento médio{' '}
              {resultado.aproveitamentoMedio.toLocaleString('pt-BR')}%
            </p>
          )}
        </div>
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
          <div className="space-y-4">
            {grupos.map((grupo) => (
              <div key={grupo.codigo} className="space-y-2">
                <p className="text-sm font-semibold text-stone-800">
                  {grupo.descricao}
                  <span className="ml-2 text-xs font-normal text-stone-500">
                    {grupo.indices.length} chapa(s) · {grupo.cortes} corte(s) · aproveitamento{' '}
                    {grupo.aproveitamento.toLocaleString('pt-BR')}%
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {grupo.indices.map((indice) => (
                    <button
                      key={`${grupo.codigo}-${resultado.chapas[indice].indice}`}
                      type="button"
                      onClick={() => setFolha(indice)}
                      className={
                        indice === folha
                          ? 'rounded-lg bg-madeira-700 px-3 py-1.5 text-xs font-semibold text-white'
                          : 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-300 hover:bg-stone-50'
                      }
                    >
                      Chapa {resultado.chapas[indice].indice}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {chapa && <DesenhoChapa chapa={chapa} valorCorte={valorCorte} />}
        </>
      )}
    </div>
  );
}

function comprimentoCorte(x1: number, y1: number, x2: number, y2: number): number {
  return Math.round(Math.hypot(x2 - x1, y2 - y1));
}

export function DesenhoChapa({
  chapa,
  valorCorte,
  larguraMaxima = 920,
}: {
  chapa: ChapaDoPlano;
  valorCorte: number;
  larguraMaxima?: number;
}) {
  const maxLargura = larguraMaxima;
  const margem = Math.max(chapa.chapaLargura, chapa.chapaAltura) * 0.055;
  const escala = maxLargura / (chapa.chapaLargura + margem * 1.4);
  const larguraSvg = (chapa.chapaLargura + margem * 1.4) * escala;
  const alturaSvg = (chapa.chapaAltura + margem * 1.4) * escala;
  const areaChapaM2 = (chapa.chapaLargura * chapa.chapaAltura) / 1_000_000;
  const fonteChapa = Math.max(28, margem * 0.45);
  const traco = Math.max(2, chapa.chapaLargura / 500);
  const raioOrdem = Math.max(22, Math.min(chapa.chapaLargura, chapa.chapaAltura) * 0.018);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-stone-600">
        <span>
          Chapa {chapa.chapaLargura} × {chapa.chapaAltura} mm
        </span>
        <span>{chapa.pecas.length} peça(s)</span>
        <span>usada {formatarM2(chapa.areaUsadaMm2 / 1_000_000)} de {formatarM2(areaChapaM2)}</span>
        <span className="font-semibold text-madeira-800">{chapa.aproveitamento}% de aproveitamento</span>
        <span>
          Entra na seccionadora no sentido {chapa.sentidoEntradaMm.toLocaleString('pt-BR')} mm
          {chapa.sentidoEntrada === 'COMPRIMENTO' ? ' (comprimento)' : ' (largura)'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-300 bg-stone-100 p-3">
        <svg
          viewBox={`${-margem} ${-margem * 0.35} ${chapa.chapaLargura + margem * 1.35} ${chapa.chapaAltura + margem * 1.15}`}
          width={larguraSvg}
          height={alturaSvg}
          className="mx-auto max-w-full"
          role="img"
          aria-label={`Plano de corte da chapa ${chapa.indice}`}
        >
          <rect
            x="0"
            y="0"
            width={chapa.chapaLargura}
            height={chapa.chapaAltura}
            fill="#ead7b7"
            stroke="#5c3719"
            strokeWidth={traco * 1.4}
          />

          <CotaHorizontal
            x={0}
            y={chapa.chapaAltura}
            comprimento={chapa.chapaLargura}
            texto={`${chapa.chapaLargura}`}
            fonte={fonteChapa}
            traco={traco}
            fora
          />
          <CotaVertical
            x={0}
            y={0}
            comprimento={chapa.chapaAltura}
            texto={`${chapa.chapaAltura}`}
            fonte={fonteChapa}
            traco={traco}
            fora
          />

          {chapa.pecas.map((peca, indice) => {
            const cor = CORES[peca.codigo % CORES.length];
            const menorLado = Math.min(peca.largura, peca.altura);
            const fonteNome = Math.max(14, Math.min(menorLado * 0.13, peca.largura * 0.1, 36));
            const fonteCota = Math.max(14, Math.min(menorLado * 0.1, 32));
            return (
              <g key={`${peca.codigo}-${indice}-${peca.x}-${peca.y}`}>
                <rect
                  x={peca.x}
                  y={peca.y}
                  width={peca.largura}
                  height={peca.altura}
                  fill={cor}
                  stroke="#5c3719"
                  strokeWidth={traco}
                />
                <NomePeca peca={peca} fonteNome={fonteNome} padEsq={fonteCota * 1.35} padBaixo={fonteCota * 1.15} />
                <CotaHorizontal
                  x={peca.x}
                  y={peca.y + peca.altura}
                  comprimento={peca.largura}
                  texto={`${peca.largura}`}
                  fonte={fonteCota}
                  traco={traco}
                />
                <CotaVertical
                  x={peca.x}
                  y={peca.y}
                  comprimento={peca.altura}
                  texto={`${peca.altura}`}
                  fonte={fonteCota}
                  traco={traco}
                />
              </g>
            );
          })}

          {chapa.cortes.map((corte) => {
            const dx = corte.x2 - corte.x1;
            const dy = corte.y2 - corte.y1;
            const t = corte.fase === 'LONGO' || corte.fase === 'APARAR' ? 0.06 : 0.18;
            const mx = corte.x1 + dx * t;
            const my = corte.y1 + dy * t;
            const fonteNum = raioOrdem * 0.95;
            const longo = corte.fase === 'LONGO' || corte.fase === 'APARAR';
            const corLinha = corte.fase === 'APARAR' ? '#6b21a8' : longo ? '#9f1239' : '#c2410c';
            return (
              <g key={`corte-${corte.ordem}`}>
                <line
                  x1={corte.x1}
                  y1={corte.y1}
                  x2={corte.x2}
                  y2={corte.y2}
                  stroke={corLinha}
                  strokeWidth={traco * (longo ? 1.45 : 1.05)}
                  strokeDasharray={longo ? `${traco * 14} ${traco * 6}` : `${traco * 7} ${traco * 6}`}
                  strokeLinecap="round"
                />
                <circle cx={mx} cy={my} r={raioOrdem} fill={corLinha} stroke="#fff7ed" strokeWidth={traco} />
                <text
                  x={mx}
                  y={my}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff7ed"
                  fontSize={fonteNum}
                  fontWeight={800}
                >
                  {corte.ordem}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {chapa.cortes.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-950 ring-1 ring-inset ring-rose-200">
          <p className="font-semibold text-rose-900">
            Ordem dos cortes na seccionadora
            <span className="ml-2 font-normal text-rose-700">
              — entra em {chapa.sentidoEntradaMm.toLocaleString('pt-BR')} mm; aparar, longos e depois curtos
              {valorCorte > 0
                ? ` · ${chapa.cortes.length} corte(s) nesta chapa (${formatarMoeda(chapa.cortes.length * valorCorte)})`
                : ''}
            </span>
          </p>
          <ol className="mt-2 grid list-decimal gap-1 pl-5 sm:grid-cols-2">
            {chapa.cortes.map((corte) => (
              <li key={corte.ordem}>
                {FASE_CORTE_LABEL[corte.fase]}{' '}
                {corte.direcao === 'HORIZONTAL' ? 'horizontal' : 'vertical'} ·{' '}
                {comprimentoCorte(corte.x1, corte.y1, corte.x2, corte.y2).toLocaleString('pt-BR')} mm
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function quebrarTexto(texto: string, larguraMax: number, fonte: number): string[] {
  const maxChars = Math.max(4, Math.floor(larguraMax / (fonte * 0.58)));
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length <= maxChars) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    if (palavra.length > maxChars) {
      for (let i = 0; i < palavra.length; i += maxChars) linhas.push(palavra.slice(i, i + maxChars));
      atual = '';
    } else {
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 4);
}

function NomePeca({
  peca,
  fonteNome,
  padEsq,
  padBaixo,
}: {
  peca: ChapaDoPlano['pecas'][number];
  fonteNome: number;
  padEsq: number;
  padBaixo: number;
}) {
  const pad = fonteNome * 0.25;
  const innerW = peca.largura - padEsq - pad;
  const innerH = peca.altura - padBaixo - pad;
  if (innerW < fonteNome * 1.6 || innerH < fonteNome * 1.1) return null;

  const vertical = peca.altura > peca.largura * 1.35 && innerW < fonteNome * 7;
  const larguraTexto = vertical ? innerH : innerW;
  const rotulo = `${peca.codigo} · ${peca.descricao}${peca.girada ? ' ↻' : ''}`;
  const linhas = quebrarTexto(rotulo, larguraTexto, fonteNome);
  const lineH = fonteNome * 1.18;
  const blocoH = linhas.length * lineH;
  const cx = peca.x + padEsq + innerW / 2;
  const cy = peca.y + pad + innerH / 2;
  const fundoW = vertical ? blocoH + fonteNome * 0.35 : Math.min(innerW, Math.max(...linhas.map((l) => l.length)) * fonteNome * 0.58 + fonteNome);
  const fundoH = vertical ? Math.min(innerW, fonteNome * 1.35) : Math.min(innerH, blocoH + fonteNome * 0.3);

  return (
    <g transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>
      <rect
        x={cx - fundoW / 2}
        y={cy - fundoH / 2}
        width={fundoW}
        height={fundoH}
        rx={fonteNome * 0.2}
        fill="#f8f1e7"
        fillOpacity={0.88}
      />
      {linhas.map((linha, i) => (
        <text
          key={linha + i}
          x={cx}
          y={cy - blocoH / 2 + lineH * i + lineH * 0.78}
          textAnchor="middle"
          fill="#3d2411"
          fontSize={fonteNome}
          fontWeight={700}
        >
          {linha}
        </text>
      ))}
    </g>
  );
}

/** Medida ao longo da aresta horizontal (largura), junto da linha de baixo. */
function CotaHorizontal({
  x,
  y,
  comprimento,
  texto,
  fonte,
  traco,
  fora = false,
}: {
  x: number;
  y: number;
  comprimento: number;
  texto: string;
  fonte: number;
  traco: number;
  fora?: boolean;
}) {
  const deslocamento = fora ? fonte * 0.85 : -fonte * 0.35;
  const yTexto = y + deslocamento;
  const yTique = fora ? y + fonte * 0.25 : y - fonte * 0.08;
  return (
    <g fill="#3d2411" stroke="#5c3719">
      <line x1={x} y1={y} x2={x} y2={yTique} strokeWidth={traco} />
      <line x1={x + comprimento} y1={y} x2={x + comprimento} y2={yTique} strokeWidth={traco} />
      <text
        x={x + comprimento / 2}
        y={yTexto}
        textAnchor="middle"
        dominantBaseline={fora ? 'hanging' : 'auto'}
        fill="#3d2411"
        stroke="none"
        fontSize={fonte}
        fontWeight={700}
      >
        {texto}
      </text>
    </g>
  );
}

/** Medida ao longo da aresta vertical (altura), junto da linha da esquerda. */
function CotaVertical({
  x,
  y,
  comprimento,
  texto,
  fonte,
  traco,
  fora = false,
}: {
  x: number;
  y: number;
  comprimento: number;
  texto: string;
  fonte: number;
  traco: number;
  fora?: boolean;
}) {
  const cx = fora ? x - fonte * 0.7 : x + fonte * 0.55;
  const cy = y + comprimento / 2;
  const xTique = fora ? x - fonte * 0.25 : x + fonte * 0.15;
  return (
    <g fill="#3d2411" stroke="#5c3719">
      <line x1={x} y1={y} x2={xTique} y2={y} strokeWidth={traco} />
      <line x1={x} y1={y + comprimento} x2={xTique} y2={y + comprimento} strokeWidth={traco} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#3d2411"
        stroke="none"
        fontSize={fonte}
        fontWeight={700}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        {texto}
      </text>
    </g>
  );
}
