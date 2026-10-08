import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type AnotacaoPessoal, type Aula } from "@/lib/firestore";

function refAnotacoes(aulaId: string) {
  return db.collection("aulas").doc(aulaId).collection("anotacoes");
}

/** O caderno pessoal do login numa aula (anotações, lousa, anexos e IA). Só o dono lê. */
export async function buscarMinhaAnotacao(aulaId: string, uid: string): Promise<AnotacaoPessoal | null> {
  const doc = await refAnotacoes(aulaId).doc(uid).get();
  return doc.exists ? fromDoc<AnotacaoPessoal>(doc) : null;
}

/** Mesma coisa pra várias aulas, numa leitura só. */
export async function buscarMinhasAnotacoesEmLote(
  aulaIds: string[],
  uid: string
): Promise<Map<string, AnotacaoPessoal>> {
  if (aulaIds.length === 0) return new Map();
  const docs = await db.getAll(...aulaIds.map((id) => refAnotacoes(id).doc(uid)));
  const mapa = new Map<string, AnotacaoPessoal>();
  docs.forEach((doc, i) => {
    if (doc.exists) mapa.set(aulaIds[i], fromDoc<AnotacaoPessoal>(doc));
  });
  return mapa;
}

/** Texto da anotação + lousa, usado pra alimentar a IA e o "conteúdo sugerido" das provas. */
export function textoDaAnotacao(nota: Pick<AnotacaoPessoal, "resumo" | "anotacoesLousa"> | null | undefined) {
  return [nota?.resumo, nota?.anotacoesLousa].filter(Boolean).join("\n\n");
}

/**
 * Aulas que aparecem pra esse login: só as que ele participa (fez check-in, anotou ou criou).
 * Ordena em memória (array-contains + orderBy exigiria índice composto).
 */
export async function buscarAulasDoUsuario(uid: string, disciplinaId?: string): Promise<Aula[]> {
  const snap = await db.collection("aulas").where("participantes", "array-contains", uid).get();
  return snap.docs
    .map((doc) => fromDoc<Aula>(doc))
    .filter((aula) => !disciplinaId || aula.disciplinaId === disciplinaId)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
}

export function participaDaAula(aula: Pick<Aula, "participantes">, uid: string) {
  return Boolean(aula.participantes?.includes(uid));
}

/** Marca o login como participante (a aula passa a aparecer nas listas dele). */
export async function participarDaAula(aulaId: string, uid: string) {
  await db.collection("aulas").doc(aulaId).update({ participantes: FieldValue.arrayUnion(uid) });
}

/**
 * Garante que existe a aula do dia da disciplina (id determinístico) e que o login participa dela —
 * check-in, frequência e anotação rápida usam isso.
 */
export async function garantirAulaDoDia(disciplinaId: string, data: Date, uid: string) {
  const id = `${disciplinaId}_${dateOnlyKey(data)}`;
  const ref = db.collection("aulas").doc(id);
  const doc = await ref.get();
  if (doc.exists) {
    if (!participaDaAula(doc.data() as Aula, uid)) await participarDaAula(id, uid);
    return id;
  }

  await ref.set({
    disciplinaId,
    data,
    tema: `Aula de ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(data)}`,
    resumo: null,
    anotacoesLousa: null,
    resumoIA: null,
    participantes: [uid],
    createdAt: new Date(),
  });
  return id;
}
