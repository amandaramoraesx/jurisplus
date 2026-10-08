import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import {
  fromDoc,
  type Disciplina,
  type Professor,
  type Aula,
  type Prova,
  type Nota,
  type Presenca,
  type QuizPergunta,
  DIAS_SEMANA_ABREV,
  hojeNoBrasil,
  dateOnlyKey,
} from "@/lib/firestore";
import { DataSelo } from "@/components/DataSelo";
import { AbrirPorHash } from "@/components/AbrirPorHash";
import {
  createDisciplina,
  updateDisciplina,
  arquivarDisciplina,
  restaurarDisciplina,
  excluirDisciplinaPermanentemente,
  createAula,
  registrarPresenca,
  removerPresenca,
  gerarQuizDisciplina,
} from "./actions";
import { createProfessor, updateProfessor, deleteProfessor } from "@/app/professores/actions";
import { createProva, updateProva, deleteProva } from "@/app/provas/actions";
import { addNota, updateNota, deleteNota } from "@/app/notas/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import {
  buscarAulasDoUsuario,
  buscarCompartilhadasComigoEmLote,
  buscarMinhasAnotacoesEmLote,
  textoDaAnotacao,
} from "@/lib/anotacoes";
import { isIAConfigured } from "@/lib/anthropic";
import { NotificacoesButton } from "@/components/NotificacoesButton";
import { QuizPlayer } from "@/components/QuizPlayer";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}

const AULAS_VISIVEIS = 5;

function AulaLinha({ aula }: { aula: Aula & { meuConteudo: string; recebidaDe: string[] } }) {
  return (
    <Link
      href={`/aulas/${aula.id}`}
      className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-2 pr-3 hover:bg-black/[.03] dark:hover:bg-white/[.05]"
    >
      <DataSelo data={aula.data} />
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium block truncate">{aula.tema}</span>
        {aula.meuConteudo ? (
          <span className="text-[11px] text-green-700 dark:text-green-400 block">📝 com anotação</span>
        ) : aula.recebidaDe.length === 0 ? (
          <span className="text-[11px] text-foreground/45 block">sem anotação</span>
        ) : null}
        {aula.recebidaDe.length > 0 && (
          <span className="text-[11px] text-purple-700 dark:text-purple-400 block truncate">
            📥 compartilhada por {aula.recebidaDe.join(", ")}
          </span>
        )}
      </span>
      <span aria-hidden className="text-foreground/40">›</span>
    </Link>
  );
}

function diasRestantes(data: Date) {
  const diffMs = data.getTime() - hojeNoBrasil().getTime();
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

  const [disciplinasSnap, professoresSnap, aulasRaw, provasSnap, notasSnap, presencasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").orderBy("nome", "asc").get(),
    // Só as aulas de que esse login participa (check-in, anotação ou criou).
    buscarAulasDoUsuario(user.uid),
    db.collection("provas").orderBy("data", "asc").get(),
    // Frequência e notas são de cada um; disciplinas e provas são da turma.
    db.collection("notas").where("uid", "==", user.uid).get(),
    db.collection("presencas").where("uid", "==", user.uid).get(),
  ]);

  const presencasPorDisciplina = new Map<string, Presenca[]>();
  for (const doc of presencasSnap.docs) {
    const presenca = fromDoc<Presenca>(doc);
    const lista = presencasPorDisciplina.get(presenca.disciplinaId) || [];
    lista.push(presenca);
    presencasPorDisciplina.set(presenca.disciplinaId, lista);
  }
  for (const lista of presencasPorDisciplina.values()) {
    lista.sort((a, b) => b.data.getTime() - a.data.getTime());
  }

  const professores = professoresSnap.docs.map((doc) => fromDoc<Professor>(doc));
  const professoresPorId = new Map(professores.map((p) => [p.id, p]));

  // Conteúdo de cada aula = só as anotações do próprio login. É a mesma fonte do quiz por IA,
  // então "tem conteúdo pra estudar" e "dá pra gerar quiz" batem.
  const [meusCadernos, recebidasPorAula] = await Promise.all([
    buscarMinhasAnotacoesEmLote(aulasRaw.map((a) => a.id), user.uid),
    // Só olha as aulas em que alguém compartilhou com esse login.
    buscarCompartilhadasComigoEmLote(
      aulasRaw.filter((a) => a.leitores?.includes(user.uid)).map((a) => a.id),
      user.uid
    ),
  ]);

  const aulasPorDisciplina = new Map<string, (Aula & { meuConteudo: string; recebidaDe: string[] })[]>();
  for (const aula of aulasRaw) {
    const meuConteudo = textoDaAnotacao(meusCadernos.get(aula.id));
    const recebidaDe = (recebidasPorAula.get(aula.id) ?? []).map((n) => n.nome.split(" ")[0]);
    const lista = aulasPorDisciplina.get(aula.disciplinaId) || [];
    lista.push({ ...aula, meuConteudo, recebidaDe });
    aulasPorDisciplina.set(aula.disciplinaId, lista);
  }

  const todasDisciplinas = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasBase = todasDisciplinas.filter((d) => !d.arquivadaEm);
  const disciplinasArquivadas = todasDisciplinas.filter((d) => d.arquivadaEm);
  const disciplinasPorId = new Map(todasDisciplinas.map((d) => [d.id, d]));

  // Quiz de revisão da disciplina também é de cada um (disciplinas/{id}/quizzes/{uid}).
  const meusQuizzes = disciplinasBase.length
    ? await db.getAll(
        ...disciplinasBase.map((d) => db.collection("disciplinas").doc(d.id).collection("quizzes").doc(user.uid))
      )
    : [];

  const disciplinas = disciplinasBase.map((disciplina, i) => ({
    ...disciplina,
    quizIA: (meusQuizzes[i]?.data()?.quizIA as QuizPergunta[] | undefined) ?? null,
    professor: disciplina.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null,
    aulas: aulasPorDisciplina.get(disciplina.id) || [],
    presencas: presencasPorDisciplina.get(disciplina.id) || [],
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
      <AbrirPorHash />
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
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground/60">
                    Dias da semana com aula (calendário fixo do semestre)
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {DIAS_SEMANA_ABREV.map((label, i) => (
                      <label key={i} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name="diasSemana" value={i} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <input name="horario" placeholder="Horário (opcional, ex: 19:10 às 22:00)" className="field" />
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

            {disciplinas.map((disciplina) => {
              const presentes = disciplina.presencas.filter((p) => p.presente).length;
              const frequencia =
                disciplina.presencas.length > 0 ? Math.round((presentes / disciplina.presencas.length) * 100) : null;
              const aulasRecentes = disciplina.aulas.slice(0, AULAS_VISIVEIS);
              const aulasAntigas = disciplina.aulas.slice(AULAS_VISIVEIS);
              return (
                <details
                  key={disciplina.id}
                  id={disciplina.id}
                  className="disclosure rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)] scroll-mt-24"
                >
                  <summary className="p-4 gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold block truncate">{disciplina.nome}</span>
                      <span className="text-xs text-foreground/60 block truncate">
                        {[disciplina.semestre, disciplina.professor?.nome].filter(Boolean).join(" · ")}
                      </span>
                      <span className="flex flex-wrap gap-1.5 mt-1.5">
                        {disciplina.diasSemana && disciplina.diasSemana.length > 0 ? (
                          <span className="chip">
                            🗓️ {disciplina.diasSemana.map((d) => DIAS_SEMANA_ABREV[d]).join(", ")}
                            {disciplina.horario ? ` · ${disciplina.horario}` : ""}
                          </span>
                        ) : (
                          <span className="chip">🗓️ sem dia definido</span>
                        )}
                        <span className="chip">
                          📚 {disciplina.aulas.length} {disciplina.aulas.length === 1 ? "aula" : "aulas"}
                        </span>
                        {frequencia !== null && <span className="chip">📊 {frequencia}% presença</span>}
                      </span>
                    </span>
                  </summary>

                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <p className="section-title mt-1">Aulas</p>
                    {disciplina.aulas.length === 0 && (
                      <p className="text-xs text-foreground/50">Nenhuma aula registrada ainda.</p>
                    )}
                    {aulasRecentes.map((aula) => (
                      <AulaLinha key={aula.id} aula={aula} />
                    ))}
                    {aulasAntigas.length > 0 && (
                      <details className="disclosure">
                        <summary className="text-xs font-medium text-[var(--accent)] py-1">
                          Ver aulas mais antigas ({aulasAntigas.length})
                        </summary>
                        <div className="flex flex-col gap-2 mt-2">
                          {aulasAntigas.map((aula) => (
                            <AulaLinha key={aula.id} aula={aula} />
                          ))}
                        </div>
                      </details>
                    )}

                    <p className="section-title mt-3">Mais opções</p>
                    <details className="disclosure rounded-lg bg-black/[.03] dark:bg-white/[.04]">
                      <summary className="px-3 py-2 text-sm font-medium text-foreground/80">+ Nova aula</summary>
                      <div className="px-3 pb-3 text-sm">
                        <form
                          action={createAula.bind(null, disciplina.id)}
                          className="flex flex-col gap-2 mt-1"
                        >
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input name="tema" placeholder="Tema da aula" required className="flex-1 field" />
                            <input
                              name="data"
                              type="date"
                              required
                              defaultValue={dateOnlyKey(hojeNoBrasil())}
                              className="field"
                            />
                          </div>
                          <p className="text-xs text-foreground/50">
                            A aula aparece só pra você — depois de criar, abra ela pra escrever suas
                            anotações.
                          </p>
                          <button type="submit" className="self-start btn-primary">
                            Salvar aula
                          </button>
                        </form>
                      </div>
                    </details>
                    <details className="disclosure rounded-lg bg-black/[.03] dark:bg-white/[.04]">
                      <summary className="px-3 py-2 text-sm font-medium text-foreground/80">📊 Frequência {disciplina.presencas.length > 0 ? `(${disciplina.presencas.length})` : ""}</summary>
                      <div className="px-3 pb-3 text-sm">
                        <div className="flex flex-col gap-3 mt-1">
                          <form
                            action={registrarPresenca.bind(null, disciplina.id)}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              name="data"
                              type="date"
                              required
                              defaultValue={dateOnlyKey(hojeNoBrasil())}
                              className="field !py-1.5 !text-xs"
                            />
                            <button
                              type="submit"
                              name="presente"
                              value="true"
                              className="text-xs rounded-full px-3 py-1 border border-green-600/40 text-green-700 dark:text-green-400"
                            >
                              ✅ Presente
                            </button>
                            <button
                              type="submit"
                              name="presente"
                              value="false"
                              className="text-xs rounded-full px-3 py-1 border border-red-600/40 text-red-600 dark:text-red-400"
                            >
                              ❌ Falta
                            </button>
                          </form>
                          <p className="text-xs text-foreground/50">
                            Registre ou corrija uma data (se já existir frequência naquele dia, isso substitui).
                          </p>
                          <div className="flex flex-col gap-2">
                            {disciplina.presencas.length === 0 && (
                              <p className="text-xs text-foreground/50">Nenhuma frequência registrada ainda.</p>
                            )}
                            {disciplina.presencas.map((presenca) => (
                              <div
                                key={presenca.id}
                                className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs"
                              >
                                <span>{formatDate(presenca.data)}</span>
                                <div className="flex items-center gap-3">
                                  <span
                                    className={
                                      presenca.presente
                                        ? "text-green-700 dark:text-green-400 font-medium"
                                        : "text-red-600 dark:text-red-400 font-medium"
                                    }
                                  >
                                    {presenca.presente ? "Presente" : "Falta"}
                                  </span>
                                  <form action={removerPresenca.bind(null, presenca.id)}>
                                    <button type="submit" className="text-foreground/40 hover:text-red-600">
                                      Remover
                                    </button>
                                  </form>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                    <details className="disclosure rounded-lg bg-black/[.03] dark:bg-white/[.04]">
                      <summary className="px-3 py-2 text-sm font-medium text-foreground/80">🧠 Quiz de revisão</summary>
                      <div className="px-3 pb-3 text-sm">
                        <div className="flex flex-col gap-3 mt-1">
                          {!isIAConfigured() ? (
                            <p className="text-xs text-foreground/50">Recurso de IA ainda não configurado neste app.</p>
                          ) : (
                            <>
                              {disciplina.aulas.some((a) => a.meuConteudo) && (
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
                      </div>
                    </details>
                    {isAdmin && (
                      <details className="disclosure rounded-lg bg-black/[.03] dark:bg-white/[.04]">
                        <summary className="px-3 py-2 text-sm font-medium text-foreground/80">⚙️ Editar disciplina</summary>
                        <div className="px-3 pb-3 text-sm">
                          <form
                            action={updateDisciplina.bind(null, disciplina.id)}
                            className="flex flex-col gap-2 mt-1"
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
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-medium text-foreground/60">
                                Dias da semana com aula (calendário fixo do semestre)
                              </span>
                              <div className="flex flex-wrap gap-3">
                                {DIAS_SEMANA_ABREV.map((label, i) => (
                                  <label key={i} className="flex items-center gap-1.5 text-xs">
                                    <input
                                      type="checkbox"
                                      name="diasSemana"
                                      value={i}
                                      defaultChecked={disciplina.diasSemana?.includes(i)}
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <input
                              name="horario"
                              placeholder="Horário (opcional, ex: 19:10 às 22:00)"
                              defaultValue={disciplina.horario ?? ""}
                              className="field"
                            />
                            <button type="submit" className="self-start btn-primary">
                              Salvar alterações
                            </button>
                          </form>
                          <form
                            action={arquivarDisciplina.bind(null, disciplina.id)}
                            className="mt-4 pt-3 border-t border-black/10 dark:border-white/10"
                          >
                            <button type="submit" className="btn-danger-text">
                              🗑️ Mandar pra lixeira
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </details>

      {/* ---------- Lixeira de disciplinas ---------- */}
      {isAdmin && disciplinasArquivadas.length > 0 && (
        <details className="disclosure card" id="lixeira">
          <summary className="flex items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="icon-badge bg-black/5 dark:bg-white/10 text-foreground/60">🗑️</span>
              Lixeira
            </h2>
            <span className="text-xs text-foreground/50 shrink-0">
              {disciplinasArquivadas.length} disciplina(s)
            </span>
          </summary>
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-xs text-foreground/50">
              Disciplinas arquivadas somem das listas, mas as aulas, anotações, presenças e provas
              continuam guardadas. Restaure quando quiser, ou exclua definitivamente (aí não tem volta).
            </p>
            {disciplinasArquivadas.map((disciplina) => (
              <div key={disciplina.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{disciplina.nome}</p>
                  <p className="text-xs text-foreground/60">{disciplina.semestre}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={restaurarDisciplina.bind(null, disciplina.id)}>
                    <button type="submit" className="btn-ghost">
                      ♻️ Restaurar
                    </button>
                  </form>
                  <form action={excluirDisciplinaPermanentemente.bind(null, disciplina.id)}>
                    <button type="submit" className="btn-danger-text">
                      Excluir definitivamente
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

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
              const aulasComResumo = prova.disciplina.aulas.filter((a) => a.meuConteudo);
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
                          Você ainda não tem anotações nesta disciplina.
                        </li>
                      )}
                      {aulasComResumo.map((aula) => (
                        <li key={aula.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                          <p className="font-medium text-xs">{aula.tema}</p>
                          <p className="text-xs text-foreground/60 mt-1 line-clamp-3">
                            {aula.meuConteudo}
                          </p>
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
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{d.nome}</p>
                {d.notas.length > 0 && (
                  <span className="chip shrink-0">
                    Média{" "}
                    {(d.notas.reduce((soma, n) => soma + n.valor, 0) / d.notas.length).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {d.notas.length === 0 && <p className="text-xs text-foreground/50">Nenhuma nota lançada.</p>}
                {d.notas.map((nota) => (
                  <div key={nota.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm">{nota.descricao}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm">{nota.valor.toLocaleString("pt-BR")}</span>
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
                          defaultValue={nota.valor.toLocaleString("pt-BR")}
                          required
                          inputMode="decimal"
                          className="w-20 field !text-xs !py-1.5"
                        />
                        <SubmitButton
                          savedLabel="Salvo!"
                          pendingLabel="Salvando..."
                          className="btn-primary !text-xs !py-1.5 !px-3"
                        >
                          Salvar
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                ))}
              </div>
              <form
                action={addNota.bind(null, d.id)}
                className="flex flex-col gap-2 rounded-xl border border-dashed border-black/15 dark:border-white/15 p-3"
              >
                <p className="text-xs font-semibold text-foreground/70">Lançar nova nota</p>
                <div className="flex gap-2">
                  <label className="flex-1 min-w-0 text-xs font-medium text-foreground/60 flex flex-col gap-1">
                    Avaliação
                    <input name="descricao" placeholder="Ex: Prova 1" required className="field" />
                  </label>
                  <label className="w-24 text-xs font-medium text-foreground/60 flex flex-col gap-1">
                    Nota
                    <input name="valor" placeholder="Ex: 8,5" required inputMode="decimal" className="field" />
                  </label>
                </div>
                <SubmitButton savedLabel="Nota lançada!" pendingLabel="Lançando..." className="btn-primary w-full">
                  ✅ Inserir nota
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
