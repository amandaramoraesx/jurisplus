-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Disciplina" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "semestre" TEXT NOT NULL,
    "professorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Disciplina_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aula" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "tema" TEXT NOT NULL,
    "resumo" TEXT,
    "anotacoesLousa" TEXT,
    "resumoIA" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Aula_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Presenca_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nota_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prova" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disciplinaId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "conteudo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prova_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Palestra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tema" TEXT NOT NULL,
    "resumo" TEXT,
    "data" DATETIME NOT NULL,
    "horas" REAL NOT NULL,
    "local" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GrupoTrabalho" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tema" TEXT NOT NULL,
    "disciplinaId" TEXT,
    "data" DATETIME NOT NULL,
    "apresentacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrupoTrabalho_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegranteGrupo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    CONSTRAINT "IntegranteGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoTrabalho" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VadeMecumArtigo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VadeMecumFavorito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "aulaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VadeMecumFavorito_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_disciplinaId_data_key" ON "Presenca"("disciplinaId", "data");
