import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  areaUtilChapa,
  formatarM2,
  formatarMoeda,
  organizarPecasNaChapa,
  otimizarPlanos,
  remontarChapaDoPlano,
  SERRA_PADRAO_MM,
  VEIO_LABEL,
  type ChapaDoPlano,
  type ItemParaOtimizar,
  type PecaNoPlano,
  type ResultadoOtimizacao,
  type SentidoEntrada,
  type Veio,
} from '@cortemadepinus/shared';
import { Botao, Campo } from './ui';

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

const EPS_POS = 0.51;
const PASSO_FINO_MM = 1;
const PASSO_GROSSO_MM = 10;

export type AlteracaoPecaNoPlano = {
  codigo: number;
  largura: number;
  altura: number;
};

function veioDaPeca(pecas: PecaVisual[], codigo: number): Veio {
  const peca = pecas.find((item) => numero(item.codigo) === codigo);
  if (peca?.veio === 'COMPRIMENTO' || peca?.veio === 'LARGURA') return peca.veio;
  return 'INDIFERENTE';
}

function retangulosConflitam(
  a: Pick<PecaNoPlano, 'x' | 'y' | 'largura' | 'altura'>,
  b: Pick<PecaNoPlano, 'x' | 'y' | 'largura' | 'altura'>,
  serra: number,
): boolean {
  return (
    a.x < b.x + b.largura + serra - EPS_POS &&
    b.x < a.x + a.largura + serra - EPS_POS &&
    a.y < b.y + b.altura + serra - EPS_POS &&
    b.y < a.y + a.altura + serra - EPS_POS
  );
}

function limitarNaAreaUtil(
  x: number,
  y: number,
  largura: number,
  altura: number,
  util: { x: number; y: number; w: number; h: number },
): { x: number; y: number } | null {
  if (largura > util.w + EPS_POS || altura > util.h + EPS_POS) return null;
  return {
    x: Math.min(util.x + util.w - largura, Math.max(util.x, x)),
    y: Math.min(util.y + util.h - altura, Math.max(util.y, y)),
  };
}

function encaixarPeca(
  tentativa: PecaNoPlano,
  outras: PecaNoPlano[],
  util: { x: number; y: number; w: number; h: number },
  serra: number,
): PecaNoPlano | null {
  const limitada = limitarNaAreaUtil(tentativa.x, tentativa.y, tentativa.largura, tentativa.altura, util);
  if (!limitada) return null;
  const peca = { ...tentativa, x: Math.round(limitada.x), y: Math.round(limitada.y) };
  if (outras.some((outra) => retangulosConflitam(peca, outra, serra))) return null;
  return peca;
}

function pontoNoSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const caixa = svg.viewBox.baseVal;
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * caixa.width + caixa.x,
    y: ((clientY - rect.top) / rect.height) * caixa.height + caixa.y,
  };
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

export function VisualizacaoPlano({
  materiais,
  pecas,
  serraMm = SERRA_PADRAO_MM,
  valorCorte = 0,
  acoes,
  editavel = false,
  aoAlterarMedidas,
}: {
  materiais: MaterialVisual[];
  pecas: PecaVisual[];
  serraMm?: number;
  valorCorte?: number;
  acoes?: ReactNode;
  editavel?: boolean;
  aoAlterarMedidas?: (alteracao: AlteracaoPecaNoPlano) => number;
}) {
  const otimizado = useMemo(
    () => montarResultado(materiais, pecas, serraMm),
    [materiais, pecas, serraMm],
  );
  const [chapasManuais, setChapasManuais] = useState<ChapaDoPlano[] | null>(null);
  const [folha, setFolha] = useState(0);
  const [selecao, setSelecao] = useState<{ folha: number; indice: number } | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [avisoLayout, setAvisoLayout] = useState<string | null>(null);
  const ignorarChave = useRef<string | null>(null);

  const chaveEntrada = useMemo(
    () => JSON.stringify({ serraMm, materiais, pecas }),
    [materiais, pecas, serraMm],
  );

  useEffect(() => {
    if (ignorarChave.current === 'pending') {
      ignorarChave.current = chaveEntrada;
      return;
    }
    if (ignorarChave.current === chaveEntrada) return;
    ignorarChave.current = null;
    setChapasManuais(null);
    setSelecao(null);
    setDialogoAberto(false);
    setAvisoLayout(null);
  }, [chaveEntrada]);

  const chapas = chapasManuais ?? otimizado.chapas;
  const chapasRef = useRef(chapas);
  chapasRef.current = chapas;
  const grupos = useMemo(() => {
    const mapa = new Map<
      number,
      { codigo: number; descricao: string; indices: number[]; cortes: number; aproveitamento: number }
    >();
    chapas.forEach((c, indice) => {
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
  }, [chapas]);

  const folhaAtual = Math.min(folha, Math.max(0, chapas.length - 1));
  const chapa = chapas[folhaAtual];
  const totalCortes = chapas.reduce((soma, item) => soma + item.cortes.length, 0);
  const aproveitamentoMedio =
    chapas.length > 0
      ? Math.round((chapas.reduce((soma, item) => soma + item.aproveitamento, 0) / chapas.length) * 10) / 10
      : 0;
  const custoCortes = totalCortes * valorCorte;
  const pecaSelecionada =
    selecao && chapas[selecao.folha] ? chapas[selecao.folha].pecas[selecao.indice] : undefined;

  function aplicarPecas(indiceFolha: number, pecasFolha: PecaNoPlano[]) {
    setChapasManuais((atual) => {
      const origem = atual ?? otimizado.chapas;
      const proximo = origem.map((item, indice) => {
        if (indice !== indiceFolha) return item;
        const sentido = item.sentidoForcado ?? item.sentidoEntrada;
        const remonta = remontarChapaDoPlano(item, pecasFolha, serraMm, true, sentido);
        if (item.sentidoForcado) return remonta;
        const { sentidoForcado: _ignorado, ...resto } = remonta;
        return resto;
      });
      chapasRef.current = proximo;
      return proximo;
    });
  }

  function inverterSentidoDaFolha(indiceFolha: number) {
    const atual = chapasRef.current[indiceFolha];
    if (!atual) return;
    const novo: SentidoEntrada = atual.sentidoEntrada === 'COMPRIMENTO' ? 'LARGURA' : 'COMPRIMENTO';
    setChapasManuais((lista) => {
      const origem = lista ?? otimizado.chapas;
      const proximo = origem.map((item, indice) =>
        indice === indiceFolha ? remontarChapaDoPlano(item, item.pecas, serraMm, true, novo) : item,
      );
      chapasRef.current = proximo;
      return proximo;
    });
    setAvisoLayout(null);
  }

  function organizarPecasDaFolha(indiceFolha: number) {
    const atual = chapasRef.current[indiceFolha];
    if (!atual || atual.pecas.length === 0) return;
    const organizadas = organizarPecasNaChapa(
      atual.pecas,
      { largura: atual.chapaLargura, altura: atual.chapaAltura },
      serraMm,
      true,
    );
    if (organizadas === atual.pecas) {
      setAvisoLayout('Não foi possível reorganizar todas as peças nesta chapa.');
      return;
    }
    aplicarPecas(indiceFolha, organizadas);
    setAvisoLayout(null);
  }

  function tentarColocar(
    indiceFolha: number,
    indicePeca: number,
    tentativa: PecaNoPlano,
  ): PecaNoPlano | null {
    const atual = chapasRef.current[indiceFolha];
    if (!atual) return null;
    const util = areaUtilChapa(
      { largura: atual.chapaLargura, altura: atual.chapaAltura },
      serraMm,
      true,
    );
    const outras = atual.pecas.filter((_, indice) => indice !== indicePeca);
    return encaixarPeca(tentativa, outras, util, serraMm);
  }

  function moverPeca(
    indiceFolha: number,
    indicePeca: number,
    x: number,
    y: number,
    silencioso = false,
  ): boolean {
    const atual = chapasRef.current[indiceFolha];
    const peca = atual?.pecas[indicePeca];
    if (!peca) return false;
    const colocada = tentarColocar(indiceFolha, indicePeca, { ...peca, x, y });
    if (!colocada) {
      if (!silencioso) {
        setAvisoLayout('Essa posição encosta em outra peça ou sai da área útil da chapa.');
      }
      return false;
    }
    if (colocada.x === peca.x && colocada.y === peca.y) return true;
    setAvisoLayout(null);
    aplicarPecas(
      indiceFolha,
      atual.pecas.map((item, indice) => (indice === indicePeca ? colocada : item)),
    );
    return true;
  }

  function atualizarPeca(
    indiceFolha: number,
    indicePeca: number,
    patch: Partial<PecaNoPlano>,
    sincronizarMedidas: boolean,
  ): boolean {
    const atual = chapasRef.current[indiceFolha];
    const peca = atual?.pecas[indicePeca];
    if (!peca) return false;
    const tentativa = { ...peca, ...patch };
    const colocada = tentarColocar(indiceFolha, indicePeca, tentativa);
    if (!colocada) {
      setAvisoLayout('A peça não cabe nessa medida ou posição, com o espaço da serra entre as demais.');
      return false;
    }
    setAvisoLayout(null);
    let pecasNovas = atual.pecas.map((item, indice) => (indice === indicePeca ? colocada : item));
    if (sincronizarMedidas && aoAlterarMedidas) {
      const pecaForm = pecas.find((item) => numero(item.codigo) === colocada.codigo);
      const medidasDiferentes =
        !pecaForm ||
        numero(pecaForm.largura) !== colocada.largura ||
        numero(pecaForm.altura) !== colocada.altura;
      const codigo = aoAlterarMedidas({
        codigo: colocada.codigo,
        largura: colocada.largura,
        altura: colocada.altura,
      });
      if (medidasDiferentes) ignorarChave.current = 'pending';
      if (codigo !== colocada.codigo) {
        pecasNovas = pecasNovas.map((item, indice) =>
          indice === indicePeca ? { ...colocada, codigo } : item,
        );
      }
    }
    aplicarPecas(indiceFolha, pecasNovas);
    return true;
  }

  function girarPecaSelecionada() {
    if (!selecao || !pecaSelecionada) return;
    if (veioDaPeca(pecas, pecaSelecionada.codigo) !== 'INDIFERENTE') {
      setAvisoLayout('Esta peça tem veio definido e não pode girar no plano.');
      return;
    }
    atualizarPeca(
      selecao.folha,
      selecao.indice,
      {
        largura: pecaSelecionada.altura,
        altura: pecaSelecionada.largura,
        girada: !pecaSelecionada.girada,
      },
      true,
    );
  }

  function aplicarMedidas(largura: number, altura: number) {
    if (!selecao || !pecaSelecionada) return false;
    return atualizarPeca(selecao.folha, selecao.indice, { largura, altura }, true);
  }

  function escolherFolha(indice: number) {
    setFolha(indice);
    setSelecao(null);
    setDialogoAberto(false);
    setAvisoLayout(null);
  }

  if (otimizado.chapas.length === 0 && otimizado.naoEncaixadas.length === 0) {
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
            longos, depois os curtos de cada faixa. Em cada chapa dá para inverter a direção desses cortes.
            {editavel
              ? ' Clique numa peça para alterar medidas, girar ou mover. Também é possível arrastar no desenho.'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {acoes}
          {chapasManuais && (
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                setChapasManuais(null);
                setSelecao(null);
                setDialogoAberto(false);
                setAvisoLayout(null);
              }}
            >
              Reposicionar automaticamente
            </Botao>
          )}
          {chapas.length > 0 && (
            <p className="text-sm font-semibold text-stone-700">
              {chapas.length} chapa(s) · {totalCortes} corte(s)
              {valorCorte > 0 ? ` · ${formatarMoeda(custoCortes)}` : ''} · aproveitamento médio{' '}
              {aproveitamentoMedio.toLocaleString('pt-BR')}%
            </p>
          )}
        </div>
      </div>

      {avisoLayout && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          {avisoLayout}
        </p>
      )}

      {otimizado.naoEncaixadas.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          <p className="font-semibold">Peças que não cabem na chapa</p>
          <ul className="mt-1 list-inside list-disc">
            {otimizado.naoEncaixadas.slice(0, 8).map((item, i) => (
              <li key={`${item.codigo}-${i}`}>
                {item.codigo} · {item.descricao} ({item.largura}×{item.altura} mm) — {item.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {chapas.length > 0 && (
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
                      key={`${grupo.codigo}-${chapas[indice].indice}`}
                      type="button"
                      onClick={() => escolherFolha(indice)}
                      className={
                        indice === folhaAtual
                          ? 'rounded-lg bg-madeira-700 px-3 py-1.5 text-xs font-semibold text-white'
                          : 'rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-inset ring-stone-300 hover:bg-stone-50'
                      }
                    >
                      Chapa {chapas[indice].indice}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {chapa && (
            <DesenhoChapa
              chapa={chapa}
              editavel={editavel}
              pecaSelecionada={selecao?.folha === folhaAtual ? selecao.indice : undefined}
              aoClicarPeca={(indice) => {
                setSelecao({ folha: folhaAtual, indice });
                setDialogoAberto(true);
                setAvisoLayout(null);
              }}
              aoMoverPeca={(indice, x, y) => {
                setSelecao({ folha: folhaAtual, indice });
                setDialogoAberto(true);
                moverPeca(folhaAtual, indice, x, y, true);
              }}
              aoInverterSentido={() => inverterSentidoDaFolha(folhaAtual)}
              aoOrganizarPecas={() => organizarPecasDaFolha(folhaAtual)}
            />
          )}
        </>
      )}

      {editavel && dialogoAberto && pecaSelecionada && selecao && (
        <DialogoPecaPlano
          peca={pecaSelecionada}
          veio={veioDaPeca(pecas, pecaSelecionada.codigo)}
          aoFechar={() => setDialogoAberto(false)}
          aoGirar={girarPecaSelecionada}
          aoAplicarMedidas={aplicarMedidas}
          aoMover={(x, y) => moverPeca(selecao.folha, selecao.indice, x, y)}
        />
      )}
    </div>
  );
}

function pecaEhPequena(
  peca: ChapaDoPlano['pecas'][number],
  fonteAlvo: number,
): boolean {
  const fontePossivel = Math.min(fonteAlvo, peca.largura * 0.2, peca.altura * 0.2);
  return fontePossivel < fonteAlvo * 0.55;
}

export function DesenhoChapa({
  chapa,
  editavel = false,
  pecaSelecionada,
  aoClicarPeca,
  aoMoverPeca,
  aoInverterSentido,
  aoOrganizarPecas,
}: {
  chapa: ChapaDoPlano;
  editavel?: boolean;
  pecaSelecionada?: number;
  aoClicarPeca?: (indice: number) => void;
  aoMoverPeca?: (indice: number, x: number, y: number) => void;
  aoInverterSentido?: () => void;
  aoOrganizarPecas?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ indice: number; dx: number; dy: number; x0: number; y0: number; moveu: boolean } | null>(
    null,
  );
  const menorChapa = Math.min(chapa.chapaLargura, chapa.chapaAltura);
  const margem = Math.max(chapa.chapaLargura, chapa.chapaAltura) * 0.07;
  const areaChapaM2 = (chapa.chapaLargura * chapa.chapaAltura) / 1_000_000;
  const fonteAlvo = menorChapa * 0.034;
  const fonteChapa = Math.max(fonteAlvo, margem * 0.42);
  const traco = Math.max(2, chapa.chapaLargura / 500);
  const raioOrdem = Math.max(22, menorChapa * 0.018);

  const pecasNumeradas = chapa.pecas
    .map((peca, indice) => ({ peca, indice, pequena: pecaEhPequena(peca, fonteAlvo) }))
    .filter((item) => item.pequena)
    .map((item, ordem) => ({ ...item, numero: ordem + 1 }));
  const numeroDaPeca = new Map(pecasNumeradas.map((item) => [item.indice, item.numero]));

  function iniciarArrasto(evento: PointerEvent<SVGRectElement>, indice: number, peca: PecaNoPlano) {
    if (!editavel || !svgRef.current) return;
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const ponto = pontoNoSvg(svgRef.current, evento.clientX, evento.clientY);
    arrasto.current = {
      indice,
      dx: ponto.x - peca.x,
      dy: ponto.y - peca.y,
      x0: evento.clientX,
      y0: evento.clientY,
      moveu: false,
    };
  }

  function moverArrasto(evento: PointerEvent<SVGRectElement>) {
    if (!editavel || !arrasto.current || !svgRef.current) return;
    const deslocou =
      Math.abs(evento.clientX - arrasto.current.x0) > 4 || Math.abs(evento.clientY - arrasto.current.y0) > 4;
    if (deslocou) arrasto.current.moveu = true;
    if (!arrasto.current.moveu) return;
    const ponto = pontoNoSvg(svgRef.current, evento.clientX, evento.clientY);
    aoMoverPeca?.(arrasto.current.indice, ponto.x - arrasto.current.dx, ponto.y - arrasto.current.dy);
  }

  function soltarArrasto(evento: PointerEvent<SVGRectElement>, indice: number) {
    if (!editavel) return;
    const dados = arrasto.current;
    arrasto.current = null;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
    if (!dados?.moveu) aoClicarPeca?.(indice);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-stone-600 print:hidden">
        <span>
          Chapa {chapa.chapaLargura} × {chapa.chapaAltura} mm
        </span>
        <span>{chapa.pecas.length} peça(s)</span>
        <span>usada {formatarM2(chapa.areaUsadaMm2 / 1_000_000)} de {formatarM2(areaChapaM2)}</span>
        <span className="font-semibold text-madeira-800">{chapa.aproveitamento}% de aproveitamento</span>
        <span>
          Entra na seccionadora no sentido {chapa.sentidoEntradaMm.toLocaleString('pt-BR')} mm
          {chapa.sentidoEntrada === 'COMPRIMENTO' ? ' (comprimento)' : ' (largura)'}
          {chapa.sentidoForcado ? ' · definido nesta chapa' : ''}
        </span>
        {(aoOrganizarPecas || aoInverterSentido) && (
          <span className="flex flex-wrap gap-2">
            {aoOrganizarPecas && (
              <button
                type="button"
                onClick={aoOrganizarPecas}
                title="Agrupa as peças na borda mais próxima de onde você as moveu e fecha as folgas"
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/40 hover:bg-emerald-400"
              >
                Organizar peças
              </button>
            )}
            {aoInverterSentido && (
              <button
                type="button"
                onClick={aoInverterSentido}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-orange-600/40 hover:bg-orange-400"
              >
                Inverter direção do corte
              </button>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-stone-300 bg-stone-100 p-3 lg:flex-row">
        <svg
          ref={svgRef}
          viewBox={`${-margem} ${-margem * 0.35} ${chapa.chapaLargura + margem * 1.35} ${chapa.chapaAltura + margem * 1.15}`}
          className="mx-auto h-auto max-h-[158mm] w-full max-w-full flex-1 touch-none"
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
            const numeroLista = numeroDaPeca.get(indice);
            const fonteCota = Math.min(fonteAlvo, peca.largura * 0.2, peca.altura * 0.2);
            const fonteNome = Math.min(fonteAlvo * 0.85, peca.largura * 0.16, peca.altura * 0.16);
            const selecionada = pecaSelecionada === indice;
            return (
              <g key={`${peca.codigo}-${indice}`} pointerEvents="none">
                <rect
                  x={peca.x}
                  y={peca.y}
                  width={peca.largura}
                  height={peca.altura}
                  fill={cor}
                  stroke={selecionada ? '#1d4ed8' : '#5c3719'}
                  strokeWidth={traco * (selecionada ? 2.2 : 1)}
                />
                {numeroLista ? (
                  <NumeroPeca peca={peca} numero={numeroLista} fonteAlvo={fonteAlvo} />
                ) : (
                  <>
                    <NomePeca
                      peca={peca}
                      fonteNome={fonteNome}
                      padEsq={peca.largura * 0.12}
                      padBaixo={peca.altura * 0.12}
                    />
                    <CotaHorizontal
                      x={peca.x}
                      y={peca.y + peca.altura - peca.altura * 0.1}
                      comprimento={peca.largura}
                      texto={`${peca.largura}`}
                      fonte={fonteCota}
                      traco={traco}
                    />
                    <CotaVertical
                      x={peca.x + peca.largura * 0.1}
                      y={peca.y}
                      comprimento={peca.altura}
                      texto={`${peca.altura}`}
                      fonte={fonteCota}
                      traco={traco}
                    />
                  </>
                )}
                {editavel && (
                  <rect
                    x={peca.x}
                    y={peca.y}
                    width={peca.largura}
                    height={peca.altura}
                    fill="transparent"
                    className="cursor-grab"
                    style={{ pointerEvents: 'all', touchAction: 'none' }}
                    onPointerDown={(evento) => iniciarArrasto(evento, indice, peca)}
                    onPointerMove={moverArrasto}
                    onPointerUp={(evento) => soltarArrasto(evento, indice)}
                    onPointerCancel={(evento) => soltarArrasto(evento, indice)}
                  />
                )}
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
              <g key={`corte-${corte.ordem}`} pointerEvents="none">
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
        {pecasNumeradas.length > 0 && (
          <aside className="lista-pecas-numeradas w-full shrink-0 rounded-lg bg-white p-3 ring-1 ring-inset ring-stone-200 lg:w-56 print:w-[58mm]">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-600">
              Peças numeradas
            </p>
            <ol className="space-y-1.5 text-xs text-stone-800">
              {pecasNumeradas.map((item) => (
                <li key={`${item.indice}-${item.numero}`}>
                  {editavel && aoClicarPeca ? (
                    <button
                      type="button"
                      onClick={() => aoClicarPeca(item.indice)}
                      className={`flex w-full gap-2 rounded-md px-1 py-0.5 text-left hover:bg-stone-50 ${
                        pecaSelecionada === item.indice ? 'bg-sky-50 ring-1 ring-sky-300' : ''
                      }`}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-madeira-700 text-[10px] font-extrabold text-white">
                        {item.numero}
                      </span>
                      <span>
                        <span className="font-bold tabular-nums">
                          {item.peca.largura} × {item.peca.altura} mm
                        </span>
                        <span className="mt-0.5 block leading-tight text-stone-600">
                          {item.peca.codigo} · {item.peca.descricao}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-madeira-700 text-[10px] font-extrabold text-white">
                        {item.numero}
                      </span>
                      <span>
                        <span className="font-bold tabular-nums">
                          {item.peca.largura} × {item.peca.altura} mm
                        </span>
                        <span className="mt-0.5 block leading-tight text-stone-600">
                          {item.peca.codigo} · {item.peca.descricao}
                        </span>
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}

function NumeroPeca({
  peca,
  numero,
  fonteAlvo,
}: {
  peca: ChapaDoPlano['pecas'][number];
  numero: number;
  fonteAlvo: number;
}) {
  const cx = peca.x + peca.largura / 2;
  const cy = peca.y + peca.altura / 2;
  const raio = Math.min(Math.min(peca.largura, peca.altura) * 0.32, fonteAlvo * 0.85);
  const fonte = raio * 1.05;
  return (
    <g>
      <circle cx={cx} cy={cy} r={raio} fill="#7c4a21" stroke="#fff7ed" strokeWidth={raio * 0.12} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff7ed"
        fontSize={fonte}
        fontWeight={800}
      >
        {numero}
      </text>
    </g>
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
        stroke="#f8f1e7"
        strokeWidth={fonte * 0.22}
        paintOrder="stroke"
        fontSize={fonte}
        fontWeight={800}
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
        stroke="#f8f1e7"
        strokeWidth={fonte * 0.22}
        paintOrder="stroke"
        fontSize={fonte}
        fontWeight={800}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        {texto}
      </text>
    </g>
  );
}

function BotaoSeta({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-700 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
    >
      {children}
    </button>
  );
}

function DialogoPecaPlano({
  peca,
  veio,
  aoFechar,
  aoGirar,
  aoAplicarMedidas,
  aoMover,
}: {
  peca: PecaNoPlano;
  veio: Veio;
  aoFechar: () => void;
  aoGirar: () => void;
  aoAplicarMedidas: (largura: number, altura: number) => boolean;
  aoMover: (x: number, y: number) => boolean;
}) {
  const [largura, setLargura] = useState(String(peca.largura));
  const [altura, setAltura] = useState(String(peca.altura));
  const [x, setX] = useState(String(peca.x));
  const [y, setY] = useState(String(peca.y));
  const [erro, setErro] = useState<string | null>(null);
  const [passo, setPasso] = useState(PASSO_GROSSO_MM);
  const podeGirar = veio === 'INDIFERENTE';

  useEffect(() => {
    setLargura(String(peca.largura));
    setAltura(String(peca.altura));
    setX(String(peca.x));
    setY(String(peca.y));
  }, [peca.codigo, peca.largura, peca.altura, peca.x, peca.y, peca.girada]);

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFechar();
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  function aplicarMedidas() {
    const novaLargura = Math.round(numero(largura));
    const novaAltura = Math.round(numero(altura));
    if (novaLargura <= 0 || novaAltura <= 0) {
      setErro('Informe largura e altura maiores que zero.');
      return;
    }
    if (aoAplicarMedidas(novaLargura, novaAltura)) setErro(null);
    else setErro('A peça não cabe com essas medidas nesta posição, com o espaço da serra.');
  }

  function aplicarPosicao() {
    const novoX = Math.round(numero(x));
    const novoY = Math.round(numero(y));
    if (aoMover(novoX, novoY)) setErro(null);
    else {
      setErro('Essa posição encosta em outra peça ou sai da área útil da chapa.');
      setX(String(peca.x));
      setY(String(peca.y));
    }
  }

  function deslocar(dx: number, dy: number) {
    if (aoMover(peca.x + dx, peca.y + dy)) setErro(null);
    else setErro('Não foi possível mover nessa direção.');
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[min(100%-2rem,28rem)] print:hidden"
      role="dialog"
      aria-labelledby="titulo-editar-peca"
    >
      <div className="cartao max-h-[min(90vh,40rem)] overflow-y-auto p-5 shadow-xl ring-1 ring-stone-200">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-editar-peca" className="text-lg font-bold text-stone-900">
              Editar peça no plano
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {peca.codigo} · {peca.descricao}
              {peca.girada ? ' · girada' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Largura (mm)"
            inputMode="numeric"
            value={largura}
            onChange={(evento) => setLargura(evento.target.value)}
          />
          <Campo
            rotulo="Altura (mm)"
            inputMode="numeric"
            value={altura}
            onChange={(evento) => setAltura(evento.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao type="button" onClick={aplicarMedidas}>
            Aplicar medidas
          </Botao>
          <Botao type="button" variante="secundario" onClick={aoGirar} disabled={!podeGirar}>
            Girar 90°
          </Botao>
        </div>
        {!podeGirar && (
          <p className="mt-2 text-xs text-stone-500">
            {VEIO_LABEL[veio]}. Com veio definido a peça não gira no plano.
          </p>
        )}

        <div className="mt-5 border-t border-stone-200 pt-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">Posição na chapa</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="X (mm)"
              inputMode="numeric"
              value={x}
              onChange={(evento) => setX(evento.target.value)}
              onBlur={aplicarPosicao}
            />
            <Campo
              rotulo="Y (mm)"
              inputMode="numeric"
              value={y}
              onChange={(evento) => setY(evento.target.value)}
              onBlur={aplicarPosicao}
            />
          </div>
          <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid grid-cols-3 gap-1">
                <span />
                <BotaoSeta rotulo={`Mover ${passo} mm para cima`} onClick={() => deslocar(0, -passo)}>
                  ↑
                </BotaoSeta>
                <span />
                <BotaoSeta rotulo={`Mover ${passo} mm para a esquerda`} onClick={() => deslocar(-passo, 0)}>
                  ←
                </BotaoSeta>
                <span />
                <BotaoSeta rotulo={`Mover ${passo} mm para a direita`} onClick={() => deslocar(passo, 0)}>
                  →
                </BotaoSeta>
                <span />
                <BotaoSeta rotulo={`Mover ${passo} mm para baixo`} onClick={() => deslocar(0, passo)}>
                  ↓
                </BotaoSeta>
                <span />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setPasso(PASSO_FINO_MM)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    passo === PASSO_FINO_MM
                      ? 'bg-madeira-700 text-white'
                      : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-300'
                  }`}
                >
                  1 mm
                </button>
                <button
                  type="button"
                  onClick={() => setPasso(PASSO_GROSSO_MM)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    passo === PASSO_GROSSO_MM
                      ? 'bg-madeira-700 text-white'
                      : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-300'
                  }`}
                >
                  10 mm
                </button>
              </div>
            </div>
            <p className="max-w-xs text-xs text-stone-500">
              Mova com as setas, pelos campos X e Y ou arrastando a peça no desenho.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Botao type="button" variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </div>
    </div>
  );
}
