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
 * Aulas que aparecem pra esse login: as que ele participa (fez check-in, anotou ou criou) e as
 * que algum colega compartilhou com ele. Ordena em memória (array-contains + orderBy exigiria
 * índice composto).
 */
export async function buscarAulasDoUsuario(uid: string, disciplinaId?: string): Promise<Aula[]> {
  const [minhas, compartilhadas] = await Promise.all([
    db.collection("aulas").where("participantes", "array-contains", uid).get(),
    db.collection("aulas").where("leitores", "array-contains", uid).get(),
  ]);
  const porId = new Map<string, Aula>();
  for (const doc of [...minhas.docs, ...compartilhadas.docs]) porId.set(doc.id, fromDoc<Aula>(doc));
  return [...porId.values()]
    .filter((aula) => !disciplinaId || aula.disciplinaId === disciplinaId)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
}

export function participaDaAula(aula: Pick<Aula, "participantes">, uid: string) {
  return Boolean(aula.participantes?.includes(uid));
}

/** Pode abrir a aula: participa dela ou um colega compartilhou a anotação com ele. */
export function podeVerAula(aula: Pick<Aula, "participantes" | "leitores">, uid: string) {
  return participaDaAula(aula, uid) || Boolean(aula.leitores?.includes(uid));
}

/** Anotações de colegas que compartilharam esta aula comigo (só anotação e lousa). */
export async function buscarCompartilhadasComigo(aulaId: string, uid: string): Promise<AnotacaoPessoal[]> {
  const snap = await refAnotacoes(aulaId).where("compartilhadoCom", "array-contains", uid).get();
  return snap.docs.map((doc) => fromDoc<AnotacaoPessoal>(doc)).filter((nota) => nota.uid !== uid);
}

export async function buscarCompartilhadasComigoEmLote(aulaIds: string[], uid: string) {
  const listas = await Promise.all(aulaIds.map((id) => buscarCompartilhadasComigo(id, uid)));
  return new Map(aulaIds.map((id, i) => [id, listas[i]]));
}

/** Recalcula `leitores` da aula (união do `compartilhadoCom` de todos os cadernos). */
export async function atualizarLeitores(aulaId: string) {
  const snap = await refAnotacoes(aulaId).get();
  const leitores = new Set<string>();
  for (const doc of snap.docs) for (const uid of (doc.data().compartilhadoCom as string[] | undefined) ?? []) leitores.add(uid);
  await db.collection("aulas").doc(aulaId).update({ leitores: [...leitores] });
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
