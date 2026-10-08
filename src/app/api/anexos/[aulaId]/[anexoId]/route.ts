import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth";
import { buscarMinhaAnotacao } from "@/lib/anotacoes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ aulaId: string; anexoId: string }> }
) {
  const user = await requireUser();

  // Anexo é pessoal: só procura no caderno de quem está pedindo.
  const { aulaId, anexoId } = await params;
  const caderno = await buscarMinhaAnotacao(aulaId, user.uid);
  const anexo = caderno?.anexos?.find((a) => a.id === anexoId);
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
