import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina, type VadeMecumFavorito } from "@/lib/firestore";
import { updateAula, deleteAula, gerarResumoIA } from "../actions";
import { isIAConfigured } from "@/lib/anthropic";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) notFound();
  const aulaBase = fromDoc<Aula>(aulaDoc);

  const [disciplinaDoc, favoritosSnap] = await Promise.all([
    db.collection("disciplinas").doc(aulaBase.disciplinaId).get(),
    db.collection("vademecum_favoritos").where("aulaId", "==", id).get(),
  ]);

  if (!disciplinaDoc.exists) notFound();

  const aula = {
    ...aulaBase,
    disciplina: fromDoc<Disciplina>(disciplinaDoc),
    favoritosVadeMecum: favoritosSnap.docs.map((doc) => fromDoc<VadeMecumFavorito>(doc)),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/aulas#${aula.disciplinaId}`}
          className="text-xs text-foreground/60 hover:underline"
        >
          ← {aula.disciplina.nome}
        </Link>
        <h1 className="text-2xl font-bold mt-1">{aula.tema}</h1>
      </div>

      <form
        action={updateAula.bind(null, aula.id)}
        className="flex flex-col gap-3 card"
      >
        <label className="text-xs font-medium text-foreground/60">
          Tema
          <input
            name="tema"
            defaultValue={aula.tema}
            required
            className="mt-1 w-full field"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Data
          <input
            name="data"
            type="date"
            defaultValue={aula.data.toISOString().slice(0, 10)}
            className="mt-1 w-full field"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Anotações
          <textarea
            name="resumo"
            defaultValue={aula.resumo ?? ""}
            rows={6}
            placeholder="Escreva aqui suas anotações sobre a aula..."
            className="mt-1 w-full field"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Lousa
          <textarea
            name="anotacoesLousa"
            defaultValue={aula.anotacoesLousa ?? ""}
            rows={6}
            placeholder="Copie aqui o que o professor escreveu na lousa..."
            className="mt-1 w-full field font-mono"
          />
        </label>
        <div className="flex gap-3">
          <SubmitButton>Salvar</SubmitButton>
        </div>
      </form>

      {(aula.resumo || aula.anotacoesLousa || aula.resumoIA) && (
        <Link
          href={`/aulas/${aula.id}/imprimir`}
          className="btn-ghost self-start"
        >
          🖨️ Ver resumo e gerar PDF
        </Link>
      )}

      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground/70">
            ✨ Resumo inteligente (IA)
          </h2>
          {isIAConfigured() && (
            <form action={gerarResumoIA.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {aula.resumoIA ? "Gerar novamente" : "Gerar resumo"}
              </button>
            </form>
          )}
        </div>
        {!isIAConfigured() ? (
          <p className="text-xs text-foreground/50">
            Para habilitar, adicione sua chave <code>ANTHROPIC_API_KEY</code> no arquivo{" "}
            <code>.env</code> do projeto.
          </p>
        ) : aula.resumoIA ? (
          <p className="text-sm whitespace-pre-wrap">{aula.resumoIA}</p>
        ) : (
          <p className="text-xs text-foreground/50">
            Preencha as anotações ou a lousa e clique em &ldquo;Gerar
            resumo&rdquo; para ter uma síntese pronta para revisão.
          </p>
        )}
      </div>

      {aula.favoritosVadeMecum.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-sm text-foreground/70 mb-2">
            Artigos vinculados a esta aula
          </h2>
          <ul className="flex flex-col gap-2">
            {aula.favoritosVadeMecum.map((fav) => (
              <li key={fav.id} className="text-sm">
                <span className="font-medium">
                  {fav.codigo}, art. {fav.numero}
                </span>
                <p className="text-foreground/70 text-xs mt-0.5">{fav.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={deleteAula.bind(null, aula.id, aula.disciplinaId)}>
        <button
          type="submit"
          className="btn-danger-text"
        >
          Remover esta aula
        </button>
      </form>
    </div>
  );
}
