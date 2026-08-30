import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import {
  fromDoc,
  type Disciplina,
  type Professor,
  type Aula,
  type Prova,
  type Nota,
} from "@/lib/firestore";
import {
  createDisciplina,
  updateDisciplina,
  deleteDisciplina,
  createAula,
  gerarQuizDisciplina,
} from "./actions";
import { createProfessor, updateProfessor, deleteProfessor } from "@/app/professores/actions";
import { createProva, updateProva, deleteProva } from "@/app/provas/actions";
import { addNota, updateNota, deleteNota } from "@/app/notas/actions";
import { requireUser } from "@/lib/auth";
import { isIAConfigured } from "@/lib/anthropic";
import { NotificacoesButton } from "@/components/NotificacoesButton";
import { QuizPlayer } from "@/components/QuizPlayer";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function diasRestantes(data: Date) {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffMs = data.getTime() - inicioHoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default async function AcademicoPage({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { abrir } = await searchParams;

  const [disciplinasSnap, professoresSnap, aulasSnap, provasSnap, notasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").orderBy("nome", "asc").get(),
    db.collection("aulas").orderBy("data", "desc").get(),
    db.collection("provas").orderBy("data", "asc").get(),
    db.collection("notas").get(),
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

  const disciplinasBase = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasPorId = new Map(disciplinasBase.map((d) => [d.id, d]));

  const disciplinas = disciplinasBase.map((disciplina) => ({
    ...disciplina,
    professor: disciplina.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null,
    aulas: aulasPorDisciplina.get(disciplina.id) || [],
  }));

  const disciplinasPorProfessor = new Map<string, number>();
  for (const disciplina of disciplinasBase) {
    if (!disciplina.professorId) continue;
    disciplinasPorProfessor.set(
      disciplina.professorId,
      (disciplinasPorProfessor.get(disciplina.professorId) || 0) + 1
    );
  }
  const professoresComContagem = professores.map((professor) => ({
    ...professor,
    totalDisciplinas: disciplinasPorProfessor.get(professor.id) || 0,
  }));

  const provas = provasSnap.docs
    .map((doc) => fromDoc<Prova>(doc))
    .map((prova) => ({
      ...prova,
      disciplina: {
        ...disciplinasPorId.get(prova.disciplinaId)!,
        aulas: aulasPorDisciplina.get(prova.disciplinaId) || [],
      },
    }));

  const notasPorDisciplina = new Map<string, Nota[]>();
  for (const doc of notasSnap.docs) {
    const nota = fromDoc<Nota>(doc);
    notasPorDisciplina.set(nota.disciplinaId, [...(notasPorDisciplina.get(nota.disciplinaId) || []), nota]);
  }
  const disciplinasComNotas = disciplinasBase.map((d) => ({
    ...d,
    notas: notasPorDisciplina.get(d.id) || [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">🎓 Acadêmico</h1>

      {/* ---------- Aulas e disciplinas ---------- */}
      <details className="disclosure card" id="disciplinas" open={abrir === "disciplinas"}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-blue-600/10 text-blue-700 dark:text-blue-400">📝</span>
            Aulas e disciplinas
          </h2>
          <span className="text-xs text-foreground/50 shrink-0">{disciplinas.length} disciplina(s)</span>
        </summary>

        <div className="flex flex-col gap-6 mt-4">
          {isAdmin && (
            <details className="disclosure card">
              <summary className="font-semibold text-sm text-foreground/70">Nova disciplina</summary>
              <form action={createDisciplina} className="flex flex-col gap-3 mt-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input name="nome" placeholder="Nome da disciplina" required className="flex-1 field" />
                  <input name="semestre" placeholder="Semestre (ex: 2026.2)" required className="w-40 field" />
                </div>
                <select name="professorId" className="field" defaultValue="">
                  <option value="">Sem professor vinculado</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <button type="submit" className="self-start btn-primary">
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
              <section key={disciplina.id} id={disciplina.id} className="card flex flex-col gap-4">
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
                      <button type="submit" className="btn-danger-text">
                        Remover
                      </button>
                    </form>
                  )}
                </div>

                {isAdmin && (
                  <details className="disclosure text-sm">
                    <summary className="text-foreground/70 font-medium">Editar disciplina</summary>
                    <form
                      action={updateDisciplina.bind(null, disciplina.id)}
                      className="flex flex-col gap-2 mt-3"
                    >
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input name="nome" defaultValue={disciplina.nome} required className="flex-1 field" />
                        <input
                          name="semestre"
                          defaultValue={disciplina.semestre}
                          required
                          className="w-40 field"
                        />
                      </div>
                      <select name="professorId" defaultValue={disciplina.professorId ?? ""} className="field">
                        <option value="">Sem professor vinculado</option>
                        {professores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="self-start btn-primary">
                        Salvar alterações
                      </button>
                    </form>
                  </details>
                )}

                <details className="disclosure text-sm">
                  <summary className="text-foreground/70 font-medium">+ Nova aula</summary>
                  <form
                    action={createAula.bind(null, disciplina.id)}
                    className="flex flex-col gap-2 mt-3"
                  >
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input name="tema" placeholder="Tema da aula" required className="flex-1 field" />
                      <input
                        name="data"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className="field"
                      />
                    </div>
                    <textarea name="resumo" placeholder="Resumo da aula" rows={2} className="field" />
                    <textarea
                      name="anotacoesLousa"
                      placeholder="Anotações da lousa"
                      rows={2}
                      className="field"
                    />
                    <button type="submit" className="self-start btn-primary">
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

                <details className="disclosure text-sm">
                  <summary className="text-foreground/70 font-medium">🧠 Quiz de revisão</summary>
                  <div className="flex flex-col gap-3 mt-3">
                    {!isIAConfigured() ? (
                      <p className="text-xs text-foreground/50">Recurso de IA ainda não configurado neste app.</p>
                    ) : (
                      <>
                        {disciplina.aulas.some((a) => a.resumo || a.anotacoesLousa) && (
                          <form action={gerarQuizDisciplina.bind(null, disciplina.id)}>
                            <button
                              type="submit"
                              className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
                            >
                              {disciplina.quizIA?.length ? "Gerar outro quiz" : "Gerar quiz de revisão"}
                            </button>
                          </form>
                        )}
                        {disciplina.quizIA?.length ? (
                          <QuizPlayer perguntas={disciplina.quizIA} />
                        ) : (
                          <p className="text-xs text-foreground/50">
                            Junta as anotações de todas as aulas com conteúdo dessa disciplina e gera
                            perguntas de revisão para treinar antes da prova.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </details>
              </section>
            ))}
          </div>
        </div>
      </details>

      {/* ---------- Professores ---------- */}
      <details className="disclosure card" id="professores" open={abrir === "professores"}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-amber-500/10 text-amber-700 dark:text-amber-400">🎓</span>
            Professores
          </h2>
          <span className="text-xs text-foreground/50 shrink-0">{professores.length} professor(es)</span>
        </summary>

        <div className="flex flex-col gap-4 mt-4">
          {isAdmin && (
            <details className="disclosure card">
              <summary className="font-semibold text-sm text-foreground/70">Novo professor</summary>
              <form action={createProfessor} className="flex flex-col gap-3 mt-3">
                <input name="nome" placeholder="Nome" required className="field" />
                <div className="flex gap-3">
                  <input name="email" type="email" placeholder="E-mail (opcional)" className="flex-1 field" />
                  <input name="telefone" placeholder="Telefone (opcional)" className="flex-1 field" />
                </div>
                <button type="submit" className="self-start btn-primary">
                  Adicionar
                </button>
              </form>
            </details>
          )}

          <div className="flex flex-col gap-2">
            {professoresComContagem.length === 0 && (
              <p className="text-sm text-foreground/60">Nenhum professor cadastrado ainda.</p>
            )}
            {professoresComContagem.map((professor) => (
              <div key={professor.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{professor.nome}</p>
                    <p className="text-xs text-foreground/60">
                      {professor.totalDisciplinas} disciplina(s)
                      {professor.email ? ` · ${professor.email}` : ""}
                      {professor.telefone ? ` · ${professor.telefone}` : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <form action={deleteProfessor.bind(null, professor.id)}>
                      <button type="submit" className="btn-danger-text shrink-0">
                        Remover
                      </button>
                    </form>
                  )}
                </div>

                {isAdmin && (
                  <details className="disclosure text-sm">
                    <summary className="text-foreground/70 font-medium">Editar</summary>
                    <form
                      action={updateProfessor.bind(null, professor.id)}
                      className="flex flex-col gap-2 mt-3"
                    >
                      <input name="nome" defaultValue={professor.nome} required className="field" />
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
                      <button type="submit" className="self-start btn-primary">
                        Salvar alterações
                      </button>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* ---------- Provas ---------- */}
      <details className="disclosure card" id="provas" open={abrir === "provas"}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-red-600/10 text-red-700 dark:text-red-400">📅</span>
            Provas
          </h2>
          <span className="text-xs text-foreground/50 shrink-0">{provas.length} marcada(s)</span>
        </summary>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex justify-end">
            <NotificacoesButton />
          </div>

          <details className="disclosure card">
            <summary className="font-semibold text-sm text-foreground/70">Nova prova</summary>
            <form action={createProva} className="flex flex-col gap-3 mt-3">
              {disciplinas.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  Cadastre uma disciplina acima antes de marcar uma prova.
                </p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select name="disciplinaId" required className="flex-1 field" defaultValue="">
                      <option value="" disabled>
                        Selecione a disciplina
                      </option>
                      {disciplinas.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                    <input name="data" type="date" required className="field" />
                  </div>
                  <textarea
                    name="conteudo"
                    placeholder="Anotações sobre o conteúdo da prova (opcional)"
                    rows={2}
                    className="field"
                  />
                  <button type="submit" className="self-start btn-primary">
                    Marcar prova
                  </button>
                </>
              )}
            </form>
          </details>

          <div className="flex flex-col gap-4">
            {provas.length === 0 && <p className="text-sm text-foreground/60">Nenhuma prova marcada ainda.</p>}
            {provas.map((prova) => {
              const dias = diasRestantes(prova.data);
              const aulasComResumo = prova.disciplina.aulas.filter((a) => a.resumo || a.anotacoesLousa);
              return (
                <div key={prova.id} className="card flex flex-col gap-3">
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
                      {dias < 0 ? "já passou" : dias === 0 ? "é hoje!" : `faltam ${dias} dia${dias === 1 ? "" : "s"}`}
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
                        <li key={aula.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                          <p className="font-medium text-xs">{aula.tema}</p>
                          {aula.resumo && (
                            <p className="text-xs text-foreground/60 mt-1 line-clamp-3">{aula.resumo}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>

                  {isIAConfigured() && aulasComResumo.length > 0 && (
                    <Link
                      href={`/aulas?abrir=disciplinas#${prova.disciplinaId}`}
                      className="text-xs text-foreground/60 hover:underline self-start"
                    >
                      🧠 Praticar com quiz de revisão →
                    </Link>
                  )}

                  <details className="disclosure text-sm">
                    <summary className="text-foreground/70 font-medium">Editar</summary>
                    <form action={updateProva.bind(null, prova.id)} className="flex flex-col gap-2 mt-3">
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
                      <button type="submit" className="self-start btn-primary">
                        Salvar alterações
                      </button>
                    </form>
                  </details>

                  <form action={deleteProva.bind(null, prova.id)}>
                    <button type="submit" className="btn-danger-text self-start">
                      Remover
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {/* ---------- Notas ---------- */}
      <details className="disclosure card" id="notas" open={abrir === "notas"}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-purple-600/10 text-purple-700 dark:text-purple-400">📊</span>
            Notas
          </h2>
          <span className="text-xs text-foreground/50 shrink-0">{disciplinasComNotas.length} disciplina(s)</span>
        </summary>

        <div className="flex flex-col gap-4 mt-4">
          {disciplinasComNotas.length === 0 && (
            <p className="text-sm text-foreground/60">
              Cadastre suas disciplinas acima para começar a lançar notas.
            </p>
          )}

          {disciplinasComNotas.map((d) => (
            <div key={d.id} className="card flex flex-col gap-3">
              <p className="font-semibold">{d.nome}</p>
              <div className="flex flex-col gap-2">
                {d.notas.length === 0 && <p className="text-xs text-foreground/50">Nenhuma nota lançada.</p>}
                {d.notas.map((nota) => (
                  <div key={nota.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
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
                      <form action={updateNota.bind(null, nota.id)} className="flex gap-2 mt-2">
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
                <input name="descricao" placeholder="Ex: Prova 1" required className="flex-1 field" />
                <input name="valor" placeholder="Nota" required inputMode="decimal" className="w-24 field" />
                <button type="submit" className="btn-primary">
                  +
                </button>
              </form>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
