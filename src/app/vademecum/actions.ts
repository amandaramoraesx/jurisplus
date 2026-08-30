"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function favoritarArtigo(formData: FormData) {
  const codigo = String(formData.get("codigo") || "").trim();
  const numero = String(formData.get("numero") || "").trim();
  const texto = String(formData.get("texto") || "").trim();
  const aulaId = String(formData.get("aulaId") || "").trim();

  if (!codigo || !numero || !texto) return;

  await db.collection("vademecum_favoritos").add({
    codigo,
    numero,
    texto,
    aulaId: aulaId || null,
    createdAt: new Date(),
  });

  revalidatePath("/vademecum");
}

export async function vincularFavoritoAula(favoritoId: string, formData: FormData) {
  const aulaId = String(formData.get("aulaId") || "").trim();

  await db
    .collection("vademecum_favoritos")
    .doc(favoritoId)
    .update({ aulaId: aulaId || null });

  revalidatePath("/vademecum");
}

export async function removeFavorito(id: string) {
  await db.collection("vademecum_favoritos").doc(id).delete();
  revalidatePath("/vademecum");
}
