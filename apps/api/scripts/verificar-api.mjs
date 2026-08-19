#!/usr/bin/env node
/**
 * Teste de fumaca da API: percorre o caminho real de um pedido, do login do
 * cliente ate a central mudar o status, e confere o arquivo do Corte MadePinus.
 *
 * Uso (com a API no ar):
 *   npm run verificar --workspace @cortemadepinus/api
 *   API_URL=https://api.exemplo.com node scripts/verificar-api.mjs
 */

import 'dotenv/config';

const base = (process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, '');
const emailCliente = process.env.TESTE_CLIENTE_EMAIL ?? 'cliente@exemplo.com.br';
const senhaCliente = process.env.TESTE_CLIENTE_SENHA ?? 'cliente12345';
const emailAdmin = process.env.ADMIN_EMAIL ?? 'admin@madepinus.com.br';
const senhaAdmin = process.env.ADMIN_SENHA ?? 'MudarEsteAcesso1';

let passou = 0;
let falhou = 0;

function verificar(descricao, condicao, detalhe = '') {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${descricao}`);
  } else {
    falhou += 1;
    console.error(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function chamar(caminho, { token, metodo = 'GET', corpo, texto = false } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const conteudo = texto ? await resposta.text() : await resposta.json().catch(() => ({}));
  return { status: resposta.status, dados: conteudo };
}

const pedidoExemplo = {
  titulo: 'Verificacao automatica',
  ambiente: 'Teste',
  observacoes: 'Pedido criado pelo script de verificação.',
  prazoDesejado: '3 dias',
  materiais: [
    {
      codigo: 99000,
      descricao: 'MDF Branco TX',
      espessura: 15,
      cor: 'Branco',
      chapaLargura: 2750,
      chapaAltura: 1840,
      fornecidoPeloCliente: false,
      quantidadeChapas: null,
    },
  ],
  pecas: [
    {
      codigo: 1,
      materialCodigo: 99000,
      quantidade: 4,
      largura: 700,
      altura: 350,
      descricao: 'Lateral',
      veio: 'COMPRIMENTO',
      fitaC1: true,
      fitaC2: false,
      fitaL1: true,
      fitaL2: false,
      observacao: '',
    },
    {
      codigo: 2,
      materialCodigo: 99000,
      quantidade: 2,
      largura: 1200,
      altura: 350,
      descricao: 'Fundo, com vírgula',
      veio: 'INDIFERENTE',
      fitaC1: true,
      fitaC2: true,
      fitaL1: false,
      fitaL2: false,
      observacao: '',
    },
  ],
};

async function main() {
  console.log(`\nVerificando a API em ${base}\n`);

  console.log('· Saúde');
  const saude = await chamar('/saude');
  verificar('serviço responde', saude.status === 200, `status ${saude.status}`);
  verificar('banco conectado', saude.dados?.ok === true, JSON.stringify(saude.dados));
  console.log(`       banco: ${saude.dados?.banco}`);

  console.log('· Autenticação do cliente');
  const login = await chamar('/api/auth/login', {
    metodo: 'POST',
    corpo: { email: emailCliente, senha: senhaCliente },
  });
  verificar('login aceito', login.status === 200, JSON.stringify(login.dados));
  const tokenCliente = login.dados?.token;
  if (!tokenCliente) throw new Error('sem token de cliente, interrompendo');

  const senhaErrada = await chamar('/api/auth/login', {
    metodo: 'POST',
    corpo: { email: emailCliente, senha: 'senha-errada' },
  });
  verificar('senha errada é recusada', senhaErrada.status === 401, `status ${senhaErrada.status}`);

  const semToken = await chamar('/api/pedidos');
  verificar('rota protegida exige token', semToken.status === 401, `status ${semToken.status}`);

  console.log('· Criação do pedido');
  const criado = await chamar('/api/pedidos', {
    token: tokenCliente,
    metodo: 'POST',
    corpo: pedidoExemplo,
  });
  verificar('pedido criado', criado.status === 201, JSON.stringify(criado.dados).slice(0, 300));
  const pedido = criado.dados?.pedido;
  if (!pedido) throw new Error('pedido não foi criado, interrompendo');
  verificar('recebeu número sequencial', Number.isInteger(pedido.numero) && pedido.numero > 0);
  verificar('nasce como rascunho', pedido.status === 'RASCUNHO', pedido.status);

  const resumo = criado.dados?.resumo;
  // 4 x (0,70 x 0,35) + 2 x (1,20 x 0,35) = 0,98 + 0,84
  verificar('área calculada', resumo?.areaTotalM2 === 1.82, String(resumo?.areaTotalM2));
  verificar('total de peças', resumo?.totalPecas === 6, String(resumo?.totalPecas));

  console.log('· Validação');
  const invalido = await chamar('/api/pedidos', {
    token: tokenCliente,
    metodo: 'POST',
    corpo: {
      ...pedidoExemplo,
      pecas: [{ ...pedidoExemplo.pecas[0], largura: 5000 }],
    },
  });
  verificar('peça maior que a chapa é recusada', invalido.status === 422, `status ${invalido.status}`);

  console.log('· Exportação Corte MadePinus');
  const csv = await chamar(`/api/pedidos/${pedido.id}/exportar/csv`, {
    token: tokenCliente,
    texto: true,
  });
  const linhas = String(csv.dados).trim().split('\r\n');
  verificar('CSV tem uma linha por peça', linhas.length === 2, `linhas: ${linhas.length}`);
  verificar('primeira linha no layout oficial', linhas[0] === '1,4,700,350,99000,Lateral', linhas[0]);
  verificar(
    'descrição não quebra os 6 campos',
    linhas.every((l) => l.split(',').length === 6),
    linhas[1],
  );

  const txt = await chamar(`/api/pedidos/${pedido.id}/exportar/txt`, {
    token: tokenCliente,
    texto: true,
  });
  const colunas = String(txt.dados).trim().split('\r\n')[0].split('\t');
  verificar('TXT tem 7 campos', colunas.length === 7, String(colunas.length));
  verificar('TXT traz veio quando informado', colunas[6].includes('VEIO'), colunas[6]);

  console.log('· Envio para a central');
  const enviado = await chamar(`/api/pedidos/${pedido.id}/enviar`, {
    token: tokenCliente,
    metodo: 'POST',
  });
  verificar('pedido enviado', enviado.dados?.pedido?.status === 'ENVIADO', JSON.stringify(enviado.dados).slice(0, 200));

  const edicaoBloqueada = await chamar(`/api/pedidos/${pedido.id}`, {
    token: tokenCliente,
    metodo: 'PUT',
    corpo: pedidoExemplo,
  });
  verificar('edição após envio é bloqueada', edicaoBloqueada.status === 400, `status ${edicaoBloqueada.status}`);

  console.log('· Central de serviços');
  const loginAdmin = await chamar('/api/auth/login', {
    metodo: 'POST',
    corpo: { email: emailAdmin, senha: senhaAdmin },
  });
  verificar('login do administrador', loginAdmin.status === 200, JSON.stringify(loginAdmin.dados).slice(0, 200));
  const tokenAdmin = loginAdmin.dados?.token;

  if (tokenAdmin) {
    const painel = await chamar('/api/admin/painel', { token: tokenAdmin });
    verificar('painel responde', painel.status === 200, `status ${painel.status}`);

    const clienteNoAdmin = await chamar('/api/admin/painel', { token: tokenCliente });
    verificar('cliente não acessa a área da central', clienteNoAdmin.status === 403, `status ${clienteNoAdmin.status}`);

    const analise = await chamar(`/api/admin/pedidos/${pedido.id}/status`, {
      token: tokenAdmin,
      metodo: 'PATCH',
      corpo: { status: 'EM_ANALISE', nota: 'Conferindo medidas' },
    });
    verificar('status avança para análise', analise.dados?.pedido?.status === 'EM_ANALISE');

    const transicaoInvalida = await chamar(`/api/admin/pedidos/${pedido.id}/status`, {
      token: tokenAdmin,
      metodo: 'PATCH',
      corpo: { status: 'ENTREGUE' },
    });
    verificar('transição inválida é recusada', transicaoInvalida.status === 400, `status ${transicaoInvalida.status}`);

    const orcamento = await chamar(`/api/admin/pedidos/${pedido.id}/status`, {
      token: tokenAdmin,
      metodo: 'PATCH',
      corpo: { status: 'ORCAMENTO_ENVIADO', valorOrcamento: 1234.56, nota: 'Orçamento anexado' },
    });
    verificar('orçamento gravado', orcamento.dados?.pedido?.valorOrcamento === 1234.56, String(orcamento.dados?.pedido?.valorOrcamento));

    const busca = await chamar('/api/admin/pedidos?busca=VERIFICACAO', { token: tokenAdmin });
    verificar('busca ignora maiúsculas', (busca.dados?.itens ?? []).length > 0, `encontrados: ${busca.dados?.total}`);
  }

  console.log(`\n${passou} verificações passaram, ${falhou} falharam.\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

main().catch((erro) => {
  console.error('\nInterrompido:', erro.message);
  process.exit(1);
});
