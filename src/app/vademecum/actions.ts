"use server";

import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { garantirDono } from "@/lib/dono";

export async function criarArtigo(formData: FormData) {
  await requireUser();
  const codigo = String(formData.get("codigo") || "").trim();
  const numero = String(formData.get("numero") || "").trim();
  const texto = String(formData.get("texto") || "").trim();

  if (!codigo || !numero || !texto) return;

  await db.collection("vademecum_artigos").add({ codigo, numero, texto });

  revalidatePath("/vademecum");
}

export async function favoritarArtigo(formData: FormData) {
  const user = await requireUser();
  const codigo = String(formData.get("codigo") || "").trim();
  const numero = String(formData.get("numero") || "").trim();
  const texto = String(formData.get("texto") || "").trim();
  const aulaId = String(formData.get("aulaId") || "").trim();
  const fonte = String(formData.get("fonte") || "").trim();

  if (!codigo || !numero || !texto) return;

  await db.collection("vademecum_favoritos").add({
    uid: user.uid,
    codigo,
    numero,
    texto,
    aulaId: aulaId || null,
    createdAt: new Date(),
    fonte: fonte || null,
  });

  revalidatePath("/vademecum");
}

export async function vincularFavoritoAula(favoritoId: string, formData: FormData) {
  const user = await requireUser();
  const aulaId = String(formData.get("aulaId") || "").trim();

  const doc = await garantirDono("vademecum_favoritos", favoritoId, user.uid);
  await doc.ref.update({ aulaId: aulaId || null });

  revalidatePath("/vademecum");
}

export async function removeFavorito(id: string) {
  const user = await requireUser();
  const doc = await garantirDono("vademecum_favoritos", id, user.uid);
  await doc.ref.delete();
  revalidatePath("/vademecum");
}
