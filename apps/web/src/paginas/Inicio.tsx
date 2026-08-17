import { Link } from 'react-router-dom';
import { AvisoConfiguracao, Marca } from '../componentes/Layout';
import { useSessao } from '../lib/sessao';

const PASSOS = [
  {
    titulo: 'Cadastre seu projeto',
    texto: 'Informe o ambiente, os materiais (MDF, MDP, compensado) e a espessura de cada chapa.',
  },
  {
    titulo: 'Lance as medidas',
    texto: 'Digite peça por peça, cole direto do Excel ou importe o arquivo CSV/TXT do Corte Certo.',
  },
  {
    titulo: 'Envie para a central',
    texto: 'Conferimos as medidas, geramos o plano otimizado e retornamos com prazo e orçamento.',
  },
  {
    titulo: 'Acompanhe a produção',
    texto: 'Status em tempo real: análise, orçamento, aprovação, produção e retirada.',
  },
];

const RECURSOS = [
  {
    titulo: 'Padrão Corte Certo nativo',
    texto:
      'A plataforma gera o arquivo exatamente no layout aceito pelo Corte Certo (código, quantidade, largura, altura, material e descrição), pronto para importar e otimizar.',
  },
  {
    titulo: 'Validação automática',
    texto:
      'Peças maiores que a chapa, medidas abaixo do mínimo da seccionadora e materiais sem cadastro são apontados antes do envio.',
  },
  {
    titulo: 'Fita de borda e veio',
    texto:
      'Marque C1, C2, L1 e L2 e o sentido do veio. Calculamos os metros lineares de fita e respeitamos a orientação no corte.',
  },
  {
    titulo: 'Resumo instantâneo',
    texto:
      'Área total em m², número de peças, metros de fita e estimativa de chapas necessárias, atualizados enquanto você digita.',
  },
];

export function Inicio() {
  const { usuario } = useSessao();
  const destino = usuario ? (usuario.role === 'ADMIN' ? '/admin' : '/app') : '/entrar';

  return (
    <div className="min-h-screen bg-stone-50">
      <AvisoConfiguracao />
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Marca />
          <div className="flex items-center gap-2">
            <Link
              to="/entrar"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
            >
              Entrar
            </Link>
            <Link
              to="/cadastrar"
              className="rounded-lg bg-madeira-700 px-4 py-2 text-sm font-semibold text-white hover:bg-madeira-800"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-madeira-900 via-madeira-800 to-madeira-700 text-white">
        <div className="absolute inset-0 opacity-10 [background-image:repeating-linear-gradient(90deg,transparent,transparent_38px,rgba(255,255,255,.6)_38px,rgba(255,255,255,.6)_39px)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-madeira-100">
            Corte em seccionadora
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Envie seu plano de corte para a MadePinus sem sair do escritório
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-madeira-100">
            Uma plataforma feita para marcenarias, montadores e lojistas. Suas medidas chegam à nossa central
            já no formato do <strong className="font-semibold text-white">Corte Certo</strong>, prontas para
            otimização e corte na seccionadora.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={destino}
              className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-madeira-800 shadow-lg transition hover:bg-madeira-50"
            >
              {usuario ? 'Ir para minha área' : 'Começar agora'}
            </Link>
            <a
              href="#como-funciona"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/10"
            >
              Como funciona
            </a>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-stone-900">Do projeto à peça cortada em 4 passos</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((passo, indice) => (
            <div key={passo.titulo} className="cartao p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-madeira-100 text-sm font-bold text-madeira-800">
                {indice + 1}
              </span>
              <h3 className="mt-4 text-base font-bold text-stone-900">{passo.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{passo.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-stone-900">Feito para quem trabalha com chapa</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {RECURSOS.map((recurso) => (
              <div key={recurso.titulo} className="flex gap-4">
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-madeira-700 text-white">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-stone-900">{recurso.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{recurso.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="cartao overflow-hidden">
          <div className="grid gap-8 p-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-bold text-stone-900">O arquivo que a nossa máquina entende</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                O layout oficial do Corte Certo tem seis campos por linha, separados por vírgula. É exatamente
                isso que a plataforma gera para a central — sem retrabalho, sem digitação duplicada e sem risco
                de medida trocada.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
                <li>1. Código da peça</li>
                <li>2. Quantidade</li>
                <li>3. Largura (mm)</li>
                <li>4. Altura (mm)</li>
                <li>5. Código do material</li>
                <li>6. Descrição da peça</li>
              </ul>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-stone-900 p-5 text-xs leading-relaxed text-madeira-100">
              <code>{`1,4,700,350,99000,Lateral armario superior
2,2,1200,350,99000,Fundo armario superior
3,6,397,700,99001,Porta
4,3,600,150,99001,Frente gaveta`}</code>
            </pre>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Marca />
          <p className="text-xs text-stone-500">
            MadePinus · Central de Serviços de Corte · Plataforma open source
          </p>
        </div>
      </footer>
    </div>
  );
}
