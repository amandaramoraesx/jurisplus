"use server";

import { db } from "@/lib/firebase-admin";
import { dateOnlyKey } from "@/lib/firestore";
import { revalidatePath } from "next/cache";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function marcarPresenca(disciplinaId: string, presente: boolean) {
  const data = todayDateOnly();
  const id = `${disciplinaId}_${dateOnlyKey(data)}`;

  await db
    .collection("presencas")
    .doc(id)
    .set(
      { disciplinaId, data, presente, createdAt: new Date() },
      { merge: true }
    );

  revalidatePath("/");
}

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

  revalidatePath("/");
}

export async function deleteNota(id: string) {
  await db.collection("notas").doc(id).delete();
  revalidatePath("/");
}
