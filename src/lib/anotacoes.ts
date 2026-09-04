import { db } from "@/lib/firebase-admin";
import { fromDoc, type AnotacaoPessoal } from "@/lib/firestore";

function refAnotacoes(aulaId: string) {
  return db.collection("aulas").doc(aulaId).collection("anotacoes");
}

/** Notas pessoais marcadas como compartilhadas numa aula (visíveis pra qualquer colega). */
export async function buscarNotasCompartilhadas(aulaId: string): Promise<AnotacaoPessoal[]> {
  const snap = await refAnotacoes(aulaId).where("compartilhado", "==", true).get();
  return snap.docs.map((doc) => fromDoc<AnotacaoPessoal>(doc));
}

/** Mesma coisa, em lote pra várias aulas (uma query por aula, em paralelo). */
export async function buscarNotasCompartilhadasEmLote(
  aulaIds: string[]
): Promise<Map<string, AnotacaoPessoal[]>> {
  const listas = await Promise.all(aulaIds.map((id) => buscarNotasCompartilhadas(id)));
  return new Map(aulaIds.map((id, i) => [id, listas[i]]));
}

/** A anotação pessoal do próprio login numa aula (privada por padrão). */
export async function buscarMinhaAnotacao(aulaId: string, uid: string): Promise<AnotacaoPessoal | null> {
  const doc = await refAnotacoes(aulaId).doc(uid).get();
  return doc.exists ? fromDoc<AnotacaoPessoal>(doc) : null;
}

/**
 * Junta o que ficou gravado direto na aula (de antes das anotações virarem por login) com as
 * notas marcadas como compartilhadas, num texto único — usado pra alimentar a IA (resumo/quiz) e
 * o "conteúdo sugerido" das provas. Nunca inclui nota privada de ninguém.
 */
export function textoCompartilhadoParaIA(
  aulaLegado: { resumo?: string | null; anotacoesLousa?: string | null },
  compartilhadas: AnotacaoPessoal[]
): string {
  const partes: string[] = [];
  if (aulaLegado.resumo) partes.push(aulaLegado.resumo);
  if (aulaLegado.anotacoesLousa) partes.push(aulaLegado.anotacoesLousa);
  for (const nota of compartilhadas) {
    if (nota.resumo) partes.push(nota.resumo);
    if (nota.anotacoesLousa) partes.push(nota.anotacoesLousa);
  }
  return partes.join("\n\n");
}
