import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateAula, deleteAula } from "../actions";

export const dynamic = "force-dynamic";

export default async function AulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aula = await prisma.aula.findUnique({
    where: { id },
    include: { disciplina: true, favoritosVadeMecum: true },
  });

  if (!aula) notFound();

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
        className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
      >
        <label className="text-xs font-medium text-foreground/60">
          Tema
          <input
            name="tema"
            defaultValue={aula.tema}
            required
            className="mt-1 w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Data
          <input
            name="data"
            type="date"
            defaultValue={aula.data.toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Resumo da aula
          <textarea
            name="resumo"
            defaultValue={aula.resumo ?? ""}
            rows={6}
            placeholder="Escreva aqui o resumo do que foi explicado na aula..."
            className="mt-1 w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60">
          Anotações da lousa
          <textarea
            name="anotacoesLousa"
            defaultValue={aula.anotacoesLousa ?? ""}
            rows={6}
            placeholder="Copie aqui o que o professor escreveu na lousa..."
            className="mt-1 w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
          >
            Salvar
          </button>
        </div>
      </form>

      {aula.favoritosVadeMecum.length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
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
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          Remover esta aula
        </button>
      </form>
    </div>
  );
}
