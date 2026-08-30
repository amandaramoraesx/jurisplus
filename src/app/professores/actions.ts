"use server";

import { db } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createProfessor(formData: FormData) {
  await requireAdmin();

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

export async function updateProfessor(id: string, formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();

  if (!nome) return;

  await db
    .collection("professores")
    .doc(id)
    .update({
      nome,
      email: email || null,
      telefone: telefone || null,
    });

  revalidatePath("/professores");
  revalidatePath("/aulas");
}

export async function deleteProfessor(id: string) {
  await requireAdmin();

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
