"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function addNota(disciplinaId: string, formData: FormData) {
  const descricao = String(formData.get("descricao") || "").trim();
  const valorStr = String(formData.get("valor") || "").trim();
  const valor = Number(valorStr.replace(",", "."));

  if (!descricao || Number.isNaN(valor)) return;

  await db.collection("notas").add({
    disciplinaId,
    descricao,
    valor,
    createdAt: new Date(),
  });

  revalidatePath("/notas");
  revalidatePath("/aulas");
}

export async function updateNota(id: string, formData: FormData) {
  const descricao = String(formData.get("descricao") || "").trim();
  const valorStr = String(formData.get("valor") || "").trim();
  const valor = Number(valorStr.replace(",", "."));

  if (!descricao || Number.isNaN(valor)) return;

  await db.collection("notas").doc(id).update({ descricao, valor });

  revalidatePath("/notas");
  revalidatePath("/aulas");
}

export async function deleteNota(id: string) {
  await db.collection("notas").doc(id).delete();
  revalidatePath("/notas");
  revalidatePath("/aulas");
}
