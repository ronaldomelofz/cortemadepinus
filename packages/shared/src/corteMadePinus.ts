/**
 * Geracao e leitura dos arquivos no layout do Corte MadePinus.
 *
 * Layout do CSV (6 campos separados por virgula, um registro por linha):
 *   1) Codigo da peca      numerico
 *   2) Quantidade          numerico
 *   3) Largura da peca     numerico (mm)
 *   4) Altura da peca      numerico (mm)
 *   5) Material da peca    numerico
 *   6) Descricao da peca   alfanumerico
 *
 * Layout do TXT (7 campos separados por TAB): os seis acima e mais
 * um campo livre de observacao/operacao.
 */

import type { Material, Peca, Pedido, Veio } from './types';
import { RECURSOS } from './recursos';

export interface LinhaCorteMadePinus {
  codigo: number;
  quantidade: number;
  largura: number;
  altura: number;
  material: number;
  descricao: string;
  observacao?: string;
}

const MAX_DESCRICAO = 60;

/** Remove acentos, separadores de campo e quebras de linha da descricao. */
export function sanitizarDescricao(texto: string, separadores = ',;\t'): string {
  const semAcento = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n]+/g, ' ');
  const regex = new RegExp(`[${separadores.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
  return semAcento.replace(regex, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_DESCRICAO);
}

/** Formata numero usando ponto decimal e sem casas desnecessarias. */
export function formatarNumero(valor: number, casas = 1): string {
  const arredondado = Number(valor.toFixed(casas));
  return Number.isInteger(arredondado) ? String(arredondado) : String(arredondado);
}

function ordenarPecas(pecas: Peca[]): Peca[] {
  return [...pecas].sort((a, b) => a.ordem - b.ordem || a.codigo - b.codigo);
}

function mapaMateriais(materiais: Material[]): Map<string, Material> {
  return new Map(materiais.map((m) => [m.id, m]));
}

/**
 * Converte as pecas do pedido para as linhas do layout Corte MadePinus.
 * A largura sempre acompanha o sentido do veio quando ele e informado.
 */
export function montarLinhas(pedido: Pick<Pedido, 'materiais' | 'pecas'>): LinhaCorteMadePinus[] {
  const materiais = mapaMateriais(pedido.materiais);
  return ordenarPecas(pedido.pecas).map((peca) => {
    const material = materiais.get(peca.materialId);
    return {
      codigo: peca.codigo,
      quantidade: peca.quantidade,
      largura: peca.largura,
      altura: peca.altura,
      material: material?.codigo ?? 99000,
      descricao: peca.descricao,
      observacao: montarObservacao(peca),
    };
  });
}

/** Resume veio e (quando ativo) fitas de borda no campo livre do TXT. */
export function montarObservacao(peca: Peca): string {
  const partes: string[] = [];
  if (RECURSOS.fitaDeBorda) {
    const fitas = [
      peca.fitaC1 ? 'C1' : null,
      peca.fitaC2 ? 'C2' : null,
      peca.fitaL1 ? 'L1' : null,
      peca.fitaL2 ? 'L2' : null,
    ].filter(Boolean);
    if (fitas.length) partes.push(`FITA ${fitas.join('+')}`);
  }
  if (peca.veio !== 'INDIFERENTE') partes.push(`VEIO ${peca.veio}`);
  if (peca.observacao) partes.push(peca.observacao);
  return sanitizarDescricao(partes.join(' | '));
}

/** Arquivo CSV no layout de seis campos do Corte MadePinus. */
export function exportarCsvCorteMadePinus(pedido: Pick<Pedido, 'materiais' | 'pecas'>): string {
  return montarLinhas(pedido)
    .map((l) =>
      [
        l.codigo,
        l.quantidade,
        formatarNumero(l.largura),
        formatarNumero(l.altura),
        l.material,
        sanitizarDescricao(l.descricao, ','),
      ].join(','),
    )
    .join('\r\n')
    .concat('\r\n');
}

/** Arquivo TXT (TAB) com o setimo campo de observacao/operacao. */
export function exportarTxtCorteMadePinus(pedido: Pick<Pedido, 'materiais' | 'pecas'>): string {
  return montarLinhas(pedido)
    .map((l) =>
      [
        l.codigo,
        l.quantidade,
        formatarNumero(l.largura),
        formatarNumero(l.altura),
        l.material,
        sanitizarDescricao(l.descricao, '\t'),
        sanitizarDescricao(l.observacao ?? '', '\t') || '-',
      ].join('\t'),
    )
    .join('\r\n')
    .concat('\r\n');
}

/**
 * Planilha completa para o chao de fabrica (separador ";", padrao Excel pt-BR).
 */
export function exportarRelatorioProducaoCsv(pedido: Pedido): string {
  const materiais = mapaMateriais(pedido.materiais);
  const cabecalho = [
    'Codigo',
    'Qtd',
    'Largura (mm)',
    'Altura (mm)',
    'Descricao',
    'Material',
    'Cod. Material',
    'Espessura (mm)',
    'Cor',
    'Veio',
    ...(RECURSOS.fitaDeBorda ? ['Fita C1', 'Fita C2', 'Fita L1', 'Fita L2'] : []),
    'Area unit. (m2)',
    'Area total (m2)',
    'Observacao',
  ].join(';');

  const linhas = ordenarPecas(pedido.pecas).map((peca) => {
    const material = materiais.get(peca.materialId);
    const areaUnit = (peca.largura * peca.altura) / 1_000_000;
    return [
      peca.codigo,
      peca.quantidade,
      formatarNumero(peca.largura),
      formatarNumero(peca.altura),
      sanitizarDescricao(peca.descricao, ';'),
      sanitizarDescricao(material?.descricao ?? '', ';'),
      material?.codigo ?? '',
      material ? formatarNumero(material.espessura, 2) : '',
      sanitizarDescricao(material?.cor ?? '', ';'),
      peca.veio,
      ...(RECURSOS.fitaDeBorda
        ? [peca.fitaC1 ? 'X' : '', peca.fitaC2 ? 'X' : '', peca.fitaL1 ? 'X' : '', peca.fitaL2 ? 'X' : '']
        : []),
      areaUnit.toFixed(4).replace('.', ','),
      (areaUnit * peca.quantidade).toFixed(4).replace('.', ','),
      sanitizarDescricao(peca.observacao ?? '', ';'),
    ].join(';');
  });

  return [cabecalho, ...linhas].join('\r\n').concat('\r\n');
}

/* ------------------------------------------------------------------ */
/* Importacao                                                          */
/* ------------------------------------------------------------------ */

export interface PecaImportada {
  codigo: number;
  quantidade: number;
  largura: number;
  altura: number;
  materialCodigo: number;
  descricao: string;
  observacao?: string;
  veio?: Veio;
  fitaC1?: boolean;
  fitaC2?: boolean;
  fitaL1?: boolean;
  fitaL2?: boolean;
}

export interface ResultadoImportacao {
  pecas: PecaImportada[];
  erros: Array<{ linha: number; mensagem: string; conteudo: string }>;
  separador: string;
  totalLinhas: number;
}

const SEPARADORES = ['\t', ';', ','] as const;

/** Descobre o separador mais provavel olhando as primeiras linhas uteis. */
export function detectarSeparador(conteudo: string): string {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('/') && !l.startsWith('#'))
    .slice(0, 20);
  let melhor = ',';
  let melhorPontuacao = 0;
  for (const sep of SEPARADORES) {
    const contagens = linhas.map((l) => l.split(sep).length);
    const media = contagens.reduce((a, b) => a + b, 0) / (contagens.length || 1);
    if (media > melhorPontuacao) {
      melhorPontuacao = media;
      melhor = sep;
    }
  }
  // Sem nenhum separador convincente, assume o CSV padrao do Corte MadePinus.
  return melhorPontuacao >= 2 ? melhor : ',';
}

/** Aceita "1.234,5", "1234.5" e "1234". */
export function paraNumero(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, '').replace(/"/g, '');
  if (!limpo) return NaN;
  if (limpo.includes(',') && limpo.includes('.')) {
    return Number(limpo.replace(/\./g, '').replace(',', '.'));
  }
  return Number(limpo.replace(',', '.'));
}

function ehCabecalho(campos: string[]): boolean {
  const primeiro = campos[0]?.toLowerCase() ?? '';
  return (
    Number.isNaN(paraNumero(campos[0] ?? '')) &&
    /cod|item|ref|peca|peça|n[uú]mero/.test(primeiro)
  );
}

/**
 * Le um arquivo no layout Corte MadePinus (CSV/TXT) ou uma colagem de planilha.
 * Linhas iniciadas por "/" ou "#" sao tratadas como comentario, conforme o
 * padrao dos arquivos gerados pela propria plataforma.
 */
export function importarPecas(
  conteudo: string,
  opcoes: { materialPadrao?: number } = {},
): ResultadoImportacao {
  const materialPadrao = opcoes.materialPadrao ?? 99000;
  const separador = detectarSeparador(conteudo);
  const linhasBrutas = conteudo.split(/\r?\n/);
  const pecas: PecaImportada[] = [];
  const erros: ResultadoImportacao['erros'] = [];
  let sequencial = 0;

  linhasBrutas.forEach((linhaBruta, indice) => {
    const numeroLinha = indice + 1;
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith('/') || linha.startsWith('#')) return;

    const campos = linha.split(separador).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (campos.length < 4) {
      erros.push({ linha: numeroLinha, mensagem: 'Linha com menos de 4 campos', conteudo: linha });
      return;
    }
    if (ehCabecalho(campos)) return;

    const codigo = paraNumero(campos[0]);
    const quantidade = paraNumero(campos[1]);
    const largura = paraNumero(campos[2]);
    const altura = paraNumero(campos[3]);
    const material = campos.length >= 5 ? paraNumero(campos[4]) : NaN;
    const descricao = (campos[5] ?? campos[4] ?? '').trim();

    if ([quantidade, largura, altura].some((n) => Number.isNaN(n))) {
      erros.push({
        linha: numeroLinha,
        mensagem: 'Quantidade, largura ou altura não numérica',
        conteudo: linha,
      });
      return;
    }
    if (quantidade <= 0 || largura <= 0 || altura <= 0) {
      erros.push({ linha: numeroLinha, mensagem: 'Valores devem ser maiores que zero', conteudo: linha });
      return;
    }

    sequencial += 1;
    pecas.push({
      codigo: Number.isNaN(codigo) || codigo <= 0 ? sequencial : Math.round(codigo),
      quantidade: Math.round(quantidade),
      largura,
      altura,
      materialCodigo: Number.isNaN(material) || material <= 0 ? materialPadrao : Math.round(material),
      descricao: descricao || `Peça ${sequencial}`,
      observacao: campos[6]?.trim() || undefined,
      ...interpretarObservacao(campos[6] ?? ''),
    });
  });

  return { pecas, erros, separador, totalLinhas: linhasBrutas.length };
}

/** Reconhece marcacoes "FITA C1+L2" e "VEIO COMPRIMENTO" no campo livre. */
function interpretarObservacao(texto: string): Partial<PecaImportada> {
  const alvo = texto.toUpperCase();
  const resultado: Partial<PecaImportada> = {};
  if (alvo.includes('FITA')) {
    resultado.fitaC1 = /\bC1\b/.test(alvo);
    resultado.fitaC2 = /\bC2\b/.test(alvo);
    resultado.fitaL1 = /\bL1\b/.test(alvo);
    resultado.fitaL2 = /\bL2\b/.test(alvo);
  }
  if (alvo.includes('VEIO COMPRIMENTO')) resultado.veio = 'COMPRIMENTO';
  else if (alvo.includes('VEIO LARGURA')) resultado.veio = 'LARGURA';
  return resultado;
}

/** Nome de arquivo previsivel para os downloads da central. */
export function nomeArquivo(pedido: Pick<Pedido, 'numero' | 'titulo'>, extensao: string): string {
  const slug = sanitizarDescricao(pedido.titulo, ',;\t')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const numero = String(pedido.numero).padStart(5, '0');
  return `PED${numero}${slug ? `-${slug}` : ''}.${extensao}`;
}
