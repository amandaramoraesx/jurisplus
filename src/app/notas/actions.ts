"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { garantirDono } from "@/lib/dono";

export async function addNota(disciplinaId: string, formData: FormData) {
  const user = await requireUser();
  const descricao = String(formData.get("descricao") || "").trim();
  const valorStr = String(formData.get("valor") || "").trim();
  const valor = Number(valorStr.replace(",", "."));

  if (!descricao || Number.isNaN(valor)) return;

  await db.collection("notas").add({
    uid: user.uid,
    disciplinaId,
    descricao,
    valor,
    createdAt: new Date(),
  });

  revalidatePath("/notas");
  revalidatePath("/aulas");
}

export async function updateNota(id: string, formData: FormData) {
  const user = await requireUser();
  const descricao = String(formData.get("descricao") || "").trim();
  const valorStr = String(formData.get("valor") || "").trim();
  const valor = Number(valorStr.replace(",", "."));

  if (!descricao || Number.isNaN(valor)) return;

  const doc = await garantirDono("notas", id, user.uid);
  await doc.ref.update({ descricao, valor });

  revalidatePath("/notas");
  revalidatePath("/aulas");
}

export async function deleteNota(id: string) {
  const user = await requireUser();
  const doc = await garantirDono("notas", id, user.uid);
  await doc.ref.delete();
  revalidatePath("/notas");
  revalidatePath("/aulas");
}
