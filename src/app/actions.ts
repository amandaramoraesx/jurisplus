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

export async function marcarTodasPresentes() {
  const data = todayDateOnly();
  const disciplinasSnap = await db.collection("disciplinas").get();

  const batch = db.batch();
  for (const doc of disciplinasSnap.docs) {
    const id = `${doc.id}_${dateOnlyKey(data)}`;
    batch.set(
      db.collection("presencas").doc(id),
      { disciplinaId: doc.id, data, presente: true, createdAt: new Date() },
      { merge: true }
    );
  }
  await batch.commit();

  revalidatePath("/");
}

export async function anotarRapido(disciplinaId: string, formData: FormData) {
  const anotacoesLousa = String(formData.get("anotacoesLousa") || "").trim();
  if (!anotacoesLousa) return;

  const hoje = todayDateOnly();
  const id = `${disciplinaId}_${dateOnlyKey(hoje)}`;
  const ref = db.collection("aulas").doc(id);
  const doc = await ref.get();

  if (doc.exists) {
    await ref.update({ anotacoesLousa });
  } else {
    await ref.set({
      disciplinaId,
      data: hoje,
      tema: `Aula de ${new Intl.DateTimeFormat("pt-BR").format(hoje)}`,
      resumo: null,
      anotacoesLousa,
      resumoIA: null,
      createdAt: new Date(),
    });
  }

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath(`/aulas/${id}`);
}
