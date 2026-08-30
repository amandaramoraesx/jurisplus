import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Aula, type Disciplina, type Professor } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; professorId?: string }>;
}) {
  await requireUser();
  const { data: dataSelecionada, professorId: professorIdSelecionado } = await searchParams;

  const [aulasSnap, disciplinasSnap, professoresSnap] = await Promise.all([
    db.collection("aulas").orderBy("data", "desc").get(),
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").orderBy("nome", "asc").get(),
  ]);

  const disciplinas = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasPorId = new Map(disciplinas.map((d) => [d.id, d]));
  const professores = professoresSnap.docs.map((doc) => fromDoc<Professor>(doc));
  const professoresPorId = new Map(professores.map((p) => [p.id, p]));

  const aulasComConteudo = aulasSnap.docs
    .map((doc) => fromDoc<Aula>(doc))
    .filter((aula) => aula.resumo || aula.anotacoesLousa)
    .map((aula) => {
      const disciplina = disciplinasPorId.get(aula.disciplinaId) ?? null;
      const professor = disciplina?.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null;
      return { ...aula, disciplina, professor };
    });

  const aulasDoDia = dataSelecionada
    ? aulasComConteudo.filter((aula) => dateOnlyKey(aula.data) === dataSelecionada)
    : [];

  const aulasDoProfessor = professorIdSelecionado
    ? aulasComConteudo.filter((aula) => aula.professor?.id === professorIdSelecionado)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de anotações</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Busque as anotações e lousas já registradas por data ou por professor.
        </p>
      </div>

      <details className="disclosure card" open={Boolean(dataSelecionada)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">🗓️ Por data</h2>
        </summary>
        <div className="flex flex-col gap-4 mt-4">
          <form method="GET" className="flex flex-col sm:flex-row gap-2">
            <input
              name="data"
              type="date"
              required
              defaultValue={dataSelecionada || ""}
              className="field"
            />
            <button type="submit" className="self-start btn-primary">
              Ver anotações do dia
            </button>
          </form>

          {dataSelecionada && (
            <div className="flex flex-col gap-3">
              {aulasDoDia.length === 0 && (
                <p className="text-sm text-foreground/60">
                  Nenhuma anotação registrada em {formatDate(new Date(`${dataSelecionada}T00:00:00`))}.
                </p>
              )}
              {aulasDoDia.map((aula) => (
                <div key={aula.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{aula.disciplina?.nome ?? "Disciplina removida"}</p>
                    <span className="text-xs text-foreground/50 shrink-0">
                      {aula.professor ? aula.professor.nome : "sem professor"}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/60 mt-0.5">{aula.tema}</p>
                  {aula.resumo && <p className="text-sm mt-2 whitespace-pre-wrap">{aula.resumo}</p>}
                  {aula.anotacoesLousa && (
                    <p className="text-sm mt-2 whitespace-pre-wrap font-mono">{aula.anotacoesLousa}</p>
                  )}
                  <Link href={`/aulas/${aula.id}`} className="text-xs text-foreground/60 hover:underline mt-2 inline-block">
                    Ver aula e gerar PDF →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="disclosure card" open={Boolean(professorIdSelecionado)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">🎓 Por professor</h2>
        </summary>
        <div className="flex flex-col gap-4 mt-4">
          {professores.length === 0 ? (
            <p className="text-sm text-foreground/60">Nenhum professor cadastrado ainda.</p>
          ) : (
            <form method="GET" className="flex flex-col sm:flex-row gap-2">
              <select
                name="professorId"
                required
                defaultValue={professorIdSelecionado || ""}
                className="flex-1 field"
              >
                <option value="" disabled>
                  Selecione o professor
                </option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <button type="submit" className="self-start btn-primary">
                Ver anotações
              </button>
            </form>
          )}

          {professorIdSelecionado && (
            <div className="flex flex-col gap-3">
              {aulasDoProfessor.length === 0 && (
                <p className="text-sm text-foreground/60">
                  Nenhuma anotação registrada para{" "}
                  {professoresPorId.get(professorIdSelecionado)?.nome ?? "esse professor"} ainda.
                </p>
              )}
              {aulasDoProfessor.map((aula) => (
                <div key={aula.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{aula.disciplina?.nome ?? "Disciplina removida"}</p>
                    <span className="text-xs text-foreground/50 shrink-0">{formatDate(aula.data)}</span>
                  </div>
                  <p className="text-xs text-foreground/60 mt-0.5">{aula.tema}</p>
                  {aula.resumo && <p className="text-sm mt-2 whitespace-pre-wrap">{aula.resumo}</p>}
                  {aula.anotacoesLousa && (
                    <p className="text-sm mt-2 whitespace-pre-wrap font-mono">{aula.anotacoesLousa}</p>
                  )}
                  <Link href={`/aulas/${aula.id}`} className="text-xs text-foreground/60 hover:underline mt-2 inline-block">
                    Ver aula e gerar PDF →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
