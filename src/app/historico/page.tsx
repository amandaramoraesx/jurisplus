import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { dateOnlyKey, fromDoc, type Aula, type Disciplina, type Professor, type AnotacaoPessoal } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { AnexoIcone, formatBytes } from "@/components/Anexo";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
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

function NotaCard({ aula }: { aula: AulaComNotasVisiveis }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">{aula.disciplina?.nome ?? "Disciplina removida"}</p>
        <span className="text-xs text-foreground/50 shrink-0">
          {aula.professor ? aula.professor.nome : "sem professor"}
        </span>
      </div>
      <p className="text-xs text-foreground/60 mt-0.5">{aula.tema}</p>
      {(aula.resumo || aula.anotacoesLousa) && (
        <div className="mt-2">
          {aula.resumo && <p className="text-sm whitespace-pre-wrap">{aula.resumo}</p>}
          {aula.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{aula.anotacoesLousa}</p>
          )}
        </div>
      )}
      {aula.notasVisiveis.map((nota) => (
        <div key={nota.id} className="mt-2">
          <p className="text-[10px] font-semibold text-foreground/50">
            {nota.compartilhado ? `🌐 ${nota.nome}` : "🔒 minha anotação"}
          </p>
          {nota.resumo && <p className="text-sm whitespace-pre-wrap">{nota.resumo}</p>}
          {nota.anotacoesLousa && (
            <p className="text-sm whitespace-pre-wrap font-mono mt-1">{nota.anotacoesLousa}</p>
          )}
        </div>
      ))}
      {aula.anexos && aula.anexos.length > 0 && (
        <ul className="flex flex-col gap-1 mt-2">
          {aula.anexos.map((anexo) => (
            <li key={anexo.id}>
              <a
                href={`/api/anexos/${aula.id}/${anexo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs hover:underline"
              >
                <AnexoIcone tipo={anexo.tipo} />
                <span className="truncate">{anexo.nome}</span>
                <span className="text-foreground/50 shrink-0">({formatBytes(anexo.tamanho)})</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-black/10 dark:border-white/10">
        <Link href={`/aulas/${aula.id}`} className="btn-ghost">
          ✏️ Editar
        </Link>
        <Link href={`/aulas/${aula.id}/imprimir`} className="btn-ghost">
          🖨️ Ver / PDF
        </Link>
        <ShareButton title={aula.tema} text={textoParaCompartilhar(aula)} />
      </div>
    </div>
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
        <h1 className="text-2xl font-bold">🗓️ Histórico de anotações</h1>
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
            <div className="flex flex-col gap-3">
              {aulasDoDia.length === 0 && (
                <p className="text-sm text-foreground/60">
                  Nenhuma anotação registrada em {formatDate(new Date(`${dataSelecionada}T00:00:00`))}.
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
            <div className="flex flex-col gap-3">
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
