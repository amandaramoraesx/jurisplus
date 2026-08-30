"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function createPalestra(formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const palestrante = String(formData.get("palestrante") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const horasStr = String(formData.get("horas") || "").trim();
  const horas = Number(horasStr.replace(",", "."));
  const local = String(formData.get("local") || "").trim();
  const resumo = String(formData.get("resumo") || "").trim();

  if (!tema || !dataStr || Number.isNaN(horas)) return;

  await db.collection("palestras").add({
    tema,
    palestrante: palestrante || null,
    data: new Date(dataStr),
    horas,
    local: local || null,
    resumo: resumo || null,
    createdAt: new Date(),
  });

  revalidatePath("/palestras");
}

export async function updatePalestra(id: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const palestrante = String(formData.get("palestrante") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const horasStr = String(formData.get("horas") || "").trim();
  const horas = Number(horasStr.replace(",", "."));
  const local = String(formData.get("local") || "").trim();
  const resumo = String(formData.get("resumo") || "").trim();

  if (!tema || Number.isNaN(horas)) return;

  await db
    .collection("palestras")
    .doc(id)
    .update({
      tema,
      palestrante: palestrante || null,
      ...(dataStr ? { data: new Date(dataStr) } : {}),
      horas,
      local: local || null,
      resumo: resumo || null,
    });

  revalidatePath("/palestras");
}

export async function deletePalestra(id: string) {
  await db.collection("palestras").doc(id).delete();
  revalidatePath("/palestras");
}
