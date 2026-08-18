import type {
  Anexo as AnexoPrisma,
  Configuracao as ConfiguracaoPrisma,
  HistoricoStatus as HistoricoPrisma,
  Material as MaterialPrisma,
  Mensagem as MensagemPrisma,
  Peca as PecaPrisma,
  Pedido as PedidoPrisma,
  ProdutoMdf as ProdutoMdfPrisma,
  Usuario as UsuarioPrisma,
} from '@prisma/client';
import type {
  Anexo,
  ConfiguracaoCorte,
  HistoricoStatus,
  Material,
  Mensagem,
  Peca,
  Pedido,
  ProdutoMdf,
  Role,
  StatusPedido,
  Usuario,
  Veio,
} from '@cortemadepinus/shared';

type PedidoCompleto = PedidoPrisma & {
  cliente?: UsuarioPrisma | null;
  materiais: MaterialPrisma[];
  pecas: PecaPrisma[];
  anexos: AnexoPrisma[];
  mensagens?: (MensagemPrisma & { autor: UsuarioPrisma })[];
  historico?: (HistoricoPrisma & { autor: UsuarioPrisma | null })[];
};

export function mapearUsuario(usuario: UsuarioPrisma): Usuario {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    empresa: usuario.empresa,
    documento: usuario.documento,
    role: usuario.role as Role,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm.toISOString(),
  };
}

export function mapearProduto(produto: ProdutoMdfPrisma): ProdutoMdf {
  return {
    id: produto.id,
    codigo: produto.codigo,
    nome: produto.nome,
    cor: produto.cor,
    espessura: produto.espessura,
    largura: produto.largura,
    comprimento: produto.comprimento,
    ativo: produto.ativo,
    criadoEm: produto.criadoEm.toISOString(),
    atualizadoEm: produto.atualizadoEm.toISOString(),
  };
}

export function mapearConfiguracao(config: ConfiguracaoPrisma): ConfiguracaoCorte {
  return {
    serraMm: config.serraMm,
    valorCorte: config.valorCorte,
  };
}

export function mapearMaterial(material: MaterialPrisma): Material {
  return {
    id: material.id,
    pedidoId: material.pedidoId,
    codigo: material.codigo,
    descricao: material.descricao,
    espessura: material.espessura,
    cor: material.cor,
    chapaLargura: material.chapaLargura,
    chapaAltura: material.chapaAltura,
    fornecidoPeloCliente: material.fornecidoPeloCliente,
    quantidadeChapas: material.quantidadeChapas,
    ordem: material.ordem,
  };
}

export function mapearPeca(peca: PecaPrisma): Peca {
  return {
    id: peca.id,
    pedidoId: peca.pedidoId,
    materialId: peca.materialId,
    codigo: peca.codigo,
    quantidade: peca.quantidade,
    largura: peca.largura,
    altura: peca.altura,
    descricao: peca.descricao,
    veio: peca.veio as Veio,
    fitaL1: peca.fitaL1,
    fitaL2: peca.fitaL2,
    fitaC1: peca.fitaC1,
    fitaC2: peca.fitaC2,
    observacao: peca.observacao,
    ordem: peca.ordem,
  };
}

export function mapearAnexo(anexo: AnexoPrisma): Anexo {
  return {
    id: anexo.id,
    pedidoId: anexo.pedidoId,
    nomeOriginal: anexo.nomeOriginal,
    nomeArmazenado: anexo.nomeArmazenado,
    mimeType: anexo.mimeType,
    tamanho: anexo.tamanho,
    criadoEm: anexo.criadoEm.toISOString(),
  };
}

export function mapearMensagem(mensagem: MensagemPrisma & { autor: UsuarioPrisma }): Mensagem {
  return {
    id: mensagem.id,
    pedidoId: mensagem.pedidoId,
    autorId: mensagem.autorId,
    autorNome: mensagem.autor.nome,
    autorRole: mensagem.autor.role as Role,
    texto: mensagem.texto,
    criadoEm: mensagem.criadoEm.toISOString(),
  };
}

export function mapearHistorico(
  historico: HistoricoPrisma & { autor: UsuarioPrisma | null },
): HistoricoStatus {
  return {
    id: historico.id,
    pedidoId: historico.pedidoId,
    status: historico.status as StatusPedido,
    nota: historico.nota,
    autorNome: historico.autor?.nome ?? null,
    criadoEm: historico.criadoEm.toISOString(),
  };
}

export function mapearPedido(pedido: PedidoCompleto): Pedido {
  return {
    id: pedido.id,
    numero: pedido.numero,
    clienteId: pedido.clienteId,
    cliente: pedido.cliente
      ? {
          id: pedido.cliente.id,
          nome: pedido.cliente.nome,
          email: pedido.cliente.email,
          empresa: pedido.cliente.empresa,
          telefone: pedido.cliente.telefone,
        }
      : undefined,
    titulo: pedido.titulo,
    ambiente: pedido.ambiente,
    observacoes: pedido.observacoes,
    prazoDesejado: pedido.prazoDesejado,
    status: pedido.status as StatusPedido,
    valorOrcamento: pedido.valorOrcamento,
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
    enviadoEm: pedido.enviadoEm?.toISOString() ?? null,
    materiais: [...pedido.materiais].sort((a, b) => a.ordem - b.ordem).map(mapearMaterial),
    pecas: [...pedido.pecas].sort((a, b) => a.ordem - b.ordem).map(mapearPeca),
    anexos: pedido.anexos.map(mapearAnexo),
    mensagens: pedido.mensagens?.map(mapearMensagem),
    historico: pedido.historico?.map(mapearHistorico),
  };
}

/** Inclusao padrao usada em todas as consultas de pedido. */
export const inclusaoPedido = {
  cliente: true,
  materiais: true,
  pecas: true,
  anexos: true,
  mensagens: { include: { autor: true }, orderBy: { criadoEm: 'asc' } },
  historico: { include: { autor: true }, orderBy: { criadoEm: 'asc' } },
} as const;
