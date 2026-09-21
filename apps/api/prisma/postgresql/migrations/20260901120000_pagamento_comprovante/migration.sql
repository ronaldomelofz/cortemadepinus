-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "pagamentoConfirmadoEm" TIMESTAMP(3);
ALTER TABLE "pedidos" ADD COLUMN "pagamentoConfirmadoPorId" TEXT;

-- AlterTable
ALTER TABLE "anexos" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'GERAL';
