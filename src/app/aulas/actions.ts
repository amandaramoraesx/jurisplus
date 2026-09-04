"use server";

import { randomUUID } from "crypto";
import { db, storage } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAnthropicClient, gerarQuizComIA } from "@/lib/anthropic";
import { requireAdmin, requireUser } from "@/lib/auth";
import type { Anexo } from "@/lib/firestore";
import {
  buscarNotasCompartilhadas,
  buscarNotasCompartilhadasEmLote,
  textoCompartilhadoParaIA,
} from "@/lib/anotacoes";

const TIPOS_ANEXO_PERMITIDOS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "imagem",
  "image/png": "imagem",
  "image/webp": "imagem",
  "image/gif": "imagem",
  "application/vnd.ms-powerpoint": "slide",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slide",
};

const ANEXO_TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15MB

function parseDiasSemana(formData: FormData): number[] {
  return formData
    .getAll("diasSemana")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export async function createDisciplina(formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const semestre = String(formData.get("semestre") || "").trim();
  const professorId = String(formData.get("professorId") || "").trim();
  const horario = String(formData.get("horario") || "").trim();
  const diasSemana = parseDiasSemana(formData);

  if (!nome || !semestre) return;

  await db.collection("disciplinas").add({
    nome,
    semestre,
    professorId: professorId || null,
    diasSemana,
    horario: horario || null,
    createdAt: new Date(),
  });

  revalidatePath("/aulas");
  revalidatePath("/");
}

export async function updateDisciplina(id: string, formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const semestre = String(formData.get("semestre") || "").trim();
  const professorId = String(formData.get("professorId") || "").trim();
  const horario = String(formData.get("horario") || "").trim();
  const diasSemana = parseDiasSemana(formData);

  if (!nome || !semestre) return;

  await db
    .collection("disciplinas")
    .doc(id)
    .update({
      nome,
      semestre,
      professorId: professorId || null,
      diasSemana,
      horario: horario || null,
    });

  revalidatePath("/aulas");
  revalidatePath("/");
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
    resumo: null,
    anotacoesLousa: null,
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
    });

  revalidatePath("/aulas");
  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

/** Anotação pessoal do login atual numa aula — privada por padrão, só aparece pros colegas se "compartilhado". */
export async function salvarAnotacaoPessoal(aulaId: string, formData: FormData) {
  const user = await requireUser();

  const resumo = String(formData.get("resumo") || "").trim();
  const anotacoesLousa = String(formData.get("anotacoesLousa") || "").trim();
  const compartilhado = formData.get("compartilhado") === "on";

  await db
    .collection("aulas")
    .doc(aulaId)
    .collection("anotacoes")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        nome: user.nome || user.email || "Colega",
        resumo: resumo || null,
        anotacoesLousa: anotacoesLousa || null,
        compartilhado,
        updatedAt: new Date(),
      },
      { merge: true }
    );

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

export async function deleteAula(aulaId: string, disciplinaId: string) {
  const [favoritosSnap, anotacoesSnap] = await Promise.all([
    db.collection("vademecum_favoritos").where("aulaId", "==", aulaId).get(),
    db.collection("aulas").doc(aulaId).collection("anotacoes").get(),
  ]);

  const batch = db.batch();
  for (const doc of favoritosSnap.docs) batch.update(doc.ref, { aulaId: null });
  for (const doc of anotacoesSnap.docs) batch.delete(doc.ref);
  batch.delete(db.collection("aulas").doc(aulaId));
  await batch.commit();

  revalidatePath("/aulas");
  redirect(`/aulas?abrir=disciplinas#${disciplinaId}`);
}

export async function adicionarAnexoAula(aulaId: string, formData: FormData) {
  await requireUser();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione um arquivo para anexar.");
  }
  if (!TIPOS_ANEXO_PERMITIDOS[arquivo.type]) {
    throw new Error(
      "Só é possível anexar PDF, imagem (JPG, PNG, WEBP ou GIF) ou slide (PPT ou PPTX)."
    );
  }
  if (arquivo.size > ANEXO_TAMANHO_MAXIMO) {
    throw new Error("Arquivo muito grande (máximo 15 MB).");
  }

  const anexoId = randomUUID();
  const storagePath = `aulas/${aulaId}/${anexoId}-${arquivo.name}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  await storage.bucket().file(storagePath).save(buffer, {
    contentType: arquivo.type,
  });

  const anexo: Anexo = {
    id: anexoId,
    nome: arquivo.name,
    tipo: arquivo.type,
    tamanho: arquivo.size,
    storagePath,
    criadoEm: new Date().toISOString(),
  };

  const aulaRef = db.collection("aulas").doc(aulaId);
  const aulaDoc = await aulaRef.get();
  const anexosAtuais = (aulaDoc.data()?.anexos as Anexo[] | undefined) ?? [];
  await aulaRef.update({ anexos: [...anexosAtuais, anexo] });

  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

export async function removerAnexoAula(aulaId: string, anexoId: string, storagePath: string) {
  await requireUser();

  await storage
    .bucket()
    .file(storagePath)
    .delete({ ignoreNotFound: true });

  const aulaRef = db.collection("aulas").doc(aulaId);
  const aulaDoc = await aulaRef.get();
  const anexosAtuais = (aulaDoc.data()?.anexos as Anexo[] | undefined) ?? [];
  await aulaRef.update({ anexos: anexosAtuais.filter((a) => a.id !== anexoId) });

  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

export async function gerarResumoIA(aulaId: string) {
  const aulaDoc = await db.collection("aulas").doc(aulaId).get();
  const aula = aulaDoc.data();
  if (!aula) throw new Error("Aula não encontrada");

  const compartilhadas = await buscarNotasCompartilhadas(aulaId);
  const conteudo = textoCompartilhadoParaIA(aula, compartilhadas);
  if (!conteudo) return;

  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          `Você é um assistente de estudos para uma aluna de Direito.`,
          `Com base nas anotações da aula abaixo (podem vir de mais de um colega), escreva um resumo inteligente e organizado (em português) para revisão antes de provas: destaque os conceitos-chave, defina termos importantes e, se fizer sentido, cite artigos de lei mencionados. Use tópicos curtos. Não invente conteúdo que não esteja implícito no material.`,
          ``,
          `Tema da aula: ${aula.tema}`,
          ``,
          `Anotações:`,
          conteudo,
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

  const compartilhadas = await buscarNotasCompartilhadas(aulaId);
  const conteudo = textoCompartilhadoParaIA(aula, compartilhadas);
  if (!conteudo) return;

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

  const aulas = aulasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as { id: string; tema: string; resumo?: string | null; anotacoesLousa?: string | null });
  const compartilhadasPorAula = await buscarNotasCompartilhadasEmLote(aulas.map((a) => a.id));

  const conteudos = aulas
    .map((aula) => {
      const conteudo = textoCompartilhadoParaIA(aula, compartilhadasPorAula.get(aula.id) ?? []);
      return conteudo ? `Aula "${aula.tema}":\n${conteudo}` : null;
    })
    .filter((v): v is string => Boolean(v));

  if (conteudos.length === 0) return;

  const quizIA = await gerarQuizComIA(
    `a disciplina "${disciplina.nome}" (várias aulas)`,
    conteudos.join("\n\n---\n\n"),
    10
  );

  await db.collection("disciplinas").doc(disciplinaId).update({ quizIA, quizIAGeradoEm: new Date() });

  revalidatePath("/aulas");
}
