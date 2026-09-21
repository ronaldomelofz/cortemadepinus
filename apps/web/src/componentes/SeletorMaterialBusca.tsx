import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProdutoMdf } from '@cortemadepinus/shared';
import { materialDeProduto, rotuloMaterial, type MaterialForm } from '../lib/formularioPedido';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Remove separadores para casar "15MM" com "15 mm". */
function compactar(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '');
}

/** Cada trecho digitado precisa aparecer no rótulo (ordem livre). */
function correspondeBusca(rotulo: string, busca: string): boolean {
  const termo = normalizar(busca);
  if (!termo) return true;

  const alvo = normalizar(rotulo);
  const alvoCompacto = compactar(rotulo);
  const trechos = termo.split(/[\s,;.|/\\-]+/).filter(Boolean);

  return trechos.every((trecho) => {
    if (alvo.includes(trecho)) return true;
    const compacto = compactar(trecho);
    return compacto.length > 0 && alvoCompacto.includes(compacto);
  });
}

function SeletorBusca({
  opcoes,
  valor,
  onChange,
  onAvancar,
  className,
  placeholder,
}: {
  opcoes: Array<{ chave: string; codigo: string; rotulo: string }>;
  valor: string;
  onChange: (codigo: string) => void;
  onAvancar?: () => void;
  className: string;
  placeholder: string;
}) {
  const idLista = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const selecionado = opcoes.find((item) => item.codigo === valor);
  const rotuloSelecionado = selecionado?.rotulo ?? '';

  const filtrados = useMemo(
    () => opcoes.filter((item) => correspondeBusca(item.rotulo, busca)),
    [opcoes, busca],
  );

  function atualizarPosicao() {
    const caixa = inputRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const largura = Math.max(caixa.width, 320);
    const maxLeft = Math.max(8, window.innerWidth - largura - 8);
    setPosicao({
      top: Math.min(caixa.bottom + 4, window.innerHeight - 80),
      left: Math.min(Math.max(8, caixa.left), maxLeft),
      width: largura,
    });
  }

  useLayoutEffect(() => {
    if (!aberto) return;
    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    window.addEventListener('scroll', atualizarPosicao, true);
    return () => {
      window.removeEventListener('resize', atualizarPosicao);
      window.removeEventListener('scroll', atualizarPosicao, true);
    };
  }, [aberto, busca, filtrados.length]);

  useEffect(() => {
    if (!aberto) return;
    function fecharFora(evento: MouseEvent) {
      const alvo = evento.target as Node | null;
      if (raiz.current?.contains(alvo)) return;
      if ((alvo as HTMLElement | null)?.closest?.(`[data-lista-busca="${idLista}"]`)) return;
      setAberto(false);
      setBusca('');
    }
    document.addEventListener('mousedown', fecharFora);
    return () => document.removeEventListener('mousedown', fecharFora);
  }, [aberto, idLista]);

  useEffect(() => {
    setDestaque(0);
  }, [busca, aberto]);

  function abrirBusca(textoInicial = '') {
    setAberto(true);
    setBusca(textoInicial);
    window.requestAnimationFrame(atualizarPosicao);
  }

  function escolher(codigo: string) {
    onChange(codigo);
    setAberto(false);
    setBusca('');
    window.setTimeout(() => onAvancar?.(), 0);
  }

  function aoTecla(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' && !aberto) {
      evento.preventDefault();
      if (valor) onAvancar?.();
      else abrirBusca();
      return;
    }
    if (!aberto && evento.key === 'ArrowDown') {
      evento.preventDefault();
      abrirBusca();
      return;
    }
    if (!aberto) return;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setDestaque((atual) => Math.min(atual + 1, Math.max(filtrados.length - 1, 0)));
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setDestaque((atual) => Math.max(atual - 1, 0));
      return;
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      const item = filtrados[destaque];
      if (item) escolher(item.codigo);
      else if (valor) {
        setAberto(false);
        setBusca('');
        onAvancar?.();
      }
      return;
    }
    if (evento.key === 'Escape') {
      setAberto(false);
      setBusca('');
    }
  }

  const lista = aberto
    ? createPortal(
        <ul
          id={idLista}
          data-lista-busca={idLista}
          role="listbox"
          className="max-h-64 overflow-auto rounded-xl border border-madeira-200 bg-white py-1 shadow-2xl"
          style={{
            position: 'fixed',
            top: posicao.top,
            left: posicao.left,
            width: posicao.width,
            zIndex: 9999,
          }}
        >
          {opcoes.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">Nenhum MDF cadastrado no catálogo</li>
          ) : filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">
              Nenhum produto encontrado para “{busca}”
            </li>
          ) : (
            filtrados.map((item, indice) => {
              const ativo = item.codigo === valor;
              const destacado = indice === destaque;
              return (
                <li key={item.chave} role="option" aria-selected={ativo}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2.5 text-left text-sm ${
                      destacado || ativo
                        ? 'bg-madeira-100 font-medium text-madeira-900'
                        : 'text-stone-700 hover:bg-madeira-50'
                    }`}
                    onMouseEnter={() => setDestaque(indice)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolher(item.codigo)}
                  >
                    {item.rotulo}
                  </button>
                </li>
              );
            })
          )}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div ref={raiz} className="relative">
      <input
        ref={inputRef}
        className={className}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={aberto ? busca : rotuloSelecionado}
        onChange={(e) => {
          const texto = e.target.value;
          if (!aberto) {
            // Digitação sobre o rótulo selecionado: inicia busca só com o que o usuário digitou.
            const digitado =
              rotuloSelecionado && texto.startsWith(rotuloSelecionado)
                ? texto.slice(rotuloSelecionado.length)
                : texto;
            abrirBusca(digitado.trimStart());
            return;
          }
          setBusca(texto);
        }}
        onFocus={() => abrirBusca('')}
        onClick={() => {
          if (!aberto) abrirBusca('');
        }}
        onKeyDown={aoTecla}
      />
      {lista}
    </div>
  );
}

export function SeletorMaterialBusca({
  materiais,
  produtosCatalogo = [],
  valor,
  onChange,
  onAvancar,
  className = 'celula-texto',
}: {
  materiais: MaterialForm[];
  /** Catálogo completo da central — garante busca mesmo se o formulário ainda não sincronizou. */
  produtosCatalogo?: ProdutoMdf[];
  valor: string;
  onChange: (codigo: string) => void;
  onAvancar?: () => void;
  className?: string;
}) {
  const opcoes = useMemo(() => {
    const porCodigo = new Map<string, { chave: string; codigo: string; rotulo: string }>();

    for (const produto of produtosCatalogo) {
      const material = materialDeProduto(produto);
      porCodigo.set(material.codigo, {
        chave: `produto-${produto.id}`,
        codigo: material.codigo,
        rotulo: rotuloMaterial(material),
      });
    }

    for (const material of materiais) {
      if (!material.codigo) continue;
      porCodigo.set(material.codigo, {
        chave: material.chave,
        codigo: material.codigo,
        rotulo: rotuloMaterial(material),
      });
    }

    return [...porCodigo.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  }, [materiais, produtosCatalogo]);

  return (
    <SeletorBusca
      opcoes={opcoes}
      valor={valor}
      onChange={onChange}
      onAvancar={onAvancar}
      className={className}
      placeholder="Digite trechos do nome… Ex.: 15 branco"
    />
  );
}

function rotuloProduto(produto: ProdutoMdf): string {
  return `${produto.nome} · ${produto.cor} · ${produto.espessura} mm · ${produto.comprimento}×${produto.largura}`;
}

export function SeletorProdutoBusca({
  produtos,
  valor,
  onChange,
  className = 'campo',
}: {
  produtos: ProdutoMdf[];
  valor: string;
  onChange: (codigo: string) => void;
  className?: string;
}) {
  const opcoes = useMemo(
    () =>
      produtos.map((produto) => ({
        chave: produto.id,
        codigo: String(produto.codigo),
        rotulo: rotuloProduto(produto),
      })),
    [produtos],
  );

  return (
    <SeletorBusca
      opcoes={opcoes}
      valor={valor}
      onChange={onChange}
      className={className}
      placeholder="Digite trechos do nome… Ex.: 15 branco"
    />
  );
}
