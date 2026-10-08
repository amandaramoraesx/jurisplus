import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import {
  dateOnlyKey,
  fromDoc,
  hojeNoBrasil,
  type Disciplina,
  type Presenca,
  type Professor,
  DIAS_SEMANA,
} from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarMinhaAnotacao } from "@/lib/anotacoes";
import { marcarPresenca, marcarTodasPresentes, anotarRapido } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { EditorAnotacao } from "@/components/EditorAnotacao";

export const dynamic = "force-dynamic";

type DisciplinaComExtras = Disciplina & {
  professor: Professor | null;
  totalAulas: number;
  presencas: Presenca[];
  minhaAnotacaoHoje: { resumo: string; anotacoesLousa: string };
};

function AnotarDisciplina({
  disciplina,
  hojeKey,
  abrirPorPadrao,
}: {
  disciplina: DisciplinaComExtras;
  hojeKey: string;
  abrirPorPadrao?: boolean;
}) {
  const { resumo, anotacoesLousa } = disciplina.minhaAnotacaoHoje;
  const temAnotacao = Boolean(resumo || anotacoesLousa);

  return (
    <details className="disclosure rounded-xl border border-black/10 dark:border-white/10" open={abrirPorPadrao}>
      <summary className="px-4 py-3">
        <span className="min-w-0">
          <span className="font-semibold block truncate">{disciplina.nome}</span>
          {(disciplina.professor || disciplina.horario) && (
            <span className="text-xs text-foreground/50 block truncate">
              {[disciplina.professor?.nome, disciplina.horario].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        {temAnotacao && (
          <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0 ml-auto bg-green-600/10 text-green-700 dark:text-green-400">
            🔒 salva
          </span>
        )}
      </summary>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">
        <EditorAnotacao
          action={anotarRapido.bind(null, disciplina.id)}
          resumoInicial={resumo}
          lousaInicial={anotacoesLousa}
          titulo={disciplina.nome}
          rodapeExtra={
            temAnotacao ? (
              <Link href={`/aulas/${disciplina.id}_${hojeKey}`} className="text-xs text-foreground/60 hover:underline">
                Abrir aula →
              </Link>
            ) : null
          }
        />
      </div>
    </details>
  );
}

function CheckinItem({
  disciplina,
  status,
}: {
  disciplina: DisciplinaComExtras;
  status: boolean | undefined;
}) {
  const detalhe = [disciplina.professor?.nome, disciplina.horario].filter(Boolean).join(" · ");
  const botoes = (
    <div className="grid grid-cols-2 gap-2">
      <form action={marcarPresenca.bind(null, disciplina.id, true)}>
        <SubmitButton
          pendingLabel="Salvando..."
          savedLabel="Presente"
          className="w-full rounded-lg py-2.5 text-sm font-semibold bg-green-600 text-white active:scale-[0.98] disabled:opacity-60"
        >
          ✅ Estou presente
        </SubmitButton>
      </form>
      <form action={marcarPresenca.bind(null, disciplina.id, false)}>
        <SubmitButton
          pendingLabel="Salvando..."
          savedLabel="Falta"
          className="w-full rounded-lg py-2.5 text-sm font-semibold border border-black/15 dark:border-white/20 text-foreground/80 active:scale-[0.98] disabled:opacity-60"
        >
          Faltei
        </SubmitButton>
      </form>
    </div>
  );

  // Pendente: cartão com os dois botões grandes.
  if (status === undefined) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-3 flex flex-col gap-3">
        <div className="min-w-0">
          <span className="font-semibold block truncate">{disciplina.nome}</span>
          {detalhe && <span className="text-xs text-foreground/50 block truncate">{detalhe}</span>}
        </div>
        {botoes}
      </div>
    );
  }

  // Já registrado: linha compacta, com "Alterar" pra corrigir.
  return (
    <details
      className={`disclosure rounded-xl border ${
        status
          ? "border-green-600/30 bg-green-600/[.06]"
          : "border-red-600/30 bg-red-600/[.06]"
      }`}
    >
      <summary className="px-3 py-2.5 gap-3">
        <span className="text-lg shrink-0" aria-hidden>
          {status ? "✅" : "❌"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold block truncate">{disciplina.nome}</span>
          <span
            className={`text-xs font-medium block ${
              status ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {status ? "Presença registrada" : "Falta registrada"}
          </span>
        </span>
        <span className="text-xs text-foreground/50 shrink-0">Alterar</span>
      </summary>
      <div className="px-3 pb-3">{botoes}</div>
    </details>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const hoje = hojeNoBrasil();
  const hojeKey = dateOnlyKey(hoje);

  const [disciplinasSnap, professoresSnap, aulasSnap, presencasSnap] = await Promise.all([
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").get(),
    // Só as aulas de que esse login participa.
    db.collection("aulas").where("participantes", "array-contains", user.uid).get(),
    db.collection("presencas").where("uid", "==", user.uid).get(),
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
      },
    }));

  const presencaHojeMap = new Map(
    presencas.filter((p) => dateOnlyKey(p.data) === hojeKey).map((p) => [p.disciplinaId, p.presente])
  );

  const hojeDiaSemana = hoje.getUTCDay();
  // Só entra no check-in quem tem aula hoje no calendário do semestre. Disciplina sem dia da
  // semana cadastrado não aparece aqui (senão surgia todo dia); ganha só um aviso pra configurar.
  const disciplinasHoje = disciplinas.filter((d) => d.diasSemana?.includes(hojeDiaSemana));
  const disciplinasSemCalendario = disciplinas.filter((d) => !d.diasSemana || d.diasSemana.length === 0);

  const pendentesHoje = disciplinasHoje.filter((d) => !presencaHojeMap.has(d.id));
  const checkinsFeitos = disciplinasHoje.length - pendentesHoje.length;
  const primeiroNome = (user.nome || user.email || "").split(" ")[0] || "";
  const tudoFeitoHoje = disciplinasHoje.length > 0 && checkinsFeitos === disciplinasHoje.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="hero-banner">
        <h1 className="text-2xl font-bold">
          👋 {primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!"}
        </h1>
        <p className="text-sm opacity-85 mt-0.5">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(hoje)}
        </p>
        {disciplinasHoje.length > 0 && (
          <p className="text-sm mt-2 font-medium">
            {tudoFeitoHoje
              ? "🎉 Check-in do dia feito!"
              : `✅ Falta${pendentesHoje.length > 1 ? "m" : ""} ${pendentesHoje.length} check-in${pendentesHoje.length > 1 ? "s" : ""} hoje`}
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className="icon-badge bg-green-600/10 text-green-700 dark:text-green-400">✅</span>
                  Check-in de hoje
                </h2>
                <p className="text-xs text-foreground/60 mt-1">
                  {tudoFeitoHoje
                    ? "Tudo registrado por hoje. Errou? Toque em “Alterar”."
                    : `${DIAS_SEMANA[hojeDiaSemana]}: marque sua presença em cada aula.`}
                </p>
              </div>
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${
                  tudoFeitoHoje
                    ? "bg-green-600/15 text-green-700 dark:text-green-400"
                    : "bg-black/5 dark:bg-white/10 text-foreground/70"
                }`}
              >
                {checkinsFeitos} de {disciplinasHoje.length} {tudoFeitoHoje ? "✓" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {disciplinasHoje.map((disciplina) => (
                <CheckinItem
                  key={disciplina.id}
                  disciplina={disciplina}
                  status={presencaHojeMap.get(disciplina.id)}
                />
              ))}
            </div>

            {pendentesHoje.length > 1 && (
              <form action={marcarTodasPresentes.bind(null, pendentesHoje.map((d) => d.id))}>
                <SubmitButton
                  savedLabel="Check-in feito!"
                  pendingLabel="Marcando..."
                  className="btn-primary w-full"
                >
                  ✅ Estou presente em todas ({pendentesHoje.length})
                </SubmitButton>
              </form>
            )}
          </>
        )}
      </section>

      {/* Só admin consegue definir os dias da disciplina; pra aluno o aviso não ajuda. */}
      {user.role === "admin" && disciplinasSemCalendario.length > 0 && (
        <p className="text-xs text-foreground/60 rounded-xl border border-dashed border-black/15 dark:border-white/15 px-4 py-3">
          🗓️ {disciplinasSemCalendario.map((d) => d.nome).join(", ")}{" "}
          {disciplinasSemCalendario.length === 1 ? "está" : "estão"} sem dia da semana definido e não
          {disciplinasSemCalendario.length === 1 ? " aparece" : " aparecem"} no check-in.{" "}
          <Link href="/aulas?abrir=disciplinas" className="font-medium text-[var(--accent)] hover:underline">
            Definir os dias de aula →
          </Link>
        </p>
      )}

      {disciplinasHoje.length > 0 && (
        <section className="card flex flex-col gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span className="icon-badge bg-blue-600/10 text-blue-700 dark:text-blue-400">📝</span>
              Anotar aula de hoje
            </h2>
            <p className="text-xs text-foreground/60 mt-1">
              Escolha a aba <strong>Anotações</strong> ou <strong>Lousa</strong> e escreva à vontade.
              Use <strong>Tela cheia</strong> pra ter a tela toda durante a aula.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {disciplinasHoje.map((disciplina) => (
              <AnotarDisciplina
                key={disciplina.id}
                disciplina={disciplina}
                hojeKey={hojeKey}
                abrirPorPadrao={disciplinasHoje.length === 1}
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
