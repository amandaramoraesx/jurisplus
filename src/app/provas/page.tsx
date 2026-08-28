import { prisma } from "@/lib/prisma";
import { createProva, deleteProva } from "./actions";
import { NotificacoesButton } from "@/components/NotificacoesButton";

export const dynamic = "force-dynamic";

function diasRestantes(data: Date) {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffMs = data.getTime() - inicioHoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function ProvasPage() {
  const [provas, disciplinas] = await Promise.all([
    prisma.prova.findMany({
      orderBy: { data: "asc" },
      include: {
        disciplina: {
          include: { aulas: { orderBy: { data: "desc" } } },
        },
      },
    }),
    prisma.disciplina.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Provas</h1>
        <NotificacoesButton />
      </div>

      <form
        action={createProva}
        className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
      >
        <h2 className="font-semibold text-sm text-foreground/70">Nova prova</h2>
        {disciplinas.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Cadastre uma disciplina na aba Aulas antes de marcar uma prova.
          </p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                name="disciplinaId"
                required
                className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione a disciplina
                </option>
                {disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
              <input
                name="data"
                type="date"
                required
                className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <textarea
              name="conteudo"
              placeholder="Anotações sobre o conteúdo da prova (opcional)"
              rows={2}
              className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
            >
              Marcar prova
            </button>
          </>
        )}
      </form>

      <div className="flex flex-col gap-4">
        {provas.length === 0 && (
          <p className="text-sm text-foreground/60">Nenhuma prova marcada ainda.</p>
        )}
        {provas.map((prova) => {
          const dias = diasRestantes(prova.data);
          const aulasComResumo = prova.disciplina.aulas.filter(
            (a) => a.resumo || a.anotacoesLousa
          );
          return (
            <div
              key={prova.id}
              className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{prova.disciplina.nome}</p>
                  <p className="text-xs text-foreground/60">{formatDate(prova.data)}</p>
                </div>
                <span
                  className={`text-xs rounded-full px-3 py-1 font-medium ${
                    dias < 0
                      ? "bg-black/10 dark:bg-white/10 text-foreground/50"
                      : dias <= 3
                        ? "bg-red-600/10 text-red-600 dark:text-red-400"
                        : dias <= 7
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-green-600/10 text-green-700 dark:text-green-400"
                  }`}
                >
                  {dias < 0
                    ? "já passou"
                    : dias === 0
                      ? "é hoje!"
                      : `faltam ${dias} dia${dias === 1 ? "" : "s"}`}
                </span>
              </div>

              {prova.conteudo && <p className="text-sm">{prova.conteudo}</p>}

              <details className="text-sm">
                <summary className="cursor-pointer text-foreground/70 font-medium">
                  Conteúdo sugerido para estudar ({aulasComResumo.length} aula
                  {aulasComResumo.length === 1 ? "" : "s"} com anotações)
                </summary>
                <ul className="flex flex-col gap-2 mt-2">
                  {aulasComResumo.length === 0 && (
                    <li className="text-xs text-foreground/50">
                      Ainda não há resumos registrados para esta disciplina.
                    </li>
                  )}
                  {aulasComResumo.map((aula) => (
                    <li
                      key={aula.id}
                      className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2"
                    >
                      <p className="font-medium text-xs">{aula.tema}</p>
                      {aula.resumo && (
                        <p className="text-xs text-foreground/60 mt-1 line-clamp-3">
                          {aula.resumo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </details>

              <form action={deleteProva.bind(null, prova.id)}>
                <button
                  type="submit"
                  className="text-xs text-red-600 dark:text-red-400 hover:underline self-start"
                >
                  Remover
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
