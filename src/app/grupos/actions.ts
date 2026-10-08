"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { garantirDono } from "@/lib/dono";

function splitNomes(raw: string) {
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export async function createGrupo(formData: FormData) {
  const user = await requireUser();
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const apresentacao = String(formData.get("apresentacao") || "").trim();
  const integrantesRaw = String(formData.get("integrantes") || "");

  if (!tema || !dataStr) return;

  await db.collection("grupos").add({
    uid: user.uid,
    tema,
    data: new Date(dataStr),
    disciplinaId: disciplinaId || null,
    apresentacao: apresentacao || null,
    integrantes: splitNomes(integrantesRaw).map((nome) => ({ id: randomUUID(), nome })),
    createdAt: new Date(),
  });

  revalidatePath("/grupos");
}

export async function updateGrupo(grupoId: string, formData: FormData) {
  const user = await requireUser();
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const apresentacao = String(formData.get("apresentacao") || "").trim();

  const doc = await garantirDono("grupos", grupoId, user.uid);
  await doc.ref.update({
    tema,
    ...(dataStr ? { data: new Date(dataStr) } : {}),
    disciplinaId: disciplinaId || null,
    apresentacao: apresentacao || null,
  });

  revalidatePath("/grupos");
}

export async function deleteGrupo(id: string) {
  const user = await requireUser();
  const doc = await garantirDono("grupos", id, user.uid);
  await doc.ref.delete();
  revalidatePath("/grupos");
}

export async function addIntegrante(grupoId: string, formData: FormData) {
  const user = await requireUser();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;

  const ref = db.collection("grupos").doc(grupoId);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (doc.data()?.uid !== user.uid) throw new Error("Esse registro não é seu.");
    const integrantes = (doc.data()?.integrantes as { id: string; nome: string }[]) || [];
    tx.update(ref, { integrantes: [...integrantes, { id: randomUUID(), nome }] });
  });

  revalidatePath("/grupos");
}

export async function removeIntegrante(grupoId: string, integranteId: string) {
  const user = await requireUser();
  const ref = db.collection("grupos").doc(grupoId);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (doc.data()?.uid !== user.uid) throw new Error("Esse registro não é seu.");
    const integrantes = (doc.data()?.integrantes as { id: string; nome: string }[]) || [];
    tx.update(ref, { integrantes: integrantes.filter((i) => i.id !== integranteId) });
  });

  revalidatePath("/grupos");
}
