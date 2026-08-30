"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAnthropicClient, gerarQuizComIA } from "@/lib/anthropic";
import { requireAdmin } from "@/lib/auth";

export async function createDisciplina(formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const semestre = String(formData.get("semestre") || "").trim();
  const professorId = String(formData.get("professorId") || "").trim();

  if (!nome || !semestre) return;

  await db.collection("disciplinas").add({
    nome,
    semestre,
    professorId: professorId || null,
    createdAt: new Date(),
  });

  revalidatePath("/aulas");
}

export async function updateDisciplina(id: string, formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const semestre = String(formData.get("semestre") || "").trim();
  const professorId = String(formData.get("professorId") || "").trim();

  if (!nome || !semestre) return;

  await db
    .collection("disciplinas")
    .doc(id)
    .update({
      nome,
      semestre,
      professorId: professorId || null,
    });

  revalidatePath("/aulas");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function deleteDisciplina(id: string) {
  await requireAdmin();

  const [aulasSnap, presencasSnap, notasSnap, provasSnap, gruposSnap] = await Promise.all([
    db.collection("aulas").where("disciplinaId", "==", id).get(),
    db.collection("presencas").where("disciplinaId", "==", id).get(),
    db.collection("notas").where("disciplinaId", "==", id).get(),
    db.collection("provas").where("disciplinaId", "==", id).get(),
    db.collection("grupos").where("disciplinaId", "==", id).get(),
  ]);

  const aulaIds = aulasSnap.docs.map((d) => d.id);
  const favoritosSnaps = await Promise.all(
    chunk(aulaIds, 10).map((ids) =>
      ids.length ? db.collection("vademecum_favoritos").where("aulaId", "in", ids).get() : null
    )
  );

  const batch = db.batch();
  for (const doc of aulasSnap.docs) batch.delete(doc.ref);
  for (const doc of presencasSnap.docs) batch.delete(doc.ref);
  for (const doc of notasSnap.docs) batch.delete(doc.ref);
  for (const doc of provasSnap.docs) batch.delete(doc.ref);
  for (const doc of gruposSnap.docs) batch.update(doc.ref, { disciplinaId: null });
  for (const snap of favoritosSnaps) {
    if (!snap) continue;
    for (const doc of snap.docs) batch.update(doc.ref, { aulaId: null });
  }
  batch.delete(db.collection("disciplinas").doc(id));
  await batch.commit();

  revalidatePath("/aulas");
}

export async function createAula(disciplinaId: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");

  if (!tema || !dataStr) return;

  await db.collection("aulas").add({
    disciplinaId,
    tema,
    data: new Date(dataStr),
    resumo: String(formData.get("resumo") || "").trim() || null,
    anotacoesLousa: String(formData.get("anotacoesLousa") || "").trim() || null,
    resumoIA: null,
    createdAt: new Date(),
  });

  revalidatePath("/aulas");
  revalidatePath("/historico");
}

export async function updateAula(aulaId: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");

  await db
    .collection("aulas")
    .doc(aulaId)
    .update({
      tema,
      ...(dataStr ? { data: new Date(dataStr) } : {}),
      resumo: String(formData.get("resumo") || "").trim() || null,
      anotacoesLousa: String(formData.get("anotacoesLousa") || "").trim() || null,
    });

  revalidatePath("/aulas");
  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

export async function deleteAula(aulaId: string, disciplinaId: string) {
  const favoritosSnap = await db
    .collection("vademecum_favoritos")
    .where("aulaId", "==", aulaId)
    .get();

  const batch = db.batch();
  for (const doc of favoritosSnap.docs) batch.update(doc.ref, { aulaId: null });
  batch.delete(db.collection("aulas").doc(aulaId));
  await batch.commit();

  revalidatePath("/aulas");
  redirect(`/aulas?abrir=disciplinas#${disciplinaId}`);
}

export async function gerarResumoIA(aulaId: string) {
  const aulaDoc = await db.collection("aulas").doc(aulaId).get();
  const aula = aulaDoc.data();
  if (!aula) throw new Error("Aula não encontrada");

  if (!aula.resumo && !aula.anotacoesLousa) {
    return;
  }

  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          `Você é um assistente de estudos para uma aluna de Direito.`,
          `Com base no resumo da aula e nas anotações da lousa abaixo, escreva um resumo inteligente e organizado (em português) para revisão antes de provas: destaque os conceitos-chave, defina termos importantes e, se fizer sentido, cite artigos de lei mencionados. Use tópicos curtos. Não invente conteúdo que não esteja implícito no material.`,
          ``,
          `Tema da aula: ${aula.tema}`,
          ``,
          `Resumo da aula:`,
          aula.resumo || "(não preenchido)",
          ``,
          `Anotações da lousa:`,
          aula.anotacoesLousa || "(não preenchido)",
        ].join("\n"),
      },
    ],
  });

  const resumoIA = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  await db.collection("aulas").doc(aulaId).update({ resumoIA });

  revalidatePath(`/aulas/${aulaId}`);
}

export async function gerarQuizAula(aulaId: string) {
  const aulaDoc = await db.collection("aulas").doc(aulaId).get();
  const aula = aulaDoc.data();
  if (!aula) throw new Error("Aula não encontrada");
  if (!aula.resumo && !aula.anotacoesLousa) return;

  const conteudo = [aula.resumo, aula.anotacoesLousa].filter(Boolean).join("\n\n");
  const quizIA = await gerarQuizComIA(`a aula "${aula.tema}"`, conteudo, 5);

  await db.collection("aulas").doc(aulaId).update({ quizIA });

  revalidatePath(`/aulas/${aulaId}`);
}

export async function gerarQuizDisciplina(disciplinaId: string) {
  const [disciplinaDoc, aulasSnap] = await Promise.all([
    db.collection("disciplinas").doc(disciplinaId).get(),
    db.collection("aulas").where("disciplinaId", "==", disciplinaId).get(),
  ]);
  const disciplina = disciplinaDoc.data();
  if (!disciplina) throw new Error("Disciplina não encontrada");

  const conteudos = aulasSnap.docs
    .map((doc) => doc.data())
    .filter((aula) => aula.resumo || aula.anotacoesLousa)
    .map((aula) => `Aula "${aula.tema}":\n${[aula.resumo, aula.anotacoesLousa].filter(Boolean).join("\n")}`);

  if (conteudos.length === 0) return;

  const quizIA = await gerarQuizComIA(
    `a disciplina "${disciplina.nome}" (várias aulas)`,
    conteudos.join("\n\n---\n\n"),
    10
  );

  await db.collection("disciplinas").doc(disciplinaId).update({ quizIA, quizIAGeradoEm: new Date() });

  revalidatePath("/aulas");
}
