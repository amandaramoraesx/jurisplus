import { db } from "@/lib/firebase-admin";
import { fromDoc, type Professor, type Disciplina } from "@/lib/firestore";
import { createProfessor, updateProfessor, deleteProfessor } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage() {
  const [professoresSnap, disciplinasSnap] = await Promise.all([
    db.collection("professores").orderBy("nome", "asc").get(),
    db.collection("disciplinas").get(),
  ]);

  const disciplinasPorProfessor = new Map<string, number>();
  for (const doc of disciplinasSnap.docs) {
    const disciplina = fromDoc<Disciplina>(doc);
    if (!disciplina.professorId) continue;
    disciplinasPorProfessor.set(
      disciplina.professorId,
      (disciplinasPorProfessor.get(disciplina.professorId) || 0) + 1
    );
  }

  const professores = professoresSnap.docs
    .map((doc) => fromDoc<Professor>(doc))
    .map((professor) => ({
      ...professor,
      totalDisciplinas: disciplinasPorProfessor.get(professor.id) || 0,
    }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Professores</h1>

      <form
        action={createProfessor}
        className="flex flex-col gap-3 card"
      >
        <h2 className="font-semibold text-sm text-foreground/70">Novo professor</h2>
        <input
          name="nome"
          placeholder="Nome"
          required
          className="field"
        />
        <div className="flex gap-3">
          <input
            name="email"
            type="email"
            placeholder="E-mail (opcional)"
            className="flex-1 field"
          />
          <input
            name="telefone"
            placeholder="Telefone (opcional)"
            className="flex-1 field"
          />
        </div>
        <button
          type="submit"
          className="self-start btn-primary"
        >
          Adicionar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {professores.length === 0 && (
          <p className="text-sm text-foreground/60">Nenhum professor cadastrado ainda.</p>
        )}
        {professores.map((professor) => (
          <div
            key={professor.id}
            className="card flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{professor.nome}</p>
                <p className="text-xs text-foreground/60">
                  {professor.totalDisciplinas} disciplina(s)
                  {professor.email ? ` · ${professor.email}` : ""}
                  {professor.telefone ? ` · ${professor.telefone}` : ""}
                </p>
              </div>
              <form action={deleteProfessor.bind(null, professor.id)}>
                <button
                  type="submit"
                  className="btn-danger-text shrink-0"
                >
                  Remover
                </button>
              </form>
            </div>

            <details className="disclosure text-sm">
              <summary className="text-foreground/70 font-medium">
                Editar
              </summary>
              <form
                action={updateProfessor.bind(null, professor.id)}
                className="flex flex-col gap-2 mt-3"
              >
                <input
                  name="nome"
                  defaultValue={professor.nome}
                  required
                  className="field"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    name="email"
                    type="email"
                    defaultValue={professor.email ?? ""}
                    placeholder="E-mail (opcional)"
                    className="flex-1 field"
                  />
                  <input
                    name="telefone"
                    defaultValue={professor.telefone ?? ""}
                    placeholder="Telefone (opcional)"
                    className="flex-1 field"
                  />
                </div>
                <button
                  type="submit"
                  className="self-start btn-primary"
                >
                  Salvar alterações
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
