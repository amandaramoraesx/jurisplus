import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarCompartilhadasComigo, buscarMinhaAnotacao, podeVerAula } from "@/lib/anotacoes";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ImprimirAulaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) notFound();
  const aula = fromDoc<Aula>(aulaDoc);
  if (!podeVerAula(aula, user.uid)) notFound();

  const [disciplinaDoc, minhaAnotacao, compartilhadasComigo] = await Promise.all([
    db.collection("disciplinas").doc(aula.disciplinaId).get(),
    buscarMinhaAnotacao(id, user.uid),
    buscarCompartilhadasComigo(id, user.uid),
  ]);
  if (!disciplinaDoc.exists) notFound();
  const disciplina = fromDoc<Disciplina>(disciplinaDoc);

  // O caderno do próprio login + o que colegas escolheram compartilhar com ele.
  const resumoIA = minhaAnotacao?.resumoIA ?? null;
  const temConteudo = Boolean(
    minhaAnotacao?.resumo || minhaAnotacao?.anotacoesLousa || resumoIA || compartilhadasComigo.length
  );

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
          {disciplina.nome} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(aula.data)}
        </p>
        <h1 className="text-2xl font-bold mt-1">{aula.tema}</h1>
      </div>

      {minhaAnotacao && (minhaAnotacao.resumo || minhaAnotacao.anotacoesLousa) && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">📝 Minhas anotações</h2>
          {minhaAnotacao.resumo && <p className="text-sm whitespace-pre-wrap">{minhaAnotacao.resumo}</p>}
          {minhaAnotacao.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{minhaAnotacao.anotacoesLousa}</p>
          )}
        </section>
      )}

      {compartilhadasComigo.map((nota) => (
        <section key={nota.id}>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">📥 Compartilhado por {nota.nome}</h2>
          {nota.resumo && <p className="text-sm whitespace-pre-wrap">{nota.resumo}</p>}
          {nota.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{nota.anotacoesLousa}</p>
          )}
        </section>
      ))}

      {resumoIA && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">✨ Resumo inteligente (IA)</h2>
          <p className="text-sm whitespace-pre-wrap">{resumoIA}</p>
        </section>
      )}

      {!temConteudo && (
        <p className="text-sm text-foreground/60">Esta aula ainda não tem conteúdo registrado.</p>
      )}
    </div>
  );
}
