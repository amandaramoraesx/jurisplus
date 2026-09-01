import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth";
import type { Anexo } from "@/lib/firestore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ aulaId: string; anexoId: string }> }
) {
  await requireUser();

  const { aulaId, anexoId } = await params;
  const aulaDoc = await db.collection("aulas").doc(aulaId).get();
  const anexo = (aulaDoc.data()?.anexos as Anexo[] | undefined)?.find((a) => a.id === anexoId);
  if (!anexo) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const [buffer] = await storage.bucket().file(anexo.storagePath).download();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": anexo.tipo || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(anexo.nome)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
