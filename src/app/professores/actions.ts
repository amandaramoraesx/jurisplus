"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProfessor(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();

  if (!nome) return;

  await prisma.professor.create({
    data: {
      nome,
      email: email || null,
      telefone: telefone || null,
    },
  });

  revalidatePath("/professores");
  revalidatePath("/aulas");
}

export async function deleteProfessor(id: string) {
  await prisma.professor.delete({ where: { id } });
  revalidatePath("/professores");
  revalidatePath("/aulas");
}
