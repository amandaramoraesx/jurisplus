import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Aula, type Disciplina, type Nota, type Presenca } from "@/lib/firestore";
import { marcarPresenca, addNota, deleteNota } from "./actions";

export const dynamic = "force-dynamic";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function DashboardPage() {
  const hoje = todayDateOnly();

  const [disciplinasSnap, aulasSnap, presencasSnap, notasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("aulas").get(),
    db.collection("presencas").get(),
    db.collection("notas").get(),
  ]);

  const aulas = aulasSnap.docs.map((doc) => fromDoc<Aula>(doc));
  const presencas = presencasSnap.docs.map((doc) => fromDoc<Presenca>(doc));
  const notas = notasSnap.docs.map((doc) => fromDoc<Nota>(doc));

  const aulasPorDisciplina = new Map<string, Aula[]>();
  for (const aula of aulas) {
    aulasPorDisciplina.set(aula.disciplinaId, [...(aulasPorDisciplina.get(aula.disciplinaId) || []), aula]);
  }
  const presencasPorDisciplina = new Map<string, Presenca[]>();
  for (const presenca of presencas) {
    presencasPorDisciplina.set(
      presenca.disciplinaId,
      [...(presencasPorDisciplina.get(presenca.disciplinaId) || []), presenca]
    );
  }
  const notasPorDisciplina = new Map<string, Nota[]>();
  for (const nota of notas) {
    notasPorDisciplina.set(nota.disciplinaId, [...(notasPorDisciplina.get(nota.disciplinaId) || []), nota]);
  }

  const disciplinas = disciplinasSnap.docs.map((doc) => {
    const disciplina = fromDoc<Disciplina>(doc);
    return {
      ...disciplina,
      aulas: aulasPorDisciplina.get(disciplina.id) || [],
      presencas: presencasPorDisciplina.get(disciplina.id) || [],
      notas: notasPorDisciplina.get(disciplina.id) || [],
    };
  });

  const hojeKey = dateOnlyKey(hoje);
  const presencaHojeMap = new Map(
    presencas.filter((p) => dateOnlyKey(p.data) === hojeKey).map((p) => [p.disciplinaId, p.presente])
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Início</h1>
        <p className="text-sm text-foreground/60">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(hoje)}
        </p>
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3">
        <h2 className="font-semibold">Check-in de hoje</h2>
        {disciplinas.length === 0 && (
          <p className="text-sm text-foreground/60">
            Cadastre suas disciplinas na aba Aulas para começar a fazer check-in.
          </p>
        )}
        <div className="flex flex-col gap-2">
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
                    <button
                      type="submit"
                      className={`text-xs rounded-full px-3 py-1 border ${
                        status === true
                          ? "bg-green-600 text-white border-green-600"
                          : "border-black/15 dark:border-white/20 text-foreground/70"
                      }`}
                    >
                      Presente
                    </button>
                  </form>
                  <form action={marcarPresenca.bind(null, disciplina.id, false)}>
                    <button
                      type="submit"
                      className={`text-xs rounded-full px-3 py-1 border ${
                        status === false
                          ? "bg-red-600 text-white border-red-600"
                          : "border-black/15 dark:border-white/20 text-foreground/70"
                      }`}
                    >
                      Faltei
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3">
        <h2 className="font-semibold">Frequência por disciplina</h2>
        {disciplinas.length === 0 ? (
          <p className="text-sm text-foreground/60">Sem disciplinas cadastradas.</p>
        ) : (
          <div className="overflow-x-auto">
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
                      <td className="py-2 px-2">{d.aulas.length}</td>
                      <td className="py-2 px-2">{presentes}</td>
                      <td className="py-2 px-2">{faltas}</td>
                      <td className="py-2 pl-2">{pct === null ? "—" : `${pct}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold px-1">Notas por disciplina</h2>
        {disciplinas.map((d) => (
          <div
            key={d.id}
            className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3"
          >
            <p className="text-sm font-medium">{d.nome}</p>
            <div className="flex flex-col gap-1">
              {d.notas.length === 0 && (
                <p className="text-xs text-foreground/50">Nenhuma nota lançada.</p>
              )}
              {d.notas.map((nota) => (
                <div key={nota.id} className="flex items-center justify-between text-sm">
                  <span>{nota.descricao}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{nota.valor}</span>
                    <form action={deleteNota.bind(null, nota.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        remover
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <form action={addNota.bind(null, d.id)} className="flex gap-2">
              <input
                name="descricao"
                placeholder="Ex: Prova 1"
                required
                className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm"
              />
              <input
                name="valor"
                placeholder="Nota"
                required
                inputMode="decimal"
                className="w-24 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-foreground text-background px-3 py-1.5 text-sm font-medium"
              >
                +
              </button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
