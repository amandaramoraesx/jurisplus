"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function createProfessor(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();

  if (!nome) return;

  await db.collection("professores").add({
    nome,
    email: email || null,
    telefone: telefone || null,
    createdAt: new Date(),
  });

  revalidatePath("/professores");
  revalidatePath("/aulas");
}

export async function deleteProfessor(id: string) {
  const disciplinasSnap = await db
    .collection("disciplinas")
    .where("professorId", "==", id)
    .get();

  const batch = db.batch();
  for (const doc of disciplinasSnap.docs) {
    batch.update(doc.ref, { professorId: null });
  }
  batch.delete(db.collection("professores").doc(id));
  await batch.commit();

  revalidatePath("/professores");
  revalidatePath("/aulas");
}
