import { db } from "@/lib/firebase-admin";
import { fromDoc, type Disciplina, type Grupo } from "@/lib/firestore";
import {
  createGrupo,
  updateGrupo,
  deleteGrupo,
  addIntegrante,
  removeIntegrante,
} from "./actions";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function GruposPage() {
  const [gruposSnap, disciplinasSnap] = await Promise.all([
    db.collection("grupos").orderBy("data", "desc").get(),
    db.collection("disciplinas").orderBy("nome", "asc").get(),
  ]);

  const disciplinas = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasPorId = new Map(disciplinas.map((d) => [d.id, d]));

  const grupos = gruposSnap.docs.map((doc) => {
    const grupo = fromDoc<Grupo>(doc);
    return {
      ...grupo,
      disciplina: grupo.disciplinaId ? disciplinasPorId.get(grupo.disciplinaId) ?? null : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Trabalhos em grupo</h1>

      <form
        action={createGrupo}
        className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
      >
        <h2 className="font-semibold text-sm text-foreground/70">Novo trabalho</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            name="tema"
            placeholder="Tema do trabalho"
            required
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="data"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <select
          name="disciplinaId"
          defaultValue=""
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Sem disciplina vinculada</option>
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>
        <input
          name="integrantes"
          placeholder="Integrantes, separados por vírgula"
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <textarea
          name="apresentacao"
          placeholder="O que vamos apresentar"
          rows={2}
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          Criar grupo
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {grupos.length === 0 && (
          <p className="text-sm text-foreground/60">Nenhum trabalho em grupo cadastrado ainda.</p>
        )}
        {grupos.map((grupo) => (
          <div
            key={grupo.id}
            className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{grupo.tema}</p>
                <p className="text-xs text-foreground/60">
                  {formatDate(grupo.data)}
                  {grupo.disciplina ? ` · ${grupo.disciplina.nome}` : ""}
                </p>
              </div>
              <form action={deleteGrupo.bind(null, grupo.id)}>
                <button
                  type="submit"
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Remover
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2">
              {grupo.integrantes.map((integrante) => (
                <span
                  key={integrante.id}
                  className="flex items-center gap-1 text-xs rounded-full border border-black/15 dark:border-white/15 pl-3 pr-1 py-1"
                >
                  {integrante.nome}
                  <form action={removeIntegrante.bind(null, grupo.id, integrante.id)}>
                    <button
                      type="submit"
                      aria-label={`Remover ${integrante.nome}`}
                      className="text-foreground/40 hover:text-red-600 dark:hover:text-red-400 px-1"
                    >
                      ×
                    </button>
                  </form>
                </span>
              ))}
              <form action={addIntegrante.bind(null, grupo.id)} className="flex gap-1">
                <input
                  name="nome"
                  placeholder="+ integrante"
                  className="w-28 rounded-full border border-black/15 dark:border-white/15 bg-transparent px-3 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="text-xs rounded-full border border-black/15 dark:border-white/15 px-2 py-1"
                >
                  add
                </button>
              </form>
            </div>

            {grupo.apresentacao && <p className="text-sm">{grupo.apresentacao}</p>}

            <details className="text-sm">
              <summary className="cursor-pointer text-foreground/70 font-medium">
                Editar trabalho
              </summary>
              <form
                action={updateGrupo.bind(null, grupo.id)}
                className="flex flex-col gap-2 mt-3"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    name="tema"
                    defaultValue={grupo.tema}
                    className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
                  />
                  <input
                    name="data"
                    type="date"
                    defaultValue={grupo.data.toISOString().slice(0, 10)}
                    className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <select
                  name="disciplinaId"
                  defaultValue={grupo.disciplinaId ?? ""}
                  className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">Sem disciplina vinculada</option>
                  {disciplinas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
                <textarea
                  name="apresentacao"
                  defaultValue={grupo.apresentacao ?? ""}
                  rows={2}
                  className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
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
