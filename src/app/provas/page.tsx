import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina, type Prova } from "@/lib/firestore";
import { createProva, updateProva, deleteProva } from "./actions";
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
  const [provasSnap, disciplinasSnap, aulasSnap] = await Promise.all([
    db.collection("provas").orderBy("data", "asc").get(),
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("aulas").orderBy("data", "desc").get(),
  ]);

  const disciplinas = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasPorId = new Map(disciplinas.map((d) => [d.id, d]));

  const aulasPorDisciplina = new Map<string, Aula[]>();
  for (const doc of aulasSnap.docs) {
    const aula = fromDoc<Aula>(doc);
    aulasPorDisciplina.set(aula.disciplinaId, [...(aulasPorDisciplina.get(aula.disciplinaId) || []), aula]);
  }

  const provas = provasSnap.docs
    .map((doc) => fromDoc<Prova>(doc))
    .map((prova) => ({
      ...prova,
      disciplina: {
        ...disciplinasPorId.get(prova.disciplinaId)!,
        aulas: aulasPorDisciplina.get(prova.disciplinaId) || [],
      },
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Provas</h1>
        <NotificacoesButton />
      </div>

      <form
        action={createProva}
        className="flex flex-col gap-3 card"
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
                className="flex-1 field"
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
                className="field"
              />
            </div>
            <textarea
              name="conteudo"
              placeholder="Anotações sobre o conteúdo da prova (opcional)"
              rows={2}
              className="field"
            />
            <button
              type="submit"
              className="self-start btn-primary"
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
              className="card flex flex-col gap-3"
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

              <details className="disclosure text-sm">
                <summary className="text-foreground/70 font-medium">
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

              <details className="disclosure text-sm">
                <summary className="text-foreground/70 font-medium">
                  Editar
                </summary>
                <form
                  action={updateProva.bind(null, prova.id)}
                  className="flex flex-col gap-2 mt-3"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      name="disciplinaId"
                      required
                      defaultValue={prova.disciplinaId}
                      className="flex-1 field"
                    >
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
                      defaultValue={prova.data.toISOString().slice(0, 10)}
                      className="field"
                    />
                  </div>
                  <textarea
                    name="conteudo"
                    placeholder="Anotações sobre o conteúdo da prova (opcional)"
                    rows={2}
                    defaultValue={prova.conteudo ?? ""}
                    className="field"
                  />
                  <button
                    type="submit"
                    className="self-start btn-primary"
                  >
                    Salvar alterações
                  </button>
                </form>
              </details>

              <form action={deleteProva.bind(null, prova.id)}>
                <button
                  type="submit"
                  className="btn-danger-text self-start"
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
