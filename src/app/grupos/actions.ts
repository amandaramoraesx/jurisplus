"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function splitNomes(raw: string) {
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export async function createGrupo(formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const apresentacao = String(formData.get("apresentacao") || "").trim();
  const integrantesRaw = String(formData.get("integrantes") || "");

  if (!tema || !dataStr) return;

  await prisma.grupoTrabalho.create({
    data: {
      tema,
      data: new Date(dataStr),
      disciplinaId: disciplinaId || null,
      apresentacao: apresentacao || null,
      integrantes: {
        create: splitNomes(integrantesRaw).map((nome) => ({ nome })),
      },
    },
  });

  revalidatePath("/grupos");
}

export async function updateGrupo(grupoId: string, formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const disciplinaId = String(formData.get("disciplinaId") || "").trim();
  const apresentacao = String(formData.get("apresentacao") || "").trim();

  await prisma.grupoTrabalho.update({
    where: { id: grupoId },
    data: {
      tema,
      data: dataStr ? new Date(dataStr) : undefined,
      disciplinaId: disciplinaId || null,
      apresentacao: apresentacao || null,
    },
  });

  revalidatePath("/grupos");
}

export async function deleteGrupo(id: string) {
  await prisma.grupoTrabalho.delete({ where: { id } });
  revalidatePath("/grupos");
}

export async function addIntegrante(grupoId: string, formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;

  await prisma.integranteGrupo.create({ data: { grupoId, nome } });
  revalidatePath("/grupos");
}

export async function removeIntegrante(id: string) {
  await prisma.integranteGrupo.delete({ where: { id } });
  revalidatePath("/grupos");
}
