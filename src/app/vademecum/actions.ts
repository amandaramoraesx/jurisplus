"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function favoritarArtigo(formData: FormData) {
  const codigo = String(formData.get("codigo") || "").trim();
  const numero = String(formData.get("numero") || "").trim();
  const texto = String(formData.get("texto") || "").trim();
  const aulaId = String(formData.get("aulaId") || "").trim();

  if (!codigo || !numero || !texto) return;

  await prisma.vadeMecumFavorito.create({
    data: { codigo, numero, texto, aulaId: aulaId || null },
  });

  revalidatePath("/vademecum");
}

export async function vincularFavoritoAula(favoritoId: string, formData: FormData) {
  const aulaId = String(formData.get("aulaId") || "").trim();

  await prisma.vadeMecumFavorito.update({
    where: { id: favoritoId },
    data: { aulaId: aulaId || null },
  });

  revalidatePath("/vademecum");
}

export async function removeFavorito(id: string) {
  await prisma.vadeMecumFavorito.delete({ where: { id } });
  revalidatePath("/vademecum");
}
