-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "pagamentoConfirmadoEm" DATETIME;
ALTER TABLE "pedidos" ADD COLUMN "pagamentoConfirmadoPorId" TEXT;

-- AlterTable
ALTER TABLE "anexos" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'GERAL';
