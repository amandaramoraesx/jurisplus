"use server";

import { db } from "@/lib/firebase-admin";
import { dateOnlyKey } from "@/lib/firestore";
import { revalidatePath } from "next/cache";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Garante que exista a aula "de hoje" da disciplina, pra check-in já vincular com a aula do dia. */
async function garantirAulaDoDia(disciplinaId: string, data: Date) {
  const id = `${disciplinaId}_${dateOnlyKey(data)}`;
  const ref = db.collection("aulas").doc(id);
  const doc = await ref.get();
  if (doc.exists) return;

  await ref.set({
    disciplinaId,
    data,
    tema: `Aula de ${new Intl.DateTimeFormat("pt-BR").format(data)}`,
    resumo: null,
    anotacoesLousa: null,
    resumoIA: null,
    createdAt: new Date(),
  });
}

export async function marcarPresenca(disciplinaId: string, presente: boolean) {
  const data = todayDateOnly();
  const id = `${disciplinaId}_${dateOnlyKey(data)}`;

  await Promise.all([
    db
      .collection("presencas")
      .doc(id)
      .set({ disciplinaId, data, presente, createdAt: new Date() }, { merge: true }),
    garantirAulaDoDia(disciplinaId, data),
  ]);

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath("/historico");
}

export async function marcarTodasPresentes(disciplinaIds: string[]) {
  const data = todayDateOnly();

  const batch = db.batch();
  for (const disciplinaId of disciplinaIds) {
    const id = `${disciplinaId}_${dateOnlyKey(data)}`;
    batch.set(
      db.collection("presencas").doc(id),
      { disciplinaId, data, presente: true, createdAt: new Date() },
      { merge: true }
    );
  }
  await batch.commit();

  // Cada disciplina de hoje ganha a aula do dia já vinculada ao check-in
  // (ex: as duas aulas do mesmo professor na segunda-feira).
  await Promise.all(disciplinaIds.map((disciplinaId) => garantirAulaDoDia(disciplinaId, data)));

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath("/historico");
}

export async function anotarRapido(disciplinaId: string, formData: FormData) {
  const resumo = String(formData.get("resumo") || "").trim();
  const anotacoesLousa = String(formData.get("anotacoesLousa") || "").trim();
  if (!resumo && !anotacoesLousa) return;

  const hoje = todayDateOnly();
  const id = `${disciplinaId}_${dateOnlyKey(hoje)}`;
  const ref = db.collection("aulas").doc(id);
  const doc = await ref.get();

  if (doc.exists) {
    await ref.update({ resumo: resumo || null, anotacoesLousa: anotacoesLousa || null });
  } else {
    await ref.set({
      disciplinaId,
      data: hoje,
      tema: `Aula de ${new Intl.DateTimeFormat("pt-BR").format(hoje)}`,
      resumo: resumo || null,
      anotacoesLousa: anotacoesLousa || null,
      resumoIA: null,
      createdAt: new Date(),
    });
  }

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath(`/aulas/${id}`);
  revalidatePath("/historico");
}
