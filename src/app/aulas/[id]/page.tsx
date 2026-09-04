import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina, type VadeMecumFavorito } from "@/lib/firestore";
import {
  updateAula,
  deleteAula,
  gerarResumoIA,
  gerarQuizAula,
  adicionarAnexoAula,
  removerAnexoAula,
} from "../actions";
import { isIAConfigured } from "@/lib/anthropic";
import { SubmitButton } from "@/components/SubmitButton";
import { QuizPlayer } from "@/components/QuizPlayer";
import { AnexoIcone, formatBytes } from "@/components/Anexo";
import { ResumoCards } from "@/components/ResumoCards";

export const dynamic = "force-dynamic";

export default async function AulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) notFound();
  const aulaBase = fromDoc<Aula>(aulaDoc);

  const [disciplinaDoc, favoritosSnap] = await Promise.all([
    db.collection("disciplinas").doc(aulaBase.disciplinaId).get(),
    db.collection("vademecum_favoritos").where("aulaId", "==", id).get(),
  ]);

  if (!disciplinaDoc.exists) notFound();

  const aula = {
    ...aulaBase,
    disciplina: fromDoc<Disciplina>(disciplinaDoc),
    favoritosVadeMecum: favoritosSnap.docs.map((doc) => fromDoc<VadeMecumFavorito>(doc)),
  };

  const temConteudo = Boolean(aula.resumo || aula.anotacoesLousa || aula.resumoIA);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/aulas?abrir=disciplinas#${aula.disciplinaId}`}
          className="text-xs text-foreground/60 hover:underline"
        >
          ← {aula.disciplina.nome}
        </Link>
        <h1 className="text-2xl font-bold mt-1">{aula.tema}</h1>
      </div>

      <section className="card">
        {!temConteudo ? (
          <p className="text-sm text-foreground/60">
            Ainda não tem anotação nem lousa registrada nessa aula.
          </p>
        ) : (
          <details className="disclosure">
            <summary className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Ver anotações</h2>
              <span className="btn-ghost shrink-0">Abrir</span>
            </summary>
            <div className="flex flex-col gap-4 mt-4">
              {aula.resumo && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground/60 mb-1">Anotações</h3>
                  <p className="text-sm whitespace-pre-wrap">{aula.resumo}</p>
                </div>
              )}
              {aula.anotacoesLousa && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground/60 mb-1">Lousa</h3>
                  <p className="text-sm whitespace-pre-wrap font-mono">{aula.anotacoesLousa}</p>
                </div>
              )}
              {aula.resumoIA && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground/60 mb-1">
                    ✨ Resumo inteligente (IA)
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{aula.resumoIA}</p>
                </div>
              )}
              <Link href={`/aulas/${aula.id}/imprimir`} className="btn-primary self-start">
                🖨️ Salvar em PDF / Imprimir
              </Link>
            </div>
          </details>
        )}
      </section>

      <details className="disclosure card">
        <summary className="text-foreground/70 font-medium">✏️ Editar anotações</summary>
        <form
          action={updateAula.bind(null, aula.id)}
          className="flex flex-col gap-3 mt-3"
        >
          <label className="text-xs font-medium text-foreground/60">
            Tema
            <input
              name="tema"
              defaultValue={aula.tema}
              required
              className="mt-1 w-full field"
            />
          </label>
          <label className="text-xs font-medium text-foreground/60">
            Data
            <input
              name="data"
              type="date"
              defaultValue={aula.data.toISOString().slice(0, 10)}
              className="mt-1 w-full field"
            />
          </label>
          <label className="text-xs font-medium text-foreground/60">
            Anotações
            <textarea
              name="resumo"
              defaultValue={aula.resumo ?? ""}
              rows={6}
              placeholder="Escreva aqui suas anotações sobre a aula..."
              className="mt-1 w-full field"
            />
          </label>
          <label className="text-xs font-medium text-foreground/60">
            Lousa
            <textarea
              name="anotacoesLousa"
              defaultValue={aula.anotacoesLousa ?? ""}
              rows={6}
              placeholder="Copie aqui o que o professor escreveu na lousa..."
              className="mt-1 w-full field font-mono"
            />
          </label>
          <div className="flex gap-3">
            <SubmitButton>Salvar</SubmitButton>
          </div>
        </form>
      </details>

      <details className="disclosure card" open={Boolean(aula.anexos?.length)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">
            📎 Anexos {aula.anexos?.length ? `(${aula.anexos.length})` : ""}
          </h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {aula.anexos && aula.anexos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {aula.anexos.map((anexo) => (
                <li
                  key={anexo.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-black/10 dark:border-white/10 p-2"
                >
                  <a
                    href={`/api/anexos/${aula.id}/${anexo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 text-sm hover:underline"
                  >
                    <AnexoIcone tipo={anexo.tipo} />
                    <span className="truncate">{anexo.nome}</span>
                    <span className="text-xs text-foreground/50 shrink-0">
                      {formatBytes(anexo.tamanho)}
                    </span>
                  </a>
                  <form action={removerAnexoAula.bind(null, aula.id, anexo.id, anexo.storagePath)}>
                    <button type="submit" className="text-xs text-foreground/40 hover:text-red-600 shrink-0">
                      Remover
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={adicionarAnexoAula.bind(null, aula.id)} className="flex flex-col gap-2">
            <label className="text-xs font-medium text-foreground/60">
              Anexar PDF, imagem ou slide (opcional)
              <input
                name="arquivo"
                type="file"
                accept=".pdf,.ppt,.pptx,image/*,application/pdf"
                required
                className="mt-1 w-full field"
              />
            </label>
            <SubmitButton className="btn-ghost self-start">Anexar arquivo</SubmitButton>
          </form>
        </div>
      </details>

      <details className="disclosure card">
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">
            ✨ Resumo inteligente (IA)
          </h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {isIAConfigured() && (
            <form action={gerarResumoIA.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {aula.resumoIA ? "Gerar novamente" : "Gerar resumo"}
              </button>
            </form>
          )}
          {!isIAConfigured() ? (
            <p className="text-xs text-foreground/50">
              Recurso de IA ainda não configurado neste app.
            </p>
          ) : aula.resumoIA ? (
            <p className="text-sm whitespace-pre-wrap">{aula.resumoIA}</p>
          ) : (
            <p className="text-xs text-foreground/50">
              Preencha as anotações ou a lousa e clique em &ldquo;Gerar
              resumo&rdquo; para ter uma síntese pronta para revisão.
            </p>
          )}
        </div>
      </details>

      <details className="disclosure card" open={Boolean(aula.resumoIA || aula.resumo)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">🗂️ Resumo em cards</h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="mt-3">
          {aula.resumoIA || aula.resumo ? (
            <ResumoCards texto={aula.resumoIA || aula.resumo || ""} />
          ) : (
            <p className="text-xs text-foreground/50">
              Preencha as anotações (ou gere o resumo inteligente) para ver aqui um resumo em
              cards, rápido de revisar antes da prova.
            </p>
          )}
        </div>
      </details>

      <details className="disclosure card">
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">🧠 Quiz desta aula</h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {isIAConfigured() && (aula.resumo || aula.anotacoesLousa) && (
            <form action={gerarQuizAula.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {aula.quizIA?.length ? "Gerar outro quiz" : "Gerar quiz"}
              </button>
            </form>
          )}
          {!isIAConfigured() ? (
            <p className="text-xs text-foreground/50">Recurso de IA ainda não configurado neste app.</p>
          ) : aula.quizIA?.length ? (
            <QuizPlayer perguntas={aula.quizIA} />
          ) : (
            <p className="text-xs text-foreground/50">
              Preencha as anotações ou a lousa e clique em &ldquo;Gerar quiz&rdquo; para treinar essa aula.
            </p>
          )}
        </div>
      </details>

      {aula.favoritosVadeMecum.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-sm text-foreground/70 mb-2">
            Artigos vinculados a esta aula
          </h2>
          <ul className="flex flex-col gap-2">
            {aula.favoritosVadeMecum.map((fav) => (
              <li key={fav.id} className="text-sm">
                <span className="font-medium">
                  {fav.codigo}, art. {fav.numero}
                </span>
                <p className="text-foreground/70 text-xs mt-0.5">{fav.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={deleteAula.bind(null, aula.id, aula.disciplinaId)}>
        <button
          type="submit"
          className="btn-danger-text"
        >
          Remover esta aula
        </button>
      </form>
    </div>
  );
}
