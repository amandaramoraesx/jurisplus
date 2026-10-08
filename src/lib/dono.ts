import { db } from "@/lib/firebase-admin";
import { dateOnlyKey } from "@/lib/firestore";

/**
 * Coleções pessoais: cada documento tem `uid` de quem criou e só essa pessoa vê.
 * Disciplinas, professores, aulas e provas continuam da turma (iguais pra todo mundo).
 */
export const COLECOES_PESSOAIS = ["presencas", "notas", "palestras", "grupos", "vademecum_favoritos"] as const;

/** Frequência é uma por pessoa, disciplina e dia — o id inclui o uid pra não colidir entre colegas. */
export function idPresenca(uid: string, disciplinaId: string, data: Date) {
  return `${uid}_${disciplinaId}_${dateOnlyKey(data)}`;
}

/** Garante que o documento pessoal é de quem está pedindo (ação de editar/apagar). */
export async function garantirDono(colecao: (typeof COLECOES_PESSOAIS)[number], id: string, uid: string) {
  const doc = await db.collection(colecao).doc(id).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    throw new Error("Esse registro não é seu.");
  }
  return doc;
}

const flagMigracao = () => db.collection("config").doc("migracao_dono_v1");
let migracaoConferida = false;

/**
 * Antes deste ajuste tudo era compartilhado e nada tinha dono. Na primeira vez que uma admin
 * entra, os registros pessoais sem `uid` passam a ser dela (presenças ganham id novo com uid).
 * Roda uma vez só (marca em config/migracao_dono_v1).
 */
export async function migrarDadosSemDono(uid: string) {
  if (migracaoConferida) return;
  const flag = await flagMigracao().get();
  if (flag.exists) {
    migracaoConferida = true;
    return;
  }

  type Op = (batch: FirebaseFirestore.WriteBatch) => void;
  const ops: Op[] = [];

  for (const colecao of COLECOES_PESSOAIS) {
    const snap = await db.collection(colecao).get();
    for (const doc of snap.docs) {
      const dados = doc.data();
      if (dados.uid) continue;
      if (colecao === "presencas") {
        const data: Date = dados.data?.toDate?.() ?? new Date(dados.data);
        const novoRef = db.collection("presencas").doc(idPresenca(uid, dados.disciplinaId, data));
        ops.push((b) => b.set(novoRef, { ...dados, uid }, { merge: true }));
        ops.push((b) => b.delete(doc.ref));
      } else {
        ops.push((b) => b.update(doc.ref, { uid }));
      }
    }
  }

  // Lote do Firestore aceita no máximo 500 operações.
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
  }

  await flagMigracao().set({ uid, migradoEm: new Date(), registros: ops.length });
  migracaoConferida = true;
}
