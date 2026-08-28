"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAnthropicClient } from "@/lib/anthropic";

export async function createDisciplina(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const semestre = String(formData.get("semestre") || "").trim();
  const professorId = String(formData.get("professorId") || "").trim();

  if (!nome || !semestre) return;

  await prisma.disciplina.create({
    data: {
      nome,
      semestre,
      professorId: professorId || null,
    },
  });

  revalidatePath("/aulas");
}

export async function deleteDisciplina(id: string) {
  await prisma.disciplina.delete({ where: { id } });
  revalidatePath("/aulas");
}

export async function createAula(disciplinaId: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");

  if (!tema || !dataStr) return;

  await prisma.aula.create({
    data: {
      disciplinaId,
      tema,
      data: new Date(dataStr),
      resumo: String(formData.get("resumo") || "").trim() || null,
      anotacoesLousa: String(formData.get("anotacoesLousa") || "").trim() || null,
    },
  });

  revalidatePath("/aulas");
}

export async function updateAula(aulaId: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");

  await prisma.aula.update({
    where: { id: aulaId },
    data: {
      tema,
      data: dataStr ? new Date(dataStr) : undefined,
      resumo: String(formData.get("resumo") || "").trim() || null,
      anotacoesLousa: String(formData.get("anotacoesLousa") || "").trim() || null,
    },
  });

  revalidatePath("/aulas");
  revalidatePath(`/aulas/${aulaId}`);
}

export async function deleteAula(aulaId: string, disciplinaId: string) {
  await prisma.aula.delete({ where: { id: aulaId } });
  revalidatePath("/aulas");
  redirect(`/aulas#${disciplinaId}`);
}

export async function gerarResumoIA(aulaId: string) {
  const aula = await prisma.aula.findUniqueOrThrow({ where: { id: aulaId } });

  if (!aula.resumo && !aula.anotacoesLousa) {
    return;
  }

  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          `Você é um assistente de estudos para uma aluna de Direito.`,
          `Com base no resumo da aula e nas anotações da lousa abaixo, escreva um resumo inteligente e organizado (em português) para revisão antes de provas: destaque os conceitos-chave, defina termos importantes e, se fizer sentido, cite artigos de lei mencionados. Use tópicos curtos. Não invente conteúdo que não esteja implícito no material.`,
          ``,
          `Tema da aula: ${aula.tema}`,
          ``,
          `Resumo da aula:`,
          aula.resumo || "(não preenchido)",
          ``,
          `Anotações da lousa:`,
          aula.anotacoesLousa || "(não preenchido)",
        ].join("\n"),
      },
    ],
  });

  const resumoIA = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  await prisma.aula.update({
    where: { id: aulaId },
    data: { resumoIA },
  });

  revalidatePath(`/aulas/${aulaId}`);
}
