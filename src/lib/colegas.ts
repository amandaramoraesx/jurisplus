import { cache } from "react";
import { auth } from "@/lib/firebase-admin";

export type Colega = { uid: string; nome: string };

/** Logins do Juris+ (menos o próprio), pra escolher com quem compartilhar uma anotação. */
export const listarColegas = cache(async (meuUid: string): Promise<Colega[]> => {
  const { users } = await auth.listUsers();
  return users
    .filter((u) => u.uid !== meuUid && !u.disabled)
    .map((u) => ({ uid: u.uid, nome: u.displayName || u.email?.split("@")[0] || "Colega" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
});

/** Lê os uids marcados no form e descarta o que não for colega de verdade (ou o próprio login). */
export async function lerCompartilhadoCom(formData: FormData, meuUid: string): Promise<string[]> {
  const marcados = new Set(formData.getAll("compartilhadoCom").map(String));
  if (marcados.size === 0) return [];
  const colegas = await listarColegas(meuUid);
  return colegas.filter((c) => marcados.has(c.uid)).map((c) => c.uid);
}
