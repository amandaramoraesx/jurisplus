import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Aula, type Disciplina, type Professor, type AnotacaoPessoal } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarAulasDoUsuario, buscarMinhasAnotacoesEmLote } from "@/lib/anotacoes";
import { AnexoIcone, formatBytes } from "@/components/Anexo";
import { ShareButton } from "@/components/ShareButton";
import { DataSelo } from "@/components/DataSelo";

export const dynamic = "force-dynamic";

// Datas de aula ficam salvas como meia-noite UTC; formatar em UTC evita mostrar o dia anterior.
function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}

/** Aula + o caderno do próprio login nela (ninguém vê o de ninguém). */
type AulaComCaderno = Aula & {
  disciplina: Disciplina | null;
  professor: Professor | null;
  minha: AnotacaoPessoal;
};

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

function NotaCard({ aula }: { aula: AulaComCaderno }) {
  const { minha } = aula;
  const anexos = minha.anexos ?? [];
  const totalAnexos = anexos.length;

  return (
    <details className="disclosure rounded-xl border border-black/10 dark:border-white/10 bg-[var(--surface)]">
      <summary className="p-3 gap-3">
        <DataSelo data={aula.data} />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-sm block truncate">
            {aula.disciplina?.nome ?? "Disciplina removida"}
          </span>
          <span className="text-xs text-foreground/60 block truncate">{aula.tema}</span>
          <span className="flex flex-wrap gap-1.5 mt-1">
            {minha.resumo && <span className="chip">📝 anotação</span>}
            {minha.anotacoesLousa && <span className="chip">🧑‍🏫 lousa</span>}
            {totalAnexos > 0 && (
              <span className="chip">
                📎 {totalAnexos} {totalAnexos === 1 ? "anexo" : "anexos"}
              </span>
            )}
            {minha.resumoIA && <span className="chip">✨ resumo IA</span>}
          </span>
        </span>
      </summary>

      <div className="flex flex-col gap-2 px-3 pb-3">
        {aula.professor && <p className="text-xs text-foreground/50">Professor(a): {aula.professor.nome}</p>}
        {(minha.resumo || minha.anotacoesLousa) && (
          <Autor titulo="🔒 Minha anotação" abrir>
            <BlocoTexto resumo={minha.resumo} lousa={minha.anotacoesLousa} />
          </Autor>
        )}
        {minha.resumoIA && (
          <Autor titulo="✨ Resumo inteligente (IA)">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{minha.resumoIA}</p>
          </Autor>
        )}
        {totalAnexos > 0 && (
          <Autor titulo={`📎 Anexos (${totalAnexos})`}>
            <ul className="flex flex-col gap-1.5">
              {anexos.map((anexo) => (
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
          <ShareButton aulaId={aula.id} title={aula.tema} />
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

  const [minhasAulas, disciplinasSnap, professoresSnap] = await Promise.all([
    buscarAulasDoUsuario(user.uid),
    db.collection("disciplinas").orderBy("nome", "asc").get(),
    db.collection("professores").orderBy("nome", "asc").get(),
  ]);

  const disciplinas = disciplinasSnap.docs.map((doc) => fromDoc<Disciplina>(doc));
  const disciplinasPorId = new Map(disciplinas.map((d) => [d.id, d]));
  const professores = professoresSnap.docs.map((doc) => fromDoc<Professor>(doc));
  const professoresPorId = new Map(professores.map((p) => [p.id, p]));

  const aulasBase = minhasAulas.map((aula) => {
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

  async function comMeuCaderno(lista: typeof aulasBase): Promise<AulaComCaderno[]> {
    const cadernos = await buscarMinhasAnotacoesEmLote(lista.map((a) => a.id), user.uid);
    return lista.flatMap((aula) => {
      const minha = cadernos.get(aula.id);
      const temConteudo =
        minha && (minha.resumo || minha.anotacoesLousa || minha.anexos?.length || minha.resumoIA);
      return temConteudo ? [{ ...aula, minha }] : [];
    });
  }

  const [aulasDoDia, aulasDoProfessor] = await Promise.all([
    comMeuCaderno(aulasDoDiaBase),
    comMeuCaderno(aulasDoProfessorBase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">🗓️ Histórico de aulas</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Busque suas anotações e lousas por data ou por professor. Só você vê o que está aqui.
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
                <NotaCard key={aula.id} aula={aula} />
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
                <NotaCard key={aula.id} aula={aula} />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
