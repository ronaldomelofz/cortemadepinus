import type { Veio } from './types';
import { arredondar } from './calc';

/** Largura do disco da seccionadora, em mm. */
export const SERRA_PADRAO_MM = 4.4;

/** Valor padrão do corte, em reais. A central ajusta no painel administrador. */
export const VALOR_CORTE_PADRAO = 0;

export interface OpcoesOtimizacao {
  serraMm?: number;
  /** Reserva as bordas da chapa (defeito de fábrica) usando a espessura da serra. */
  apararBordas?: boolean;
}

const EPS = 0.51;

export interface ItemParaOtimizar {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
  quantidade: number;
  veio?: Veio;
}

export interface ChapaParaOtimizar {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
}

export interface PecaNoPlano {
  codigo: number;
  descricao: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  girada: boolean;
}

export type SentidoEntrada = 'COMPRIMENTO' | 'LARGURA';
export type FaseCorte = 'APARAR' | 'LONGO' | 'CURTO';

export interface CorteNoPlano {
  ordem: number;
  direcao: 'HORIZONTAL' | 'VERTICAL';
  fase: FaseCorte;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ChapaDoPlano {
  indice: number;
  materialCodigo: number;
  materialDescricao: string;
  chapaLargura: number;
  chapaAltura: number;
  /** COMPRIMENTO = entra pelo lado X (ex.: 2750); LARGURA = entra pelo lado Y (ex.: 1840). */
  sentidoEntrada: SentidoEntrada;
  sentidoEntradaMm: number;
  /** Se definido, os cortes usam este sentido em vez da detecção automática. */
  sentidoForcado?: SentidoEntrada;
  pecas: PecaNoPlano[];
  cortes: CorteNoPlano[];
  areaUsadaMm2: number;
  aproveitamento: number;
}

export interface ResultadoOtimizacao {
  chapas: ChapaDoPlano[];
  naoEncaixadas: Array<{ codigo: number; descricao: string; largura: number; altura: number; motivo: string }>;
  totalChapas: number;
  totalCortes: number;
  aproveitamentoMedio: number;
  serraMm: number;
}

/** Área útil da chapa depois de aparar as quatro bordas com a espessura da serra. */
export function areaUtilChapa(
  chapa: Pick<ChapaParaOtimizar, 'largura' | 'altura'>,
  serra: number,
  apararBordas = true,
): { x: number; y: number; w: number; h: number } {
  const margem = apararBordas && serra > EPS ? serra : 0;
  return {
    x: margem,
    y: margem,
    w: Math.max(0, chapa.largura - 2 * margem),
    h: Math.max(0, chapa.altura - 2 * margem),
  };
}

interface RetanguloLivre {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Unidade {
  codigo: number;
  descricao: string;
  largura: number;
  altura: number;
  veio: Veio;
}

interface Colocacao {
  pecas: PecaNoPlano[];
  restantes: Unidade[];
}

function podeGirar(veio: Veio): boolean {
  return veio === 'INDIFERENTE';
}

function expandir(itens: ItemParaOtimizar[]): Unidade[] {
  const unidades: Unidade[] = [];
  for (const item of itens) {
    const qtd = Math.max(0, Math.floor(item.quantidade) || 0);
    for (let i = 0; i < qtd; i += 1) {
      unidades.push({
        codigo: item.codigo,
        descricao: item.descricao,
        largura: item.largura,
        altura: item.altura,
        veio: item.veio ?? 'INDIFERENTE',
      });
    }
  }
  unidades.sort((a, b) => {
    const area = b.largura * b.altura - a.largura * a.altura;
    if (area !== 0) return area;
    return Math.max(b.largura, b.altura) - Math.max(a.largura, a.altura);
  });
  return unidades;
}

function cabeNaChapa(unidade: Unidade, chapa: ChapaParaOtimizar, serra: number, apararBordas: boolean): boolean {
  const util = areaUtilChapa(chapa, serra, apararBordas);
  return (
    (unidade.largura <= util.w && unidade.altura <= util.h) ||
    (podeGirar(unidade.veio) && unidade.altura <= util.w && unidade.largura <= util.h)
  );
}

function orientacoes(livre: RetanguloLivre, peca: Unidade) {
  const opcoes: Array<{ w: number; h: number; girada: boolean }> = [];
  if (peca.largura <= livre.w + EPS && peca.altura <= livre.h + EPS) {
    opcoes.push({ w: peca.largura, h: peca.altura, girada: false });
  }
  if (podeGirar(peca.veio) && peca.altura <= livre.w + EPS && peca.largura <= livre.h + EPS) {
    opcoes.push({ w: peca.altura, h: peca.largura, girada: true });
  }
  opcoes.sort((a, b) => {
    const sobraA = Math.min(livre.w - a.w, livre.h - a.h);
    const sobraB = Math.min(livre.w - b.w, livre.h - b.h);
    return sobraB - sobraA;
  });
  return opcoes;
}

function scoreRetalhos(rects: RetanguloLivre[]): number {
  const validos = rects.filter((r) => r.w >= 1 && r.h >= 1);
  if (validos.length === 0) return -1;
  const maiorMin = Math.max(...validos.map((r) => Math.min(r.w, r.h)));
  const maiorArea = Math.max(...validos.map((r) => r.w * r.h));
  return maiorMin * 1_000_000 + maiorArea;
}

/** Escolhe o corte guilhotina (faixa horizontal ou coluna) que deixa o maior retalho aproveitável. */
function dividirGuillotine(livre: RetanguloLivre, w: number, h: number, serra: number): RetanguloLivre[] {
  const faixaHorizontal = [
    { x: livre.x + w + serra, y: livre.y, w: livre.w - w - serra, h },
    { x: livre.x, y: livre.y + h + serra, w: livre.w, h: livre.h - h - serra },
  ];
  const colunaVertical = [
    { x: livre.x + w + serra, y: livre.y, w: livre.w - w - serra, h: livre.h },
    { x: livre.x, y: livre.y + h + serra, w, h: livre.h - h - serra },
  ];
  const escolhido =
    scoreRetalhos(colunaVertical) > scoreRetalhos(faixaHorizontal) ? colunaVertical : faixaHorizontal;
  return escolhido.filter((r) => r.w >= 1 && r.h >= 1);
}

function melhorEncaixe(
  livres: RetanguloLivre[],
  peca: Unidade,
  serra: number,
): { indice: number; w: number; h: number; girada: boolean; y: number; x: number } | null {
  let melhor: {
    indice: number;
    w: number;
    h: number;
    girada: boolean;
    y: number;
    x: number;
    score: number;
  } | null = null;
  for (let indice = 0; indice < livres.length; indice += 1) {
    const livre = livres[indice];
    for (const opcao of orientacoes(livre, peca)) {
      const retalhos = dividirGuillotine(livre, opcao.w, opcao.h, serra);
      const score = scoreRetalhos(retalhos) - livre.y * 10 - livre.x * 0.001;
      if (!melhor || score > melhor.score) {
        melhor = {
          indice,
          w: opcao.w,
          h: opcao.h,
          girada: opcao.girada,
          y: livre.y,
          x: livre.x,
          score,
        };
      }
    }
  }
  return melhor;
}

function empacotarGuillotine(
  unidades: Unidade[],
  chapa: ChapaParaOtimizar,
  serra: number,
  apararBordas: boolean,
): Colocacao {
  const util = areaUtilChapa(chapa, serra, apararBordas);
  const livres: RetanguloLivre[] = [{ x: util.x, y: util.y, w: util.w, h: util.h }];
  const pecas: PecaNoPlano[] = [];
  const restantes: Unidade[] = [];

  for (const unidade of unidades) {
    const encaixe = melhorEncaixe(livres, unidade, serra);
    if (!encaixe) {
      restantes.push(unidade);
      continue;
    }
    const livre = livres.splice(encaixe.indice, 1)[0];
    pecas.push({
      codigo: unidade.codigo,
      descricao: unidade.descricao,
      x: livre.x,
      y: livre.y,
      largura: encaixe.w,
      altura: encaixe.h,
      girada: encaixe.girada,
    });
    livres.push(...dividirGuillotine(livre, encaixe.w, encaixe.h, serra));
    livres.sort((a, b) => a.y - b.y || a.x - b.x || a.w * a.h - b.w * b.h);
  }

  return { pecas, restantes };
}

interface PecaNaFaixa {
  indice: number;
  w: number;
  h: number;
  along: number;
  thick: number;
  girada: boolean;
  unidade: Unidade;
}

function orientacaoNaFaixa(
  peca: Unidade,
  comprimentoLivre: number,
  espessura: number,
  vertical: boolean,
): { w: number; h: number; along: number; thick: number; girada: boolean } | null {
  const opcoes: Array<{ w: number; h: number; along: number; thick: number; girada: boolean }> = [];
  const tentar = (w: number, h: number, girada: boolean) => {
    const thick = vertical ? w : h;
    const along = vertical ? h : w;
    if (thick <= espessura + EPS && along <= comprimentoLivre + EPS) {
      opcoes.push({ w, h, along, thick, girada });
    }
  };
  tentar(peca.largura, peca.altura, false);
  if (podeGirar(peca.veio)) tentar(peca.altura, peca.largura, true);
  opcoes.sort((a, b) => {
    const encaixeA = Math.abs(a.thick - espessura);
    const encaixeB = Math.abs(b.thick - espessura);
    if (encaixeA !== encaixeB) return encaixeA - encaixeB;
    return b.along - a.along;
  });
  return opcoes[0] ?? null;
}

function preencherNaOrdem(
  restantes: Unidade[],
  ordem: number[],
  comprimento: number,
  espessura: number,
  serra: number,
  vertical: boolean,
): PecaNaFaixa[] {
  const escolhidas: PecaNaFaixa[] = [];
  const usados = new Set<number>();
  let usado = 0;

  const tentar = (somenteExata: boolean) => {
    for (const i of ordem) {
      if (usados.has(i)) continue;
      const unidade = restantes[i];
      const livre = comprimento - usado;
      if (livre < 1) break;
      const opcao = orientacaoNaFaixa(unidade, livre, espessura, vertical);
      if (!opcao) continue;
      if (somenteExata && Math.abs(opcao.thick - espessura) > EPS) continue;
      escolhidas.push({ indice: i, ...opcao, unidade });
      usados.add(i);
      usado += opcao.along + serra;
    }
  };

  tentar(true);
  tentar(false);
  return escolhidas;
}

function areaFaixa(itens: PecaNaFaixa[]): number {
  return itens.reduce((total, item) => total + item.w * item.h, 0);
}

function preencherFaixa(
  restantes: Unidade[],
  comprimento: number,
  espessura: number,
  serra: number,
  vertical: boolean,
): PecaNaFaixa[] {
  const todos = restantes.map((_, i) => i);
  const tentativas: PecaNaFaixa[][] = [
    preencherNaOrdem(restantes, todos, comprimento, espessura, serra, vertical),
    preencherNaOrdem(restantes, [...todos].reverse(), comprimento, espessura, serra, vertical),
  ];

  const vistos = new Set<number>();
  for (let i = 0; i < restantes.length; i += 1) {
    if (vistos.has(restantes[i].codigo)) continue;
    vistos.add(restantes[i].codigo);
    const resto = todos.filter((j) => j !== i);
    tentativas.push(preencherNaOrdem(restantes, [i, ...resto], comprimento, espessura, serra, vertical));
    tentativas.push(preencherNaOrdem(restantes, [i, ...resto].reverse(), comprimento, espessura, serra, vertical));
    tentativas.push(
      preencherNaOrdem(restantes, [i, ...[...resto].reverse()], comprimento, espessura, serra, vertical),
    );
  }

  return tentativas.reduce((melhor, atual) => {
    const areaAtual = areaFaixa(atual);
    const areaMelhor = areaFaixa(melhor);
    if (areaAtual > areaMelhor + 1) return atual;
    if (Math.abs(areaAtual - areaMelhor) <= 1 && atual.length > melhor.length) return atual;
    return melhor;
  });
}

function espessurasCandidatas(restantes: Unidade[], maxEspessura: number, vertical: boolean): number[] {
  const valores: number[] = [];
  for (const unidade of restantes) {
    const natural = vertical ? unidade.largura : unidade.altura;
    const girada = vertical ? unidade.altura : unidade.largura;
    if (natural <= maxEspessura + EPS) valores.push(natural);
    if (podeGirar(unidade.veio) && girada <= maxEspessura + EPS) valores.push(girada);
  }
  const unicos: number[] = [];
  valores.sort((a, b) => a - b);
  for (const valor of valores) {
    if (unicos.length === 0 || Math.abs(unicos[unicos.length - 1] - valor) > EPS) unicos.push(valor);
  }
  return unicos;
}

function empacotarFaixas(
  unidades: Unidade[],
  chapa: ChapaParaOtimizar,
  serra: number,
  vertical: boolean,
  apararBordas: boolean,
): Colocacao {
  const util = areaUtilChapa(chapa, serra, apararBordas);
  const comprimentoChapa = vertical ? util.h : util.w;
  const espessuraChapa = vertical ? util.w : util.h;
  const restantes = [...unidades];
  const pecas: PecaNoPlano[] = [];
  let cursor = 0;

  while (restantes.length > 0) {
    const espaco = espessuraChapa - cursor;
    if (espaco < 1) break;

    let melhor: {
      espessura: number;
      itens: ReturnType<typeof preencherFaixa>;
      area: number;
    } | null = null;

    for (const espessura of espessurasCandidatas(restantes, espaco, vertical)) {
      const itens = preencherFaixa(restantes, comprimentoChapa, espessura, serra, vertical);
      if (itens.length === 0) continue;
      const area = itens.reduce((total, item) => total + item.w * item.h, 0);
      const aproveita = area / (comprimentoChapa * espessura);
      const melhorAproveita = melhor ? melhor.area / (comprimentoChapa * melhor.espessura) : -1;
      if (
        !melhor ||
        aproveita > melhorAproveita + 0.001 ||
        (Math.abs(aproveita - melhorAproveita) <= 0.001 && itens.length > melhor.itens.length) ||
        (Math.abs(aproveita - melhorAproveita) <= 0.001 &&
          itens.length === melhor.itens.length &&
          espessura < melhor.espessura)
      ) {
        melhor = { espessura, itens, area };
      }
    }

    if (!melhor) break;

    let along = 0;
    for (const item of melhor.itens) {
      pecas.push({
        codigo: item.unidade.codigo,
        descricao: item.unidade.descricao,
        x: vertical ? util.x + cursor : util.x + along,
        y: vertical ? util.y + along : util.y + cursor,
        largura: item.w,
        altura: item.h,
        girada: item.girada,
      });
      along += item.along + serra;
    }

    const remover = new Set(melhor.itens.map((item) => item.indice));
    for (let i = restantes.length - 1; i >= 0; i -= 1) {
      if (remover.has(i)) restantes.splice(i, 1);
    }
    cursor += melhor.espessura + serra;
  }

  return { pecas, restantes };
}

function caixaPecas(pecas: PecaNoPlano[]) {
  if (pecas.length === 0) return { maxX: 0, maxY: 0 };
  return {
    maxX: Math.max(...pecas.map((p) => p.x + p.largura)),
    maxY: Math.max(...pecas.map((p) => p.y + p.altura)),
  };
}

/** Maior retalho retangular contínuo, assumindo peças agrupadas no canto superior esquerdo. */
function maiorRetalhoMm2(chapa: ChapaParaOtimizar, pecas: PecaNoPlano[]): number {
  const { maxX, maxY } = caixaPecas(pecas);
  const aDireita = Math.max(0, chapa.largura - maxX) * chapa.altura;
  const abaixo = chapa.largura * Math.max(0, chapa.altura - maxY);
  return Math.max(aDireita, abaixo);
}

/**
 * Na seccionadora o corte longo atravessa a chapa inteira. A sobra realmente
 * reaproveitável é o que resta DEPOIS dessas ripas, principalmente o retalho
 * que ainda conserva o lado maior da chapa (ex.: 2750 mm).
 */
function sobraAproveitavelSeccionadora(chapa: ChapaParaOtimizar, pecas: PecaNoPlano[]): number {
  if (pecas.length === 0) return chapa.largura * chapa.altura;
  const { maxX, maxY } = caixaPecas(pecas);
  const abaixo = Math.max(0, chapa.altura - maxY) * chapa.largura;
  const direita = Math.max(0, chapa.largura - maxX) * chapa.altura;
  const paisagem = chapa.largura >= chapa.altura;
  const sobraLonga = paisagem ? abaixo : direita;
  const sobraCurta = paisagem ? direita : abaixo;
  const menorLadoLonga = paisagem ? Math.max(0, chapa.altura - maxY) : Math.max(0, chapa.largura - maxX);
  const ladoLongo = Math.max(chapa.largura, chapa.altura);
  return sobraLonga * 2 + menorLadoLonga * ladoLongo + sobraCurta * 0.2;
}

function compararColocacao(chapa: ChapaParaOtimizar, a: Colocacao, b: Colocacao): number {
  const pecasA = a.pecas.length;
  const pecasB = b.pecas.length;
  if (pecasA !== pecasB) return pecasB - pecasA;
  const scoreA = sobraAproveitavelSeccionadora(chapa, a.pecas);
  const scoreB = sobraAproveitavelSeccionadora(chapa, b.pecas);
  if (Math.abs(scoreB - scoreA) > 1) return scoreB - scoreA;
  const retalho = maiorRetalhoMm2(chapa, b.pecas) - maiorRetalhoMm2(chapa, a.pecas);
  if (Math.abs(retalho) > 1) return retalho;
  const caixaA = caixaPecas(a.pecas);
  const caixaB = caixaPecas(b.pecas);
  if (chapa.largura >= chapa.altura && Math.abs(caixaA.maxY - caixaB.maxY) > 1) {
    return caixaA.maxY - caixaB.maxY;
  }
  if (chapa.altura > chapa.largura && Math.abs(caixaA.maxX - caixaB.maxX) > 1) {
    return caixaA.maxX - caixaB.maxX;
  }
  return caixaA.maxX * caixaA.maxY - caixaB.maxX * caixaB.maxY;
}

function empacotarChapa(
  unidades: Unidade[],
  chapa: ChapaParaOtimizar,
  serra: number,
  apararBordas: boolean,
): Colocacao {
  const candidatas = [
    empacotarFaixas(unidades, chapa, serra, false, apararBordas),
    empacotarFaixas(unidades, chapa, serra, true, apararBordas),
    empacotarGuillotine(unidades, chapa, serra, apararBordas),
  ];
  return candidatas.reduce((melhor, atual) => (compararColocacao(chapa, melhor, atual) > 0 ? atual : melhor));
}

/**
 * Reempacota as peças já presentes na chapa, mantendo a orientação atual de cada uma
 * e agrupando no canto/borda mais próximo de onde o usuário as deixou.
 */
export function organizarPecasNaChapa(
  pecas: PecaNoPlano[],
  chapa: Pick<ChapaParaOtimizar, 'largura' | 'altura'>,
  serra: number,
  apararBordas = true,
): PecaNoPlano[] {
  if (pecas.length === 0) return [];
  const util = areaUtilChapa(chapa, serra, apararBordas);
  const ancora = ancoraPeloMovimento(pecas, util);
  const origem = pecas.map((peca, indice) => ({ peca, indice }));
  origem.sort((a, b) => b.peca.largura * b.peca.altura - a.peca.largura * a.peca.altura);
  const unidades: Unidade[] = origem.map(({ peca }) => ({
    codigo: peca.codigo,
    descricao: peca.descricao,
    largura: peca.largura,
    altura: peca.altura,
    veio: 'COMPRIMENTO',
  }));
  const material: ChapaParaOtimizar = {
    codigo: 0,
    descricao: '',
    largura: chapa.largura,
    altura: chapa.altura,
  };
  let colocacao = empacotarFaixas(unidades, material, serra, ancora.faixasVerticais, apararBordas);
  if (colocacao.restantes.length > 0) {
    colocacao = empacotarChapa(unidades, material, serra, apararBordas);
  }
  if (colocacao.restantes.length > 0 || colocacao.pecas.length !== pecas.length) return pecas;

  const fila = [...origem];
  const agrupadas = colocacao.pecas.map((colocada) => {
    const pos = fila.findIndex(
      (item) =>
        item.peca.codigo === colocada.codigo &&
        item.peca.largura === colocada.largura &&
        item.peca.altura === colocada.altura,
    );
    const original = pos >= 0 ? fila.splice(pos, 1)[0].peca : colocada;
    return { ...colocada, girada: original.girada };
  });
  return ancorarNoCanto(agrupadas, util, ancora);
}

function ancoraPeloMovimento(
  pecas: PecaNoPlano[],
  util: { x: number; y: number; w: number; h: number },
): { direita: boolean; baixo: boolean; faixasVerticais: boolean } {
  const cx = pecas.reduce((soma, peca) => soma + peca.x + peca.largura / 2, 0) / pecas.length;
  const cy = pecas.reduce((soma, peca) => soma + peca.y + peca.altura / 2, 0) / pecas.length;
  const minX = Math.min(...pecas.map((peca) => peca.x));
  const minY = Math.min(...pecas.map((peca) => peca.y));
  const spanX = Math.max(...pecas.map((peca) => peca.x + peca.largura)) - minX;
  const spanY = Math.max(...pecas.map((peca) => peca.y + peca.altura)) - minY;
  return {
    direita: cx > util.x + util.w / 2,
    baixo: cy > util.y + util.h / 2,
    faixasVerticais: spanY >= spanX,
  };
}

function ancorarNoCanto(
  pecas: PecaNoPlano[],
  util: { x: number; y: number; w: number; h: number },
  ancora: { direita: boolean; baixo: boolean },
): PecaNoPlano[] {
  return pecas.map((peca) => {
    const localX = peca.x - util.x;
    const localY = peca.y - util.y;
    const x = ancora.direita ? util.x + util.w - localX - peca.largura : peca.x;
    const y = ancora.baixo ? util.y + util.h - localY - peca.altura : peca.y;
    return { ...peca, x: Math.round(x), y: Math.round(y) };
  });
}

function unicos(valores: number[]): number[] {
  const ordenados = [...valores].sort((a, b) => a - b);
  const saida: number[] = [];
  for (const valor of ordenados) {
    if (saida.length === 0 || Math.abs(saida[saida.length - 1] - valor) > EPS) saida.push(valor);
  }
  return saida;
}

function atravessaVertical(cx: number, pecas: PecaNoPlano[]): boolean {
  return pecas.every((p) => p.x + p.largura <= cx + EPS || p.x >= cx - EPS);
}

function atravessaHorizontal(cy: number, pecas: PecaNoPlano[]): boolean {
  return pecas.every((p) => p.y + p.altura <= cy + EPS || p.y >= cy - EPS);
}

interface Faixa {
  origem: number;
  espessura: number;
  pecas: PecaNoPlano[];
}

function faixasHorizontais(pecas: PecaNoPlano[]): Faixa[] {
  return unicos(pecas.map((p) => p.y)).map((y) => {
    const grupo = pecas.filter((p) => Math.abs(p.y - y) <= EPS);
    const espessura = Math.min(...grupo.map((p) => p.altura));
    return { origem: y, espessura, pecas: grupo };
  });
}

function faixasVerticais(pecas: PecaNoPlano[]): Faixa[] {
  return unicos(pecas.map((p) => p.x)).map((x) => {
    const grupo = pecas.filter((p) => Math.abs(p.x - x) <= EPS);
    const espessura = Math.min(...grupo.map((p) => p.largura));
    return { origem: x, espessura, pecas: grupo };
  });
}

function faixaSemSobreposicao(faixa: Faixa, eixo: 'x' | 'y'): boolean {
  const ordenadas = [...faixa.pecas].sort((a, b) => a[eixo] - b[eixo]);
  for (let i = 1; i < ordenadas.length; i += 1) {
    const anterior = ordenadas[i - 1];
    const fim = eixo === 'x' ? anterior.x + anterior.largura : anterior.y + anterior.altura;
    if (ordenadas[i][eixo] + EPS < fim) return false;
  }
  return true;
}

function qualidadeFaixas(faixas: Faixa[], totalPecas: number, eixo: 'x' | 'y'): number {
  if (totalPecas === 0) return 0;
  const boas = faixas.filter((faixa) => faixaSemSobreposicao(faixa, eixo));
  const pecasBoas = boas.reduce((n, faixa) => n + faixa.pecas.length, 0);
  return pecasBoas / totalPecas;
}

function podeRiparHorizontal(pecas: PecaNoPlano[], chapa: ChapaParaOtimizar): boolean {
  return unicos(pecas.map((p) => p.y + p.altura)).some(
    (cy) => cy > EPS && cy < chapa.altura - EPS && atravessaHorizontal(cy, pecas),
  );
}

function podeRiparVertical(pecas: PecaNoPlano[], chapa: ChapaParaOtimizar): boolean {
  return unicos(pecas.map((p) => p.x + p.largura)).some(
    (cx) => cx > EPS && cx < chapa.largura - EPS && atravessaVertical(cx, pecas),
  );
}

/**
 * Sentido em que a chapa entra na seccionadora, para o operador não girar a placa.
 * COMPRIMENTO = cortes longos no eixo X (ex.: 2750). LARGURA = cortes longos no eixo Y (ex.: 1840).
 */
export function detectarSentidoEntrada(chapa: ChapaParaOtimizar, pecas: PecaNoPlano[]): SentidoEntrada {
  const scoreH = qualidadeFaixas(faixasHorizontais(pecas), pecas.length, 'x');
  const scoreV = qualidadeFaixas(faixasVerticais(pecas), pecas.length, 'y');
  const ripH = podeRiparHorizontal(pecas, chapa);
  const ripV = podeRiparVertical(pecas, chapa);

  if (scoreH > scoreV + 0.15 && ripH) return 'COMPRIMENTO';
  if (scoreV > scoreH + 0.15 && ripV) return 'LARGURA';

  const preferido: SentidoEntrada = chapa.largura >= chapa.altura ? 'COMPRIMENTO' : 'LARGURA';
  if (preferido === 'COMPRIMENTO' && ripH) return 'COMPRIMENTO';
  if (preferido === 'LARGURA' && ripV) return 'LARGURA';
  if (ripH) return 'COMPRIMENTO';
  if (ripV) return 'LARGURA';
  return preferido;
}

interface CorteBruto {
  direcao: 'HORIZONTAL' | 'VERTICAL';
  fase: FaseCorte;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function gerarCortesSeccionadora(
  chapa: ChapaParaOtimizar,
  pecas: PecaNoPlano[],
  serra: number,
  apararBordas: boolean,
  sentido: SentidoEntrada,
): CorteBruto[] {
  if (pecas.length === 0) return [];
  const longos: CorteBruto[] = [];
  const curtos: CorteBruto[] = [];
  const aparar = apararBordas && serra > EPS;

  if (sentido === 'COMPRIMENTO') {
    if (aparar) {
      longos.push({
        direcao: 'HORIZONTAL',
        fase: 'APARAR',
        x1: 0,
        y1: serra,
        x2: chapa.largura,
        y2: serra,
      });
    }
    for (const cy of unicos(pecas.map((p) => p.y + p.altura))) {
      if (cy <= EPS || cy >= chapa.altura - EPS) continue;
      if (!atravessaHorizontal(cy, pecas)) continue;
      longos.push({
        direcao: 'HORIZONTAL',
        fase: 'LONGO',
        x1: 0,
        y1: cy,
        x2: chapa.largura,
        y2: cy,
      });
    }
    for (const faixa of faixasHorizontais(pecas)) {
      if (aparar) {
        curtos.push({
          direcao: 'VERTICAL',
          fase: 'APARAR',
          x1: serra,
          y1: faixa.origem,
          x2: serra,
          y2: faixa.origem + faixa.espessura,
        });
      }
      for (const cx of unicos(faixa.pecas.map((p) => p.x + p.largura))) {
        if (cx <= EPS || cx >= chapa.largura - EPS) continue;
        if (!atravessaVertical(cx, faixa.pecas)) continue;
        curtos.push({
          direcao: 'VERTICAL',
          fase: 'CURTO',
          x1: cx,
          y1: faixa.origem,
          x2: cx,
          y2: faixa.origem + faixa.espessura,
        });
      }
    }
  } else {
    if (aparar) {
      longos.push({
        direcao: 'VERTICAL',
        fase: 'APARAR',
        x1: serra,
        y1: 0,
        x2: serra,
        y2: chapa.altura,
      });
    }
    for (const cx of unicos(pecas.map((p) => p.x + p.largura))) {
      if (cx <= EPS || cx >= chapa.largura - EPS) continue;
      if (!atravessaVertical(cx, pecas)) continue;
      longos.push({
        direcao: 'VERTICAL',
        fase: 'LONGO',
        x1: cx,
        y1: 0,
        x2: cx,
        y2: chapa.altura,
      });
    }
    for (const faixa of faixasVerticais(pecas)) {
      if (aparar) {
        curtos.push({
          direcao: 'HORIZONTAL',
          fase: 'APARAR',
          x1: faixa.origem,
          y1: serra,
          x2: faixa.origem + faixa.espessura,
          y2: serra,
        });
      }
      for (const cy of unicos(faixa.pecas.map((p) => p.y + p.altura))) {
        if (cy <= EPS || cy >= chapa.altura - EPS) continue;
        if (!atravessaHorizontal(cy, faixa.pecas)) continue;
        curtos.push({
          direcao: 'HORIZONTAL',
          fase: 'CURTO',
          x1: faixa.origem,
          y1: cy,
          x2: faixa.origem + faixa.espessura,
          y2: cy,
        });
      }
    }
  }

  return [...longos, ...curtos];
}

function gerarCortes(
  chapa: ChapaParaOtimizar,
  pecas: PecaNoPlano[],
  serra: number,
  apararBordas: boolean,
  sentidoForcado?: SentidoEntrada,
): { cortes: CorteNoPlano[]; sentidoEntrada: SentidoEntrada; sentidoEntradaMm: number } {
  const sentidoEntrada = sentidoForcado ?? detectarSentidoEntrada(chapa, pecas);
  const sentidoEntradaMm = sentidoEntrada === 'COMPRIMENTO' ? chapa.largura : chapa.altura;
  const cortes = gerarCortesSeccionadora(chapa, pecas, serra, apararBordas, sentidoEntrada).map((corte, indice) => ({
    ordem: indice + 1,
    direcao: corte.direcao,
    fase: corte.fase,
    x1: corte.x1,
    y1: corte.y1,
    x2: corte.x2,
    y2: corte.y2,
  }));
  return { cortes, sentidoEntrada, sentidoEntradaMm };
}

export function remontarChapaDoPlano(
  chapa: Pick<ChapaDoPlano, 'indice' | 'materialCodigo' | 'materialDescricao' | 'chapaLargura' | 'chapaAltura'>,
  pecas: PecaNoPlano[],
  serra: number,
  apararBordas = true,
  sentidoForcado?: SentidoEntrada,
): ChapaDoPlano {
  const montada = montarChapa(
    chapa.indice,
    {
      codigo: chapa.materialCodigo,
      descricao: chapa.materialDescricao,
      largura: chapa.chapaLargura,
      altura: chapa.chapaAltura,
    },
    pecas,
    serra,
    apararBordas,
    sentidoForcado,
  );
  return sentidoForcado ? { ...montada, sentidoForcado } : montada;
}

function montarChapa(
  indice: number,
  material: ChapaParaOtimizar,
  pecas: PecaNoPlano[],
  serra: number,
  apararBordas: boolean,
  sentidoForcado?: SentidoEntrada,
): ChapaDoPlano {
  const areaUsada = pecas.reduce((total, p) => total + p.largura * p.altura, 0);
  const areaChapa = material.largura * material.altura;
  const { cortes, sentidoEntrada, sentidoEntradaMm } = gerarCortes(
    material,
    pecas,
    serra,
    apararBordas,
    sentidoForcado,
  );
  return {
    indice,
    materialCodigo: material.codigo,
    materialDescricao: material.descricao,
    chapaLargura: material.largura,
    chapaAltura: material.altura,
    sentidoEntrada,
    sentidoEntradaMm,
    ...(sentidoForcado ? { sentidoForcado } : {}),
    pecas,
    cortes,
    areaUsadaMm2: areaUsada,
    aproveitamento: areaChapa > 0 ? arredondar((areaUsada / areaChapa) * 100, 1) : 0,
  };
}

/**
 * Disposição preliminar das peças nas chapas, no estilo de corte em seccionadora
 * (guilhotina / faixas). Prioriza menos chapas e o maior retalho reaproveitável.
 * Com apararBordas (padrão), as quatro bordas da chapa são reservadas na espessura
 * da serra: as peças não usam a borda de fábrica e esses cortes entram na ordem.
 */
export function otimizarPlanos(
  materiais: ChapaParaOtimizar[],
  pecasPorMaterial: Map<number, ItemParaOtimizar[]>,
  opcoes: OpcoesOtimizacao = {},
): ResultadoOtimizacao {
  const serra = opcoes.serraMm ?? SERRA_PADRAO_MM;
  const apararBordas = opcoes.apararBordas ?? true;
  const chapas: ChapaDoPlano[] = [];
  const naoEncaixadas: ResultadoOtimizacao['naoEncaixadas'] = [];

  for (const material of materiais) {
    if (material.largura <= 0 || material.altura <= 0) continue;
    let fila = expandir(pecasPorMaterial.get(material.codigo) ?? []);
    const util = areaUtilChapa(material, serra, apararBordas);

    fila = fila.filter((unidade) => {
      if (cabeNaChapa(unidade, material, serra, apararBordas)) return true;
      naoEncaixadas.push({
        codigo: unidade.codigo,
        descricao: unidade.descricao,
        largura: unidade.largura,
        altura: unidade.altura,
        motivo: apararBordas
          ? `não cabe na área útil ${Math.round(util.w)}×${Math.round(util.h)} mm (chapa ${material.largura}×${material.altura} mm após aparar ${serra} mm nas bordas)`
          : `não cabe na chapa ${material.largura}×${material.altura} mm`,
      });
      return false;
    });

    let indice = 1;
    while (fila.length > 0 && indice <= 200) {
      const { pecas, restantes } = empacotarChapa(fila, material, serra, apararBordas);
      if (pecas.length === 0) {
        restantes.forEach((unidade) =>
          naoEncaixadas.push({
            codigo: unidade.codigo,
            descricao: unidade.descricao,
            largura: unidade.largura,
            altura: unidade.altura,
            motivo: 'não foi possível encaixar nesta chapa',
          }),
        );
        break;
      }
      chapas.push(montarChapa(indice, material, pecas, serra, apararBordas));
      fila = restantes;
      indice += 1;
    }
  }

  const aproveitamentoMedio =
    chapas.length === 0
      ? 0
      : arredondar(chapas.reduce((total, c) => total + c.aproveitamento, 0) / chapas.length, 1);

  return {
    chapas,
    naoEncaixadas,
    totalChapas: chapas.length,
    totalCortes: chapas.reduce((total, chapa) => total + chapa.cortes.length, 0),
    aproveitamentoMedio,
    serraMm: serra,
  };
}
