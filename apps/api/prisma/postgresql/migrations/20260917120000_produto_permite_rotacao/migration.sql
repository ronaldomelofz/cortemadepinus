-- AlterTable
ALTER TABLE "produtos_mdf" ADD COLUMN "permiteRotacao" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "materiais" ADD COLUMN "permiteRotacao" BOOLEAN NOT NULL DEFAULT true;
