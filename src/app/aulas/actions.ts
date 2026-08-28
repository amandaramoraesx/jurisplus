"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
