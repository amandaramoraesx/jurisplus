import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Disciplina, type Professor, type Aula } from "@/lib/firestore";
import { createDisciplina, updateDisciplina, deleteDisciplina, createAula } from "./actions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function AulasPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const [disciplinasSnap, professoresSnap, aulasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").orderBy("nome", "asc").get(),
    db.collection("aulas").orderBy("data", "desc").get(),
  ]);

  const professores = professoresSnap.docs.map((doc) => fromDoc<Professor>(doc));
  const professoresPorId = new Map(professores.map((p) => [p.id, p]));

  const aulasPorDisciplina = new Map<string, Aula[]>();
  for (const doc of aulasSnap.docs) {
    const aula = fromDoc<Aula>(doc);
    const lista = aulasPorDisciplina.get(aula.disciplinaId) || [];
    lista.push(aula);
    aulasPorDisciplina.set(aula.disciplinaId, lista);
  }

  const disciplinas = disciplinasSnap.docs.map((doc) => {
    const disciplina = fromDoc<Disciplina>(doc);
    return {
      ...disciplina,
      professor: disciplina.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null,
      aulas: aulasPorDisciplina.get(disciplina.id) || [],
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Aulas</h1>

      {isAdmin && (
        <details className="disclosure card">
          <summary className="font-semibold text-sm text-foreground/70">Nova disciplina</summary>
          <form
            action={createDisciplina}
            className="flex flex-col gap-3 mt-3"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                name="nome"
                placeholder="Nome da disciplina"
                required
                className="flex-1 field"
              />
              <input
                name="semestre"
                placeholder="Semestre (ex: 2026.2)"
                required
                className="w-40 field"
              />
            </div>
            <select
              name="professorId"
              className="field"
              defaultValue=""
            >
              <option value="">Sem professor vinculado</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="self-start btn-primary"
            >
              Criar disciplina
            </button>
          </form>
        </details>
      )}

      <div className="flex flex-col gap-8">
        {disciplinas.length === 0 && (
          <p className="text-sm text-foreground/60">
            Nenhuma disciplina cadastrada ainda. Crie uma acima para começar a registrar aulas.
          </p>
        )}

        {disciplinas.map((disciplina) => (
          <section
            key={disciplina.id}
            id={disciplina.id}
            className="card flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{disciplina.nome}</h3>
                <p className="text-xs text-foreground/60">
                  {disciplina.semestre}
                  {disciplina.professor ? ` · ${disciplina.professor.nome}` : ""}
                </p>
              </div>
              {isAdmin && (
                <form action={deleteDisciplina.bind(null, disciplina.id)}>
                  <button
                    type="submit"
                    className="btn-danger-text"
                  >
                    Remover
                  </button>
                </form>
              )}
            </div>

            {isAdmin && (
              <details className="disclosure text-sm">
                <summary className="text-foreground/70 font-medium">
                  Editar disciplina
                </summary>
                <form
                  action={updateDisciplina.bind(null, disciplina.id)}
                  className="flex flex-col gap-2 mt-3"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      name="nome"
                      defaultValue={disciplina.nome}
                      required
                      className="flex-1 field"
                    />
                    <input
                      name="semestre"
                      defaultValue={disciplina.semestre}
                      required
                      className="w-40 field"
                    />
                  </div>
                  <select
                    name="professorId"
                    defaultValue={disciplina.professorId ?? ""}
                    className="field"
                  >
                    <option value="">Sem professor vinculado</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="self-start btn-primary"
                  >
                    Salvar alterações
                  </button>
                </form>
              </details>
            )}

            <details className="disclosure text-sm">
              <summary className="text-foreground/70 font-medium">
                + Nova aula
              </summary>
              <form
                action={createAula.bind(null, disciplina.id)}
                className="flex flex-col gap-2 mt-3"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    name="tema"
                    placeholder="Tema da aula"
                    required
                    className="flex-1 field"
                  />
                  <input
                    name="data"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="field"
                  />
                </div>
                <textarea
                  name="resumo"
                  placeholder="Resumo da aula"
                  rows={2}
                  className="field"
                />
                <textarea
                  name="anotacoesLousa"
                  placeholder="Anotações da lousa"
                  rows={2}
                  className="field"
                />
                <button
                  type="submit"
                  className="self-start btn-primary"
                >
                  Salvar aula
                </button>
              </form>
            </details>

            <div className="flex flex-col gap-2">
              {disciplina.aulas.length === 0 && (
                <p className="text-xs text-foreground/50">Nenhuma aula registrada ainda.</p>
              )}
              {disciplina.aulas.map((aula) => (
                <Link
                  key={aula.id}
                  href={`/aulas/${aula.id}`}
                  className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/[.03] dark:hover:bg-white/[.05]"
                >
                  <span>{aula.tema}</span>
                  <span className="text-xs text-foreground/50">{formatDate(aula.data)}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
