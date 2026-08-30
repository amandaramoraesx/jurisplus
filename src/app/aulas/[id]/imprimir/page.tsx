import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina } from "@/lib/firestore";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ImprimirAulaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) notFound();
  const aula = fromDoc<Aula>(aulaDoc);

  const disciplinaDoc = await db.collection("disciplinas").doc(aula.disciplinaId).get();
  if (!disciplinaDoc.exists) notFound();
  const disciplina = fromDoc<Disciplina>(disciplinaDoc);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/aulas/${aula.id}`} className="text-xs text-foreground/60 hover:underline">
          ← Voltar
        </Link>
        <PrintButton />
      </div>

      <div className="border-b border-black/10 pb-4">
        <p className="text-xs text-foreground/60">
          {disciplina.nome} · {new Intl.DateTimeFormat("pt-BR").format(aula.data)}
        </p>
        <h1 className="text-2xl font-bold mt-1">{aula.tema}</h1>
      </div>

      {aula.resumo && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">Anotações</h2>
          <p className="text-sm whitespace-pre-wrap">{aula.resumo}</p>
        </section>
      )}

      {aula.anotacoesLousa && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">Lousa</h2>
          <p className="text-sm whitespace-pre-wrap font-mono">{aula.anotacoesLousa}</p>
        </section>
      )}

      {aula.resumoIA && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">✨ Resumo inteligente (IA)</h2>
          <p className="text-sm whitespace-pre-wrap">{aula.resumoIA}</p>
        </section>
      )}

      {!aula.resumo && !aula.anotacoesLousa && !aula.resumoIA && (
        <p className="text-sm text-foreground/60">Esta aula ainda não tem conteúdo registrado.</p>
      )}
    </div>
  );
}
