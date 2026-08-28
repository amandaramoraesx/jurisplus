"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createPalestra(formData: FormData) {
  const tema = String(formData.get("tema") || "").trim();
  const dataStr = String(formData.get("data") || "");
  const horasStr = String(formData.get("horas") || "").trim();
  const horas = Number(horasStr.replace(",", "."));
  const local = String(formData.get("local") || "").trim();
  const resumo = String(formData.get("resumo") || "").trim();

  if (!tema || !dataStr || Number.isNaN(horas)) return;

  await prisma.palestra.create({
    data: {
      tema,
      data: new Date(dataStr),
      horas,
      local: local || null,
      resumo: resumo || null,
    },
  });

  revalidatePath("/palestras");
}

export async function deletePalestra(id: string) {
  await prisma.palestra.delete({ where: { id } });
  revalidatePath("/palestras");
}
