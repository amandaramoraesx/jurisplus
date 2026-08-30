import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Disciplina, type Presenca, type Professor } from "@/lib/firestore";
import { marcarPresenca, marcarTodasPresentes, anotarRapido } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function DashboardPage() {
  const hoje = todayDateOnly();
  const hojeKey = dateOnlyKey(hoje);

  const [disciplinasSnap, professoresSnap, aulasSnap, presencasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").get(),
    db.collection("aulas").get(),
    db.collection("presencas").get(),
  ]);

  const professoresPorId = new Map(
    professoresSnap.docs.map((doc) => [doc.id, fromDoc<Professor>(doc)])
  );

  const aulasPorDisciplina = new Map<string, number>();
  for (const doc of aulasSnap.docs) {
    const disciplinaId = doc.data().disciplinaId as string;
    aulasPorDisciplina.set(disciplinaId, (aulasPorDisciplina.get(disciplinaId) || 0) + 1);
  }

  // aula "de hoje" de cada disciplina, gravada com id determinístico pela anotação rápida
  const anotacaoHojePorDisciplina = new Map<string, { resumo: string; anotacoesLousa: string }>();
  for (const doc of aulasSnap.docs) {
    const disciplinaId = doc.data().disciplinaId as string;
    if (doc.id === `${disciplinaId}_${hojeKey}`) {
      anotacaoHojePorDisciplina.set(disciplinaId, {
        resumo: (doc.data().resumo as string) || "",
        anotacoesLousa: (doc.data().anotacoesLousa as string) || "",
      });
    }
  }

  const presencas = presencasSnap.docs.map((doc) => fromDoc<Presenca>(doc));
  const presencasPorDisciplina = new Map<string, Presenca[]>();
  for (const presenca of presencas) {
    presencasPorDisciplina.set(
      presenca.disciplinaId,
      [...(presencasPorDisciplina.get(presenca.disciplinaId) || []), presenca]
    );
  }

  const disciplinas = disciplinasSnap.docs.map((doc) => {
    const disciplina = fromDoc<Disciplina>(doc);
    return {
      ...disciplina,
      professor: disciplina.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null,
      totalAulas: aulasPorDisciplina.get(disciplina.id) || 0,
      presencas: presencasPorDisciplina.get(disciplina.id) || [],
      anotacaoHoje: anotacaoHojePorDisciplina.get(disciplina.id) || { resumo: "", anotacoesLousa: "" },
    };
  });

  const presencaHojeMap = new Map(
    presencas.filter((p) => dateOnlyKey(p.data) === hojeKey).map((p) => [p.disciplinaId, p.presente])
  );
  const checkinsFeitos = disciplinas.filter((d) => presencaHojeMap.has(d.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Início</h1>
        <p className="text-sm text-foreground/60">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(hoje)}
        </p>
      </div>

      <section className="card flex flex-col gap-3">
        {disciplinas.length === 0 ? (
          <div>
            <h2 className="font-semibold">Check-in de hoje</h2>
            <p className="text-sm text-foreground/60 mt-2">
              Cadastre suas disciplinas na aba Aulas para começar a fazer check-in.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Check-in de hoje</h2>
                <p className="text-xs text-foreground/60 mt-0.5">
                  {checkinsFeitos} de {disciplinas.length} disciplina(s) já registrada(s)
                </p>
              </div>
              <form action={marcarTodasPresentes}>
                <SubmitButton savedLabel="Check-in feito!" pendingLabel="Marcando...">
                  Fazer check-in
                </SubmitButton>
              </form>
            </div>

            <details className="disclosure">
              <summary className="btn-ghost inline-block">Corrigir uma disciplina específica</summary>
              <div className="flex flex-col gap-2 mt-3">
                {disciplinas.map((disciplina) => {
                  const status = presencaHojeMap.get(disciplina.id);
                  return (
                    <div
                      key={disciplina.id}
                      className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{disciplina.nome}</span>
                      <div className="flex gap-2">
                        <form action={marcarPresenca.bind(null, disciplina.id, true)}>
                          <SubmitButton
                            pendingLabel="..."
                            savedLabel="Presente"
                            className={`text-xs rounded-full px-3 py-1 border ${
                              status === true
                                ? "bg-green-600 text-white border-green-600"
                                : "border-black/15 dark:border-white/20 text-foreground/70"
                            }`}
                          >
                            Presente
                          </SubmitButton>
                        </form>
                        <form action={marcarPresenca.bind(null, disciplina.id, false)}>
                          <SubmitButton
                            pendingLabel="..."
                            savedLabel="Faltei"
                            className={`text-xs rounded-full px-3 py-1 border ${
                              status === false
                                ? "bg-red-600 text-white border-red-600"
                                : "border-black/15 dark:border-white/20 text-foreground/70"
                            }`}
                          >
                            Faltei
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        )}
      </section>

      {disciplinas.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Anotar aula</h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              Clique na matéria e escreva — fica salvo direto na aula de hoje.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {disciplinas.map((disciplina) => (
              <details key={disciplina.id} className="disclosure">
                <summary className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium flex items-center justify-between gap-2">
                  <span>
                    {disciplina.nome}
                    {disciplina.professor ? (
                      <span className="text-foreground/50 font-normal"> · {disciplina.professor.nome}</span>
                    ) : null}
                  </span>
                  {(disciplina.anotacaoHoje.resumo || disciplina.anotacaoHoje.anotacoesLousa) && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
                      já tem anotação hoje
                    </span>
                  )}
                </summary>
                <form
                  action={anotarRapido.bind(null, disciplina.id)}
                  className="flex flex-col gap-3 mt-2"
                >
                  <label className="text-xs font-medium text-foreground/60 flex flex-col gap-1">
                    Anotações
                    <textarea
                      name="resumo"
                      defaultValue={disciplina.anotacaoHoje.resumo}
                      rows={4}
                      placeholder="Suas anotações sobre a aula..."
                      className="field"
                    />
                  </label>
                  <label className="text-xs font-medium text-foreground/60 flex flex-col gap-1">
                    Lousa
                    <textarea
                      name="anotacoesLousa"
                      defaultValue={disciplina.anotacaoHoje.anotacoesLousa}
                      rows={4}
                      placeholder="O que o professor escreveu na lousa..."
                      className="field font-mono"
                    />
                  </label>
                  <SubmitButton savedLabel="Anotação salva!" pendingLabel="Salvando..." className="self-start btn-primary">
                    Salvar anotação
                  </SubmitButton>
                </form>
              </details>
            ))}
          </div>
        </section>
      )}

      {disciplinas.length > 0 && (
        <section className="card">
          <details className="disclosure">
            <summary className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Frequência por disciplina</h2>
              <span className="btn-ghost shrink-0">Ver</span>
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground/50">
                    <th className="py-1 pr-2">Disciplina</th>
                    <th className="py-1 px-2">Aulas</th>
                    <th className="py-1 px-2">Presenças</th>
                    <th className="py-1 px-2">Faltas</th>
                    <th className="py-1 pl-2">Frequência</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplinas.map((d) => {
                    const presentes = d.presencas.filter((p) => p.presente).length;
                    const faltas = d.presencas.filter((p) => !p.presente).length;
                    const total = presentes + faltas;
                    const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
                    return (
                      <tr key={d.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="py-2 pr-2">{d.nome}</td>
                        <td className="py-2 px-2">{d.totalAulas}</td>
                        <td className="py-2 px-2">{presentes}</td>
                        <td className="py-2 px-2">{faltas}</td>
                        <td className="py-2 pl-2">{pct === null ? "—" : `${pct}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
