import { db } from "@/lib/firebase-admin";
import { fromDoc, type Disciplina, type Nota } from "@/lib/firestore";
import { addNota, updateNota, deleteNota } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const [disciplinasSnap, notasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("notas").get(),
  ]);

  const notasPorDisciplina = new Map<string, Nota[]>();
  for (const doc of notasSnap.docs) {
    const nota = fromDoc<Nota>(doc);
    notasPorDisciplina.set(nota.disciplinaId, [...(notasPorDisciplina.get(nota.disciplinaId) || []), nota]);
  }

  const disciplinas = disciplinasSnap.docs.map((doc) => {
    const disciplina = fromDoc<Disciplina>(doc);
    return { ...disciplina, notas: notasPorDisciplina.get(disciplina.id) || [] };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Notas</h1>

      {disciplinas.length === 0 && (
        <p className="text-sm text-foreground/60">
          Cadastre suas disciplinas na aba Aulas para começar a lançar notas.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {disciplinas.map((d) => (
          <div key={d.id} className="card flex flex-col gap-3">
            <p className="font-semibold">{d.nome}</p>
            <div className="flex flex-col gap-2">
              {d.notas.length === 0 && (
                <p className="text-xs text-foreground/50">Nenhuma nota lançada.</p>
              )}
              {d.notas.map((nota) => (
                <div
                  key={nota.id}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{nota.descricao}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-sm">{nota.valor}</span>
                      <form action={deleteNota.bind(null, nota.id)}>
                        <button type="submit" className="btn-danger-text">
                          remover
                        </button>
                      </form>
                    </div>
                  </div>
                  <details className="disclosure text-xs mt-1">
                    <summary className="text-foreground/60 font-medium">Editar</summary>
                    <form
                      action={updateNota.bind(null, nota.id)}
                      className="flex gap-2 mt-2"
                    >
                      <input
                        name="descricao"
                        defaultValue={nota.descricao}
                        required
                        className="flex-1 field !text-xs !py-1.5"
                      />
                      <input
                        name="valor"
                        defaultValue={nota.valor}
                        required
                        inputMode="decimal"
                        className="w-20 field !text-xs !py-1.5"
                      />
                      <button type="submit" className="btn-primary !text-xs !py-1.5 !px-3">
                        Salvar
                      </button>
                    </form>
                  </details>
                </div>
              ))}
            </div>
            <form action={addNota.bind(null, d.id)} className="flex gap-2">
              <input
                name="descricao"
                placeholder="Ex: Prova 1"
                required
                className="flex-1 field"
              />
              <input
                name="valor"
                placeholder="Nota"
                required
                inputMode="decimal"
                className="w-24 field"
              />
              <button type="submit" className="btn-primary">
                +
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
