import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Aula, type Disciplina, type Professor, type AnotacaoPessoal } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { AnexoIcone, formatBytes } from "@/components/Anexo";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic";

// Datas de aula ficam salvas como meia-noite UTC; formatar em UTC evita mostrar o dia anterior.
function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}

function diaEMes(d: Date) {
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(d);
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(d)
    .replace(".", "");
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(d)
    .replace(".", "");
  return { dia, mes, semana };
}

type AulaComNotasVisiveis = Aula & {
  disciplina: Disciplina | null;
  professor: Professor | null;
  notasVisiveis: AnotacaoPessoal[];
};

async function anotacoesVisiveis(aulaId: string, uid: string): Promise<AnotacaoPessoal[]> {
  const snap = await db.collection("aulas").doc(aulaId).collection("anotacoes").get();
  return snap.docs
    .map((doc) => fromDoc<AnotacaoPessoal>(doc))
    .filter((nota) => nota.uid === uid || nota.compartilhado);
}

function textoParaCompartilhar(aula: AulaComNotasVisiveis) {
  const partes = [`${aula.disciplina?.nome ?? "Aula"} — ${aula.tema} (${formatDate(aula.data)})`];
  if (aula.resumo) partes.push(aula.resumo);
  if (aula.anotacoesLousa) partes.push(aula.anotacoesLousa);
  for (const nota of aula.notasVisiveis) {
    if (nota.resumo) partes.push(nota.resumo);
    if (nota.anotacoesLousa) partes.push(nota.anotacoesLousa);
  }
  return partes.join("\n\n");
}

function BlocoTexto({ resumo, lousa }: { resumo: string | null; lousa: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {resumo && (
        <div>
          <p className="section-title mb-1">📝 Anotações</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{resumo}</p>
        </div>
      )}
      {lousa && (
        <div>
          <p className="section-title mb-1">🧑‍🏫 Lousa</p>
          <p className="lousa-leitura">{lousa}</p>
        </div>
      )}
    </div>
  );
}

function Autor({
  titulo,
  abrir,
  children,
}: {
  titulo: string;
  abrir?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="disclosure rounded-lg bg-black/[.03] dark:bg-white/[.04]" open={abrir}>
      <summary className="px-3 py-2 text-sm font-medium text-foreground/80">{titulo}</summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

function NotaCard({ aula, uid }: { aula: AulaComNotasVisiveis; uid: string }) {
  const { dia, mes, semana } = diaEMes(aula.data);
  const minha = aula.notasVisiveis.find((nota) => nota.uid === uid);
  const dosColegas = aula.notasVisiveis.filter((nota) => nota.uid !== uid);
  const temLegado = Boolean(aula.resumo || aula.anotacoesLousa);
  const totalAnotacoes = aula.notasVisiveis.length + (temLegado ? 1 : 0);
  const totalAnexos = aula.anexos?.length ?? 0;

  return (
    <details className="disclosure rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]">
      <summary className="p-3 gap-3">
        <span className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] py-1">
          <span className="text-[10px] uppercase leading-none">{semana}</span>
          <span className="text-lg font-bold leading-tight">{dia}</span>
          <span className="text-[10px] uppercase leading-none">{mes}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-sm block truncate">
            {aula.disciplina?.nome ?? "Disciplina removida"}
          </span>
          <span className="text-xs text-foreground/60 block truncate">{aula.tema}</span>
          <span className="flex flex-wrap gap-1.5 mt-1">
            {minha && <span className="chip">🔒 minha</span>}
            {totalAnotacoes > 0 && (
              <span className="chip">
                📝 {totalAnotacoes} {totalAnotacoes === 1 ? "anotação" : "anotações"}
              </span>
            )}
            {totalAnexos > 0 && (
              <span className="chip">
                📎 {totalAnexos} {totalAnexos === 1 ? "anexo" : "anexos"}
              </span>
            )}
          </span>
        </span>
      </summary>

      <div className="flex flex-col gap-2 px-3 pb-3">
        {aula.professor && <p className="text-xs text-foreground/50">Professor(a): {aula.professor.nome}</p>}
        {minha && (
          <Autor titulo={minha.compartilhado ? "🌐 Minha anotação (compartilhada)" : "🔒 Minha anotação"} abrir>
            <BlocoTexto resumo={minha.resumo} lousa={minha.anotacoesLousa} />
          </Autor>
        )}
        {dosColegas.map((nota) => (
          <Autor key={nota.id} titulo={`🌐 ${nota.nome}`} abrir={!minha && dosColegas.length === 1}>
            <BlocoTexto resumo={nota.resumo} lousa={nota.anotacoesLousa} />
          </Autor>
        ))}
        {temLegado && (
          <Autor titulo="🗂️ Anotação antiga da turma">
            <BlocoTexto resumo={aula.resumo} lousa={aula.anotacoesLousa} />
          </Autor>
        )}
        {totalAnexos > 0 && (
          <Autor titulo={`📎 Anexos (${totalAnexos})`}>
            <ul className="flex flex-col gap-1.5">
              {aula.anexos!.map((anexo) => (
                <li key={anexo.id}>
                  <a
                    href={`/api/anexos/${aula.id}/${anexo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <AnexoIcone tipo={anexo.tipo} />
                    <span className="truncate">{anexo.nome}</span>
                    <span className="text-xs text-foreground/50 shrink-0">({formatBytes(anexo.tamanho)})</span>
                  </a>
                </li>
              ))}
            </ul>
          </Autor>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link href={`/aulas/${aula.id}`} className="btn-ghost">
            ✏️ Abrir aula
          </Link>
          <Link href={`/aulas/${aula.id}/imprimir`} className="btn-ghost">
            🖨️ PDF
          </Link>
          <ShareButton title={aula.tema} text={textoParaCompartilhar(aula)} />
        </div>
      </div>
    </details>
  );
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; professorId?: string }>;
}) {
  const user = await requireUser();
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

  const aulasBase = aulasSnap.docs.map((doc) => {
    const aula = fromDoc<Aula>(doc);
    const disciplina = disciplinasPorId.get(aula.disciplinaId) ?? null;
    const professor = disciplina?.professorId ? professoresPorId.get(disciplina.professorId) ?? null : null;
    return { ...aula, disciplina, professor };
  });

  // Filtra por data/professor primeiro (metadados, baratos) — só depois busca as anotações
  // (que exigem uma leitura por aula) do conjunto já reduzido.
  const aulasDoDiaBase = dataSelecionada
    ? aulasBase.filter((aula) => dateOnlyKey(aula.data) === dataSelecionada)
    : [];
  const aulasDoProfessorBase = professorIdSelecionado
    ? aulasBase.filter((aula) => aula.professor?.id === professorIdSelecionado)
    : [];

  async function comNotasVisiveis(lista: typeof aulasBase): Promise<AulaComNotasVisiveis[]> {
    const notas = await Promise.all(lista.map((aula) => anotacoesVisiveis(aula.id, user.uid)));
    return lista
      .map((aula, i) => ({ ...aula, notasVisiveis: notas[i] }))
      .filter(
        (aula) =>
          aula.resumo || aula.anotacoesLousa || aula.anexos?.length || aula.notasVisiveis.length > 0
      );
  }

  const [aulasDoDia, aulasDoProfessor] = await Promise.all([
    comNotasVisiveis(aulasDoDiaBase),
    comNotasVisiveis(aulasDoProfessorBase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">🗓️ Histórico de aulas</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Busque as anotações e lousas já registradas por data ou por professor — mostra suas
          anotações e as que os colegas compartilharam.
        </p>
      </div>

      <details className="disclosure card" open={Boolean(dataSelecionada)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-blue-600/10 text-blue-700 dark:text-blue-400">🗓️</span>
            Por data
          </h2>
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
            <div className="flex flex-col gap-2">
              {aulasDoDia.length > 0 && <p className="text-xs text-foreground/50">Toque numa aula pra ver o conteúdo.</p>}
              {aulasDoDia.length === 0 && (
                <p className="text-sm text-foreground/60">
                  Nenhuma anotação registrada em {formatDate(new Date(`${dataSelecionada}T00:00:00Z`))}.
                </p>
              )}
              {aulasDoDia.map((aula) => (
                <NotaCard key={aula.id} aula={aula} uid={user.uid} />
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="disclosure card" open={Boolean(professorIdSelecionado)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-amber-500/10 text-amber-700 dark:text-amber-400">🎓</span>
            Por professor
          </h2>
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
            <div className="flex flex-col gap-2">
              {aulasDoProfessor.length > 0 && (
                <p className="text-xs text-foreground/50">
                  {aulasDoProfessor.length} {aulasDoProfessor.length === 1 ? "aula" : "aulas"} com anotação. Toque
                  numa aula pra ver o conteúdo.
                </p>
              )}
              {aulasDoProfessor.length === 0 && (
                <p className="text-sm text-foreground/60">
                  Nenhuma anotação registrada para{" "}
                  {professoresPorId.get(professorIdSelecionado)?.nome ?? "esse professor"} ainda.
                </p>
              )}
              {aulasDoProfessor.map((aula) => (
                <NotaCard key={aula.id} aula={aula} uid={user.uid} />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
