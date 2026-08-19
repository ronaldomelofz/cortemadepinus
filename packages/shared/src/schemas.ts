import { z } from 'zod';
import { STATUS_PEDIDO, VEIOS } from './types';

export const LIMITES = {
  /** Menor dimensao aceita pela seccionadora, em mm. */
  pecaMinima: 60,
  /** Maior chapa aceita pela seccionadora, em mm. */
  chapaMaxima: 3200,
  quantidadeMaxima: 9999,
  maxPecasPorPedido: 2000,
} as const;

export const registroSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(72),
  telefone: z.string().trim().max(30).optional().or(z.literal('')),
  empresa: z.string().trim().max(120).optional().or(z.literal('')),
  documento: z.string().trim().max(30).optional().or(z.literal('')),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const perfilSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  telefone: z.string().trim().max(30).optional().or(z.literal('')),
  empresa: z.string().trim().max(120).optional().or(z.literal('')),
  documento: z.string().trim().max(30).optional().or(z.literal('')),
});
export type PerfilInput = z.infer<typeof perfilSchema>;

/** Edição de cliente pela central: inclui e-mail e senha opcional. */
export const adminClienteSchema = perfilSchema.extend({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z
    .string()
    .max(72)
    .optional()
    .or(z.literal(''))
    .refine((valor) => !valor || valor.length >= 8, {
      message: 'A senha deve ter ao menos 8 caracteres',
    }),
});
export type AdminClienteInput = z.infer<typeof adminClienteSchema>;

export const materialSchema = z.object({
  id: z.string().optional(),
  codigo: z
    .number({ invalid_type_error: 'Código do material deve ser numérico' })
    .int('Use um código inteiro')
    .min(1)
    .max(99999, 'O Corte MadePinus aceita códigos de material até 99999'),
  descricao: z.string().trim().min(2, 'Descreva o material').max(80),
  espessura: z.number().positive('Espessura deve ser maior que zero').max(100),
  cor: z.string().trim().max(60).optional().or(z.literal('')),
  chapaLargura: z.number().positive().max(LIMITES.chapaMaxima),
  chapaAltura: z.number().positive().max(LIMITES.chapaMaxima),
  fornecidoPeloCliente: z.boolean().default(false),
  quantidadeChapas: z.number().int().min(0).max(9999).nullable().optional(),
});
export type MaterialInput = z.infer<typeof materialSchema>;

export const pecaSchema = z.object({
  id: z.string().optional(),
  /** Referencia ao material: id existente ou codigo numerico do material do pedido. */
  materialCodigo: z.number().int().min(1).max(99999),
  codigo: z.number().int().min(1).max(999999),
  quantidade: z
    .number()
    .int('Quantidade deve ser inteira')
    .min(1, 'Quantidade mínima 1')
    .max(LIMITES.quantidadeMaxima),
  largura: z
    .number()
    .min(LIMITES.pecaMinima, `Largura mínima de ${LIMITES.pecaMinima} mm`)
    .max(LIMITES.chapaMaxima),
  altura: z
    .number()
    .min(LIMITES.pecaMinima, `Altura mínima de ${LIMITES.pecaMinima} mm`)
    .max(LIMITES.chapaMaxima),
  descricao: z.string().trim().min(1, 'Descreva a peça').max(60),
  veio: z.enum(VEIOS).default('INDIFERENTE'),
  fitaL1: z.boolean().default(false),
  fitaL2: z.boolean().default(false),
  fitaC1: z.boolean().default(false),
  fitaC2: z.boolean().default(false),
  observacao: z.string().trim().max(120).optional().or(z.literal('')),
});
export type PecaInput = z.infer<typeof pecaSchema>;

export const pedidoSchema = z.object({
  titulo: z.string().trim().min(3, 'Informe um título para o projeto').max(120),
  ambiente: z.string().trim().max(120).optional().or(z.literal('')),
  observacoes: z.string().trim().max(2000).optional().or(z.literal('')),
  prazoDesejado: z.string().trim().max(30).optional().or(z.literal('')),
  materiais: z.array(materialSchema).min(1, 'Cadastre ao menos um material/chapa'),
  pecas: z
    .array(pecaSchema)
    .min(1, 'Adicione ao menos uma peça')
    .max(LIMITES.maxPecasPorPedido, 'Limite de peças por pedido excedido'),
});
export type PedidoInput = z.infer<typeof pedidoSchema>;

/** Valida que toda peca aponta para um material declarado no pedido. */
export const pedidoCompletoSchema = pedidoSchema.superRefine((valor, ctx) => {
  const codigos = new Set(valor.materiais.map((m) => m.codigo));
  if (codigos.size !== valor.materiais.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['materiais'],
      message: 'Existem materiais com o mesmo código',
    });
  }
  valor.pecas.forEach((peca, indice) => {
    if (!codigos.has(peca.materialCodigo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pecas', indice, 'materialCodigo'],
        message: `Material ${peca.materialCodigo} não está cadastrado no pedido`,
      });
    }
    const material = valor.materiais.find((m) => m.codigo === peca.materialCodigo);
    if (material) {
      const cabeNormal = peca.largura <= material.chapaLargura && peca.altura <= material.chapaAltura;
      const cabeGirada =
        peca.veio === 'INDIFERENTE' &&
        peca.altura <= material.chapaLargura &&
        peca.largura <= material.chapaAltura;
      if (!cabeNormal && !cabeGirada) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pecas', indice],
          message: `Peça ${peca.largura}x${peca.altura} não cabe na chapa ${material.chapaLargura}x${material.chapaAltura}`,
        });
      }
    }
  });
});

export const mudarStatusSchema = z.object({
  status: z.enum(STATUS_PEDIDO),
  nota: z.string().trim().max(500).optional().or(z.literal('')),
  valorOrcamento: z.number().min(0).nullable().optional(),
});
export type MudarStatusInput = z.infer<typeof mudarStatusSchema>;

export const mensagemSchema = z.object({
  texto: z.string().trim().min(1, 'Escreva uma mensagem').max(2000),
});
export type MensagemInput = z.infer<typeof mensagemSchema>;

export const produtoMdfSchema = z.object({
  codigo: z
    .number({ invalid_type_error: 'Código do material deve ser numérico' })
    .int('Use um código inteiro')
    .min(1)
    .max(99999, 'O Corte MadePinus aceita códigos de material até 99999')
    .optional(),
  nome: z.string().trim().min(2, 'Informe o nome do MDF').max(80),
  cor: z.string().trim().min(1, 'Informe a cor').max(60),
  espessura: z.number().positive('Espessura deve ser maior que zero').max(100),
  largura: z.number().positive('Informe a largura da chapa').max(LIMITES.chapaMaxima),
  comprimento: z.number().positive('Informe o comprimento da chapa').max(LIMITES.chapaMaxima),
  ativo: z.boolean().optional(),
});
export type ProdutoMdfInput = z.infer<typeof produtoMdfSchema>;

export const configuracaoCorteSchema = z.object({
  serraMm: z
    .number({ invalid_type_error: 'Espessura da serra deve ser numérica' })
    .min(0, 'A espessura da serra não pode ser negativa')
    .max(20, 'Espessura da serra acima de 20 mm não é aceita'),
  valorCorte: z
    .number({ invalid_type_error: 'Valor do corte deve ser numérico' })
    .min(0, 'O valor do corte não pode ser negativo')
    .max(10_000, 'Valor do corte acima do limite'),
});
export type ConfiguracaoCorteInput = z.infer<typeof configuracaoCorteSchema>;
