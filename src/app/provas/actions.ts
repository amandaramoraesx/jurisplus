"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function createProva(formData: FormData) {
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const conteudo = String(formData.get("conteudo") || "").trim();

  if (!disciplinaId || !dataStr) return;

  await db.collection("provas").add({
    disciplinaId,
    data: new Date(dataStr),
    conteudo: conteudo || null,
    createdAt: new Date(),
  });

  revalidatePath("/provas");
  revalidatePath("/aulas");
}

export async function updateProva(id: string, formData: FormData) {
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const conteudo = String(formData.get("conteudo") || "").trim();

  if (!disciplinaId || !dataStr) return;

  await db
    .collection("provas")
    .doc(id)
    .update({
      disciplinaId,
      data: new Date(dataStr),
      conteudo: conteudo || null,
    });

  revalidatePath("/provas");
  revalidatePath("/aulas");
}

export async function deleteProva(id: string) {
  await db.collection("provas").doc(id).delete();
  revalidatePath("/provas");
  revalidatePath("/aulas");
}
