"use server";

import { db } from "@/lib/firebase-admin";
import { hojeNoBrasil } from "@/lib/firestore";
import { atualizarLeitores, garantirAulaDoDia } from "@/lib/anotacoes";
import { lerCompartilhadoCom } from "@/lib/colegas";
import { requireUser } from "@/lib/auth";
import { idPresenca } from "@/lib/dono";
import { revalidatePath } from "next/cache";

export async function marcarPresenca(disciplinaId: string, presente: boolean) {
  const user = await requireUser();
  const data = hojeNoBrasil();

  await Promise.all([
    db
      .collection("presencas")
      .doc(idPresenca(user.uid, disciplinaId, data))
      .set({ uid: user.uid, disciplinaId, data, presente, createdAt: new Date() }, { merge: true }),
    garantirAulaDoDia(disciplinaId, data, user.uid),
  ]);

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath("/historico");
}

export async function marcarTodasPresentes(disciplinaIds: string[]) {
  const user = await requireUser();
  const data = hojeNoBrasil();

  const batch = db.batch();
  for (const disciplinaId of disciplinaIds) {
    batch.set(
      db.collection("presencas").doc(idPresenca(user.uid, disciplinaId, data)),
      { uid: user.uid, disciplinaId, data, presente: true, createdAt: new Date() },
      { merge: true }
    );
  }
  await batch.commit();

  // Cada disciplina de hoje ganha a aula do dia já vinculada ao check-in
  // (ex: as duas aulas do mesmo professor na segunda-feira).
  await Promise.all(disciplinaIds.map((disciplinaId) => garantirAulaDoDia(disciplinaId, data, user.uid)));

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath("/historico");
}

/** Anotação rápida do Início — só quem escreveu vê, mais os colegas que ele escolher. */
export async function anotarRapido(disciplinaId: string, formData: FormData) {
  const user = await requireUser();

  const resumo = String(formData.get("resumo") || "").trim();
  const anotacoesLousa = String(formData.get("anotacoesLousa") || "").trim();
  if (!resumo && !anotacoesLousa) return;

  const id = await garantirAulaDoDia(disciplinaId, hojeNoBrasil(), user.uid);

  await db
    .collection("aulas")
    .doc(id)
    .collection("anotacoes")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        nome: user.nome || user.email || "Colega",
        resumo: resumo || null,
        anotacoesLousa: anotacoesLousa || null,
        compartilhadoCom: await lerCompartilhadoCom(formData, user.uid),
        updatedAt: new Date(),
      },
      { merge: true }
    );
  await atualizarLeitores(id);

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath(`/aulas/${id}`);
  revalidatePath("/historico");
}
