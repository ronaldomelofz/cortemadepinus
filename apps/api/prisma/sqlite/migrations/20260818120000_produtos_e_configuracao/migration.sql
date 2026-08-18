-- CreateTable
CREATE TABLE "produtos_mdf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "espessura" REAL NOT NULL,
    "largura" REAL NOT NULL,
    "comprimento" REAL NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serraMm" REAL NOT NULL,
    "valorCorte" REAL NOT NULL,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_mdf_codigo_key" ON "produtos_mdf"("codigo");
