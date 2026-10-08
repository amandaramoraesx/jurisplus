import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarCompartilhadasComigo, buscarMinhaAnotacao, podeVerAula } from "@/lib/anotacoes";
import { gerarPdfAula, nomeArquivoPdf, type SecaoPdf } from "@/lib/aula-pdf";

/** PDF da aula pro botão "Compartilhar": o caderno de quem pediu + o que colegas compartilharam com ele. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  const aula = fromDoc<Aula>(aulaDoc);
  if (!podeVerAula(aula, user.uid)) {
    return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  }

  const [disciplinaDoc, minhaAnotacao, compartilhadasComigo] = await Promise.all([
    db.collection("disciplinas").doc(aula.disciplinaId).get(),
    buscarMinhaAnotacao(id, user.uid),
    buscarCompartilhadasComigo(id, user.uid),
  ]);
  const disciplina = disciplinaDoc.exists ? fromDoc<Disciplina>(disciplinaDoc).nome : "Disciplina";

  const secoes: SecaoPdf[] = [];
  if (minhaAnotacao && (minhaAnotacao.resumo || minhaAnotacao.anotacoesLousa)) {
    secoes.push({
      titulo: `Anotações de ${minhaAnotacao.nome}`,
      resumo: minhaAnotacao.resumo,
      lousa: minhaAnotacao.anotacoesLousa,
    });
  }
  for (const nota of compartilhadasComigo) {
    secoes.push({ titulo: `Compartilhado por ${nota.nome}`, resumo: nota.resumo, lousa: nota.anotacoesLousa });
  }
  if (minhaAnotacao?.resumoIA) {
    secoes.push({ titulo: "Resumo inteligente (IA)", resumo: minhaAnotacao.resumoIA });
  }

  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(aula.data);
  const pdf = await gerarPdfAula({ disciplina, data, tema: aula.tema, secoes });
  const nome = nomeArquivoPdf(disciplina, aula.tema, data);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
