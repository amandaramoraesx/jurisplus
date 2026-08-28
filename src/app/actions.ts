"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function marcarPresenca(disciplinaId: string, presente: boolean) {
  const data = todayDateOnly();

  await prisma.presenca.upsert({
    where: { disciplinaId_data: { disciplinaId, data } },
    update: { presente },
    create: { disciplinaId, data, presente },
  });

  revalidatePath("/");
}

export async function addNota(disciplinaId: string, formData: FormData) {
  const descricao = String(formData.get("descricao") || "").trim();
  const valorStr = String(formData.get("valor") || "").trim();
  const valor = Number(valorStr.replace(",", "."));

  if (!descricao || Number.isNaN(valor)) return;

  await prisma.nota.create({
    data: { disciplinaId, descricao, valor },
  });

  revalidatePath("/");
}

export async function deleteNota(id: string) {
  await prisma.nota.delete({ where: { id } });
  revalidatePath("/");
}
