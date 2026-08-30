import { db } from "@/lib/firebase-admin";
import { fromDoc, type Professor, type Disciplina } from "@/lib/firestore";
import { createProfessor, deleteProfessor } from "./actions";

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
        className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
      >
        <h2 className="font-semibold text-sm text-foreground/70">Novo professor</h2>
        <input
          name="nome"
          placeholder="Nome"
          required
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            name="email"
            type="email"
            placeholder="E-mail (opcional)"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="telefone"
            placeholder="Telefone (opcional)"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
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
            className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 p-4"
          >
            <div>
              <p className="font-medium">{professor.nome}</p>
              <p className="text-xs text-foreground/60">
                {professor.totalDisciplinas} disciplina(s)
                {professor.email ? ` · ${professor.email}` : ""}
              </p>
            </div>
            <form action={deleteProfessor.bind(null, professor.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Remover
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
