"use server";

import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db, storage } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAnthropicClient, gerarQuizComIA, gerarMapaMentalComIA } from "@/lib/anthropic";
import { requireAdmin, requireUser } from "@/lib/auth";
import { garantirDono, idPresenca } from "@/lib/dono";
import { fromDoc, type Anexo, type Aula } from "@/lib/firestore";
import {
  buscarMinhaAnotacao,
  buscarMinhasAnotacoesEmLote,
  buscarAulasDoUsuario,
  garantirAulaDoDia,
  participaDaAula,
  textoDaAnotacao,
} from "@/lib/anotacoes";

/** Caderno pessoal do login na aula (anotações, anexos, IA). */
function refMeuCaderno(aulaId: string, uid: string) {
  return db.collection("aulas").doc(aulaId).collection("anotacoes").doc(uid);
}

/** Lê a aula e garante que o login participa dela (senão, pra ele, a aula não existe). */
async function minhaAula(aulaId: string, uid: string): Promise<Aula> {
  const doc = await db.collection("aulas").doc(aulaId).get();
  if (!doc.exists) throw new Error("Aula não encontrada");
  const aula = fromDoc<Aula>(doc);
  if (!participaDaAula(aula, uid)) throw new Error("Aula não encontrada");
  return aula;
}

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

/** Registra (ou corrige, se já existir nesse dia) a frequência de uma disciplina numa data qualquer. */
export async function registrarPresenca(disciplinaId: string, formData: FormData) {
  const user = await requireUser();

  const dataStr = String(formData.get("data") || "");
  if (!dataStr) return;
  const presente = formData.get("presente") === "true";

  const data = new Date(dataStr);

  await db
    .collection("presencas")
    .doc(idPresenca(user.uid, disciplinaId, data))
    .set({ uid: user.uid, disciplinaId, data, presente, createdAt: new Date() }, { merge: true });
  await garantirAulaDoDia(disciplinaId, data, user.uid);

  revalidatePath("/aulas");
  revalidatePath("/");
}

export async function removerPresenca(presencaId: string) {
  const user = await requireUser();

  const doc = await garantirDono("presencas", presencaId, user.uid);
  await doc.ref.delete();

  revalidatePath("/aulas");
  revalidatePath("/");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Move a disciplina pra lixeira: some das listas ativas, mas não apaga nada (aulas, anotações,
 * presenças, provas e notas continuam intactas e recuperáveis). Ver excluirDisciplinaPermanentemente
 * pra apagar de verdade, só depois de já estar arquivada.
 */
export async function arquivarDisciplina(id: string) {
  await requireAdmin();

  await db.collection("disciplinas").doc(id).update({ arquivadaEm: new Date() });

  revalidatePath("/aulas");
  revalidatePath("/");
}

export async function restaurarDisciplina(id: string) {
  await requireAdmin();

  await db.collection("disciplinas").doc(id).update({ arquivadaEm: null });

  revalidatePath("/aulas");
  revalidatePath("/");
}

/** Apagamento de verdade (sem volta) — só permitido numa disciplina que já está na lixeira. */
export async function excluirDisciplinaPermanentemente(id: string) {
  await requireAdmin();

  const disciplinaDoc = await db.collection("disciplinas").doc(id).get();
  if (!disciplinaDoc.exists) return;
  if (!disciplinaDoc.data()?.arquivadaEm) {
    throw new Error("Arquive a disciplina (mande pra lixeira) antes de excluir definitivamente.");
  }

  const [aulasSnap, presencasSnap, notasSnap, provasSnap, gruposSnap] = await Promise.all([
    db.collection("aulas").where("disciplinaId", "==", id).get(),
    db.collection("presencas").where("disciplinaId", "==", id).get(),
    db.collection("notas").where("disciplinaId", "==", id).get(),
    db.collection("provas").where("disciplinaId", "==", id).get(),
    db.collection("grupos").where("disciplinaId", "==", id).get(),
  ]);

  const aulaIds = aulasSnap.docs.map((d) => d.id);
  const quizzesSnap = await db.collection("disciplinas").doc(id).collection("quizzes").get();
  const [favoritosSnaps, anotacoesSnaps] = await Promise.all([
    Promise.all(
      chunk(aulaIds, 10).map((ids) =>
        ids.length ? db.collection("vademecum_favoritos").where("aulaId", "in", ids).get() : null
      )
    ),
    Promise.all(aulaIds.map((aulaId) => db.collection("aulas").doc(aulaId).collection("anotacoes").get())),
  ]);

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
  for (const snap of anotacoesSnaps) {
    for (const doc of snap.docs) batch.delete(doc.ref);
  }
  for (const doc of quizzesSnap.docs) batch.delete(doc.ref);
  batch.delete(db.collection("disciplinas").doc(id));
  await batch.commit();

  revalidatePath("/aulas");
}

export async function createAula(disciplinaId: string, formData: FormData) {
  const user = await requireUser();
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
    participantes: [user.uid],
    createdAt: new Date(),
  });

  revalidatePath("/aulas");
  revalidatePath("/historico");
}

export async function updateAula(aulaId: string, formData: FormData) {
  const user = await requireUser();
  await minhaAula(aulaId, user.uid);
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

/** Anotação pessoal do login atual numa aula — só ele vê. */
export async function salvarAnotacaoPessoal(aulaId: string, formData: FormData) {
  const user = await requireUser();
  await minhaAula(aulaId, user.uid);

  const resumo = String(formData.get("resumo") || "").trim();
  const anotacoesLousa = String(formData.get("anotacoesLousa") || "").trim();

  await refMeuCaderno(aulaId, user.uid).set(
    {
      uid: user.uid,
      nome: user.nome || user.email || "Colega",
      resumo: resumo || null,
      anotacoesLousa: anotacoesLousa || null,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  revalidatePath("/");
  revalidatePath("/aulas");
  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

/**
 * "Remover esta aula": tira a aula da lista de quem pediu e apaga o caderno dele nela (anotações,
 * anexos, IA). Os outros participantes não são afetados; sem ninguém, a aula some de vez.
 */
export async function deleteAula(aulaId: string, disciplinaId: string) {
  const user = await requireUser();
  const aula = await minhaAula(aulaId, user.uid);

  const [meuCaderno, favoritosSnap] = await Promise.all([
    buscarMinhaAnotacao(aulaId, user.uid),
    db.collection("vademecum_favoritos").where("aulaId", "==", aulaId).where("uid", "==", user.uid).get(),
  ]);
  await Promise.all(
    (meuCaderno?.anexos ?? []).map((anexo) =>
      storage.bucket().file(anexo.storagePath).delete({ ignoreNotFound: true })
    )
  );

  const restantes = (aula.participantes ?? []).filter((uid) => uid !== user.uid);
  const batch = db.batch();
  for (const doc of favoritosSnap.docs) batch.update(doc.ref, { aulaId: null });
  batch.delete(refMeuCaderno(aulaId, user.uid));
  if (restantes.length === 0) {
    batch.delete(db.collection("aulas").doc(aulaId));
  } else {
    batch.update(db.collection("aulas").doc(aulaId), { participantes: FieldValue.arrayRemove(user.uid) });
  }
  await batch.commit();

  revalidatePath("/aulas");
  revalidatePath("/historico");
  revalidatePath("/");
  redirect(`/aulas?abrir=disciplinas#${disciplinaId}`);
}

export async function adicionarAnexoAula(aulaId: string, formData: FormData) {
  const user = await requireUser();
  await minhaAula(aulaId, user.uid);

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
  const storagePath = `aulas/${aulaId}/${user.uid}/${anexoId}-${arquivo.name}`;
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

  // Anexo é pessoal: fica no caderno de quem enviou.
  await refMeuCaderno(aulaId, user.uid).set(
    { uid: user.uid, nome: user.nome || user.email || "Colega", anexos: FieldValue.arrayUnion(anexo) },
    { merge: true }
  );

  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

export async function removerAnexoAula(aulaId: string, anexoId: string) {
  const user = await requireUser();

  // Só acha (e apaga) anexo do próprio caderno.
  const caderno = await buscarMinhaAnotacao(aulaId, user.uid);
  const anexo = caderno?.anexos?.find((a) => a.id === anexoId);
  if (!anexo) return;

  await storage.bucket().file(anexo.storagePath).delete({ ignoreNotFound: true });
  await refMeuCaderno(aulaId, user.uid).update({
    anexos: (caderno?.anexos ?? []).filter((a) => a.id !== anexoId),
  });

  revalidatePath(`/aulas/${aulaId}`);
  revalidatePath("/historico");
}

/** Conteúdo pra IA: só as anotações do próprio login nessa aula. */
async function meuConteudoDaAula(aulaId: string, uid: string) {
  const [aula, caderno] = await Promise.all([minhaAula(aulaId, uid), buscarMinhaAnotacao(aulaId, uid)]);
  return { aula, conteudo: textoDaAnotacao(caderno) };
}

export async function gerarResumoIA(aulaId: string) {
  const user = await requireUser();
  const { aula, conteudo } = await meuConteudoDaAula(aulaId, user.uid);
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
          `Com base nas anotações da aula abaixo, escreva um resumo inteligente e organizado (em português) para revisão antes de provas: destaque os conceitos-chave, defina termos importantes e, se fizer sentido, cite artigos de lei mencionados. Use tópicos curtos. Não invente conteúdo que não esteja implícito no material.`,
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

  await refMeuCaderno(aulaId, user.uid).set({ uid: user.uid, resumoIA }, { merge: true });

  revalidatePath(`/aulas/${aulaId}`);
}

export async function gerarQuizAula(aulaId: string) {
  const user = await requireUser();
  const { aula, conteudo } = await meuConteudoDaAula(aulaId, user.uid);
  if (!conteudo) return;

  const quizIA = await gerarQuizComIA(`a aula "${aula.tema}"`, conteudo, 5);

  await refMeuCaderno(aulaId, user.uid).set({ uid: user.uid, quizIA }, { merge: true });

  revalidatePath(`/aulas/${aulaId}`);
}

export async function gerarMapaMentalAula(aulaId: string) {
  const user = await requireUser();
  const { aula, conteudo } = await meuConteudoDaAula(aulaId, user.uid);
  if (!conteudo) return;

  const mapaMental = await gerarMapaMentalComIA(`a aula "${aula.tema}"`, conteudo);

  await refMeuCaderno(aulaId, user.uid).set(
    { uid: user.uid, mapaMental, mapaMentalGeradoEm: new Date() },
    { merge: true }
  );

  revalidatePath(`/aulas/${aulaId}`);
}

/** Quiz de revisão da disciplina, feito só com as anotações do próprio login (fica guardado só pra ele). */
export async function gerarQuizDisciplina(disciplinaId: string) {
  const user = await requireUser();
  const [disciplinaDoc, aulas] = await Promise.all([
    db.collection("disciplinas").doc(disciplinaId).get(),
    buscarAulasDoUsuario(user.uid, disciplinaId),
  ]);
  const disciplina = disciplinaDoc.data();
  if (!disciplina) throw new Error("Disciplina não encontrada");

  const cadernos = await buscarMinhasAnotacoesEmLote(aulas.map((a) => a.id), user.uid);
  const conteudos = aulas
    .map((aula) => {
      const conteudo = textoDaAnotacao(cadernos.get(aula.id));
      return conteudo ? `Aula "${aula.tema}":\n${conteudo}` : null;
    })
    .filter((v): v is string => Boolean(v));

  if (conteudos.length === 0) return;

  const quizIA = await gerarQuizComIA(
    `a disciplina "${disciplina.nome}" (várias aulas)`,
    conteudos.join("\n\n---\n\n"),
    10
  );

  await db
    .collection("disciplinas")
    .doc(disciplinaId)
    .collection("quizzes")
    .doc(user.uid)
    .set({ uid: user.uid, quizIA, quizIAGeradoEm: new Date() });

  revalidatePath("/aulas");
}
