"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProva(formData: FormData) {
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const conteudo = String(formData.get("conteudo") || "").trim();

  if (!disciplinaId || !dataStr) return;

  await prisma.prova.create({
    data: {
      disciplinaId,
      data: new Date(dataStr),
      conteudo: conteudo || null,
    },
  });

  revalidatePath("/provas");
}

export async function deleteProva(id: string) {
  await prisma.prova.delete({ where: { id } });
  revalidatePath("/provas");
}
