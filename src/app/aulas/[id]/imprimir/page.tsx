import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarMinhaAnotacao, buscarNotasCompartilhadas } from "@/lib/anotacoes";
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

  const [disciplinaDoc, minhaAnotacao, notasCompartilhadas] = await Promise.all([
    db.collection("disciplinas").doc(aula.disciplinaId).get(),
    buscarMinhaAnotacao(id, user.uid),
    buscarNotasCompartilhadas(id),
  ]);
  if (!disciplinaDoc.exists) notFound();
  const disciplina = fromDoc<Disciplina>(disciplinaDoc);

  // Só imprime o que a pessoa pode ver: minha anotação (privada ou não) + o que os colegas
  // compartilharam + o que ficou gravado direto na aula antes da separação por login.
  const notasDosColegas = notasCompartilhadas.filter((nota) => nota.uid !== user.uid);
  const temConteudo = Boolean(
    aula.resumo || aula.anotacoesLousa || aula.resumoIA || minhaAnotacao || notasDosColegas.length > 0
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
          {disciplina.nome} · {new Intl.DateTimeFormat("pt-BR").format(aula.data)}
        </p>
        <h1 className="text-2xl font-bold mt-1">{aula.tema}</h1>
      </div>

      {(aula.resumo || aula.anotacoesLousa) && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">
            Anotação (registrada antes de virar por login)
          </h2>
          {aula.resumo && <p className="text-sm whitespace-pre-wrap">{aula.resumo}</p>}
          {aula.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{aula.anotacoesLousa}</p>
          )}
        </section>
      )}

      {minhaAnotacao && (minhaAnotacao.resumo || minhaAnotacao.anotacoesLousa) && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">📝 Minhas anotações</h2>
          {minhaAnotacao.resumo && <p className="text-sm whitespace-pre-wrap">{minhaAnotacao.resumo}</p>}
          {minhaAnotacao.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{minhaAnotacao.anotacoesLousa}</p>
          )}
        </section>
      )}

      {notasDosColegas.map((nota) => (
        <section key={nota.id}>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">🌐 {nota.nome}</h2>
          {nota.resumo && <p className="text-sm whitespace-pre-wrap">{nota.resumo}</p>}
          {nota.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{nota.anotacoesLousa}</p>
          )}
        </section>
      ))}

      {aula.resumoIA && (
        <section>
          <h2 className="text-sm font-semibold text-foreground/70 mb-1">✨ Resumo inteligente (IA)</h2>
          <p className="text-sm whitespace-pre-wrap">{aula.resumoIA}</p>
        </section>
      )}

      {!temConteudo && (
        <p className="text-sm text-foreground/60">Esta aula ainda não tem conteúdo registrado.</p>
      )}
    </div>
  );
}
