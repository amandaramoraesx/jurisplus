import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Disciplina, type Presenca, type Professor, DIAS_SEMANA } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarMinhaAnotacao } from "@/lib/anotacoes";
import { marcarPresenca, marcarTodasPresentes, anotarRapido } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

type DisciplinaComExtras = Disciplina & {
  professor: Professor | null;
  totalAulas: number;
  presencas: Presenca[];
  minhaAnotacaoHoje: { resumo: string; anotacoesLousa: string; compartilhado: boolean };
};

function AnotarDisciplinaDetails({
  disciplina,
  hojeKey,
  abrirPorPadrao,
}: {
  disciplina: DisciplinaComExtras;
  hojeKey: string;
  abrirPorPadrao?: boolean;
}) {
  const { resumo, anotacoesLousa, compartilhado } = disciplina.minhaAnotacaoHoje;
  const temAnotacao = Boolean(resumo || anotacoesLousa);

  return (
    <details className="disclosure" open={abrirPorPadrao}>
      <summary className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium flex items-center justify-between gap-2">
        <span>
          {disciplina.nome}
          {disciplina.professor ? (
            <span className="text-foreground/50 font-normal"> · {disciplina.professor.nome}</span>
          ) : null}
        </span>
        {temAnotacao && (
          <span
            className={`text-[10px] rounded-full px-2 py-0.5 shrink-0 ${
              compartilhado
                ? "bg-blue-600/10 text-blue-700 dark:text-blue-400"
                : "bg-green-600/10 text-green-700 dark:text-green-400"
            }`}
          >
            {compartilhado ? "🌐 compartilhada com colegas" : "🔒 anotação salva (só sua)"}
          </span>
        )}
      </summary>
      <form action={anotarRapido.bind(null, disciplina.id)} className="flex flex-col gap-3 mt-2">
        <label className="text-xs font-medium text-foreground/60 flex flex-col gap-1">
          Anotações
          <textarea
            name="resumo"
            defaultValue={resumo}
            rows={4}
            placeholder="Suas anotações sobre a aula..."
            className="field"
          />
        </label>
        <label className="text-xs font-medium text-foreground/60 flex flex-col gap-1">
          Lousa
          <textarea
            name="anotacoesLousa"
            defaultValue={anotacoesLousa}
            rows={4}
            placeholder="O que o professor escreveu na lousa..."
            className="field font-mono"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground/70">
          <input type="checkbox" name="compartilhado" defaultChecked={compartilhado} className="accent-[var(--accent)]" />
          🌐 Compartilhar essa anotação com os colegas (senão só você vê)
        </label>
        <div className="flex items-center gap-3">
          <SubmitButton savedLabel="✅ Anotação salva!" pendingLabel="Salvando..." className="self-start btn-primary">
            💾 Salvar anotação
          </SubmitButton>
          {temAnotacao && (
            <Link
              href={`/aulas/${disciplina.id}_${hojeKey}`}
              className="text-xs text-foreground/60 hover:underline"
            >
              🖨️ Ver aula e gerar PDF →
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
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

  // aula "de hoje" de cada disciplina tem id determinístico; busca a anotação pessoal (privada por
  // padrão) do login atual pra cada uma delas, em paralelo.
  const disciplinaIdsComAulaHoje = disciplinasSnap.docs
    .map((doc) => doc.id)
    .filter((disciplinaId) => aulasSnap.docs.some((doc) => doc.id === `${disciplinaId}_${hojeKey}`));
  const minhasAnotacoesHoje = await Promise.all(
    disciplinaIdsComAulaHoje.map((disciplinaId) =>
      buscarMinhaAnotacao(`${disciplinaId}_${hojeKey}`, user.uid)
    )
  );
  const anotacaoHojePorDisciplina = new Map(
    disciplinaIdsComAulaHoje.map((disciplinaId, i) => [
      disciplinaId,
      {
        resumo: minhasAnotacoesHoje[i]?.resumo || "",
        anotacoesLousa: minhasAnotacoesHoje[i]?.anotacoesLousa || "",
        compartilhado: minhasAnotacoesHoje[i]?.compartilhado || false,
      },
    ])
  );

  const presencas = presencasSnap.docs.map((doc) => fromDoc<Presenca>(doc));
  const presencasPorDisciplina = new Map<string, Presenca[]>();
  for (const presenca of presencas) {
    presencasPorDisciplina.set(
      presenca.disciplinaId,
      [...(presencasPorDisciplina.get(presenca.disciplinaId) || []), presenca]
    );
  }

  const disciplinas = disciplinasSnap.docs
    .map((doc) => fromDoc<Disciplina>(doc))
    .filter((disciplina) => !disciplina.arquivadaEm)
    .map((disciplina) => ({
      ...disciplina,
      professor: disciplina.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null,
      totalAulas: aulasPorDisciplina.get(disciplina.id) || 0,
      presencas: presencasPorDisciplina.get(disciplina.id) || [],
      minhaAnotacaoHoje: anotacaoHojePorDisciplina.get(disciplina.id) || {
        resumo: "",
        anotacoesLousa: "",
        compartilhado: false,
      },
    }));

  const presencaHojeMap = new Map(
    presencas.filter((p) => dateOnlyKey(p.data) === hojeKey).map((p) => [p.disciplinaId, p.presente])
  );

  const hojeDiaSemana = hoje.getDay();
  // Disciplina sem calendário definido ainda aparece sempre (não trava o check-in de ninguém).
  const temHoje = (d: (typeof disciplinas)[number]) =>
    !d.diasSemana || d.diasSemana.length === 0 || d.diasSemana.includes(hojeDiaSemana);
  const disciplinasHoje = disciplinas.filter(temHoje);

  const checkinsFeitos = disciplinasHoje.filter((d) => presencaHojeMap.has(d.id)).length;
  const primeiroNome = (user.nome || user.email || "").split(" ")[0] || "";
  const tudoFeitoHoje = disciplinasHoje.length > 0 && checkinsFeitos === disciplinasHoje.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="hero-banner">
        <h1 className="text-2xl font-bold">
          👋 {primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!"}
        </h1>
        <p className="text-sm opacity-85 mt-0.5">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(hoje)}
        </p>
        {disciplinasHoje.length > 0 && (
          <p className="text-sm mt-2 font-medium">
            {tudoFeitoHoje ? "🎉 Check-in do dia todo feito!" : "✅ Bora fazer o check-in de hoje?"}
          </p>
        )}
      </div>

      <section className="card flex flex-col gap-3">
        {disciplinas.length === 0 ? (
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="icon-badge bg-green-600/10 text-green-700 dark:text-green-400">✅</span>
              Check-in de hoje
            </h2>
            <p className="text-sm text-foreground/60 mt-2">
              Cadastre suas disciplinas na aba Acadêmico para começar a fazer check-in.
            </p>
          </div>
        ) : disciplinasHoje.length === 0 ? (
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="icon-badge bg-green-600/10 text-green-700 dark:text-green-400">✅</span>
              Check-in de hoje
            </h2>
            <p className="text-sm text-foreground/60 mt-2">
              🎉 Nenhuma aula prevista pra hoje ({DIAS_SEMANA[hojeDiaSemana]}) no calendário do semestre.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="icon-badge bg-green-600/10 text-green-700 dark:text-green-400">✅</span>
                  Check-in de hoje
                </h2>
                <p className="text-xs text-foreground/60 mt-0.5">
                  Hoje é {DIAS_SEMANA[hojeDiaSemana]}, você tem aula de{" "}
                  <strong className="font-semibold text-foreground/80">
                    {disciplinasHoje.map((d) => d.nome).join(" e ")}
                  </strong>
                  . {checkinsFeitos} de {disciplinasHoje.length} já registrada(s).
                </p>
              </div>
              <form action={marcarTodasPresentes.bind(null, disciplinasHoje.map((d) => d.id))}>
                <SubmitButton savedLabel="✅ Check-in feito!" pendingLabel="Marcando...">
                  🎯 Fazer check-in
                </SubmitButton>
              </form>
            </div>

            <div className="flex flex-col gap-2">
              {disciplinasHoje.map((disciplina) => {
                const status = presencaHojeMap.get(disciplina.id);
                return (
                  <div
                    key={disciplina.id}
                    className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{disciplina.nome}</span>
                      {(disciplina.professor || disciplina.horario) && (
                        <span className="text-xs text-foreground/50 block truncate">
                          {disciplina.professor ? disciplina.professor.nome : null}
                          {disciplina.professor && disciplina.horario ? " · " : null}
                          {disciplina.horario ?? null}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
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
          </>
        )}
      </section>

      {disciplinasHoje.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="icon-badge bg-blue-600/10 text-blue-700 dark:text-blue-400">📝</span>
              Anotar aula
            </h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              Clique na matéria e escreva — fica salvo direto na aula de hoje.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {disciplinasHoje.map((disciplina) => (
              <AnotarDisciplinaDetails
                key={disciplina.id}
                disciplina={disciplina}
                hojeKey={hojeKey}
                abrirPorPadrao={disciplinasHoje.length <= 2}
              />
            ))}
          </div>
        </section>
      )}

      {disciplinas.length > 0 && (
        <section className="card">
          <details className="disclosure">
            <summary className="flex items-center justify-between gap-3">
              <h2 className="font-semibold flex items-center gap-2">
                <span className="icon-badge bg-purple-600/10 text-purple-700 dark:text-purple-400">📊</span>
                Frequência por disciplina
              </h2>
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
                    <th className="py-1 px-2">Frequência</th>
                    <th className="py-1 pl-2"></th>
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
                        <td className="py-2 px-2">{pct === null ? "—" : `${pct}%`}</td>
                        <td className="py-2 pl-2">
                          <Link
                            href={`/aulas?abrir=disciplinas#${d.id}`}
                            className="text-xs text-foreground/60 hover:underline"
                          >
                            editar
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-foreground/50 mt-3">
              Pra registrar, corrigir ou apagar uma frequência (inclusive de dias passados), clique
              em &ldquo;editar&rdquo; e abra a disciplina em Acadêmico.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
