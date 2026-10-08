import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina, type VadeMecumFavorito } from "@/lib/firestore";
import { requireUser } from "@/lib/auth";
import { buscarMinhaAnotacao, participaDaAula, textoDaAnotacao } from "@/lib/anotacoes";
import {
  updateAula,
  deleteAula,
  salvarAnotacaoPessoal,
  gerarResumoIA,
  gerarQuizAula,
  gerarMapaMentalAula,
  adicionarAnexoAula,
  removerAnexoAula,
} from "../actions";
import { isIAConfigured } from "@/lib/anthropic";
import { SubmitButton } from "@/components/SubmitButton";
import { QuizPlayer } from "@/components/QuizPlayer";
import { AnexoIcone, formatBytes } from "@/components/Anexo";
import { ResumoCards } from "@/components/ResumoCards";
import { ShareButton } from "@/components/ShareButton";
import { MapaMental } from "@/components/MapaMental";
import { EditorAnotacao } from "@/components/EditorAnotacao";

export const dynamic = "force-dynamic";

export default async function AulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const aulaDoc = await db.collection("aulas").doc(id).get();
  if (!aulaDoc.exists) notFound();
  const aulaBase = fromDoc<Aula>(aulaDoc);
  // Cada login só enxerga as aulas de que participa.
  if (!participaDaAula(aulaBase, user.uid)) notFound();

  const [disciplinaDoc, favoritosSnap, minhaAnotacao] = await Promise.all([
    db.collection("disciplinas").doc(aulaBase.disciplinaId).get(),
    // Favoritos do Vade Mecum são de cada um.
    db.collection("vademecum_favoritos").where("aulaId", "==", id).where("uid", "==", user.uid).get(),
    buscarMinhaAnotacao(id, user.uid),
  ]);

  if (!disciplinaDoc.exists) notFound();

  const aula = {
    ...aulaBase,
    disciplina: fromDoc<Disciplina>(disciplinaDoc),
    favoritosVadeMecum: favoritosSnap.docs.map((doc) => fromDoc<VadeMecumFavorito>(doc)),
  };

  // Tudo abaixo vem do caderno pessoal do login — ninguém vê o de ninguém.
  const meuTexto = textoDaAnotacao(minhaAnotacao);
  const temConteudo = Boolean(meuTexto);
  const resumoIA = minhaAnotacao?.resumoIA ?? null;
  const quizIA = minhaAnotacao?.quizIA ?? null;
  const mapaMental = minhaAnotacao?.mapaMental ?? null;
  const anexos = minhaAnotacao?.anexos ?? [];
  const textoParaCards = resumoIA || meuTexto;

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
        <p className="text-sm text-foreground/60 mt-0.5">
          {aula.disciplina.nome} ·{" "}
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(aula.data)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/aulas/${aula.id}/imprimir`} className="btn-primary">
          🖨️ Ver / Salvar em PDF
        </Link>
        <ShareButton aulaId={aula.id} title={aula.tema} className="btn-primary" />
      </div>

      <section id="minhas-anotacoes" className="card flex flex-col gap-3 scroll-mt-24">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="icon-badge bg-blue-600/10 text-blue-700 dark:text-blue-400">📝</span>
            Minhas anotações
          </h2>
          <span className="text-xs text-foreground/50 text-right">🔒 Só você vê</span>
        </div>
        <EditorAnotacao
          action={salvarAnotacaoPessoal.bind(null, aula.id)}
          resumoInicial={minhaAnotacao?.resumo ?? ""}
          lousaInicial={minhaAnotacao?.anotacoesLousa ?? ""}
          titulo={`${aula.disciplina.nome} — ${aula.tema}`}
        />
      </section>

      <details className="disclosure card">
        <summary className="text-foreground/70 font-medium">✏️ Editar tema/data da aula</summary>
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
          <div className="flex gap-3">
            <SubmitButton>Salvar</SubmitButton>
          </div>
        </form>
      </details>

      <details className="disclosure card" open={anexos.length > 0}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">
            📎 Anexos {anexos.length ? `(${anexos.length})` : ""}
          </h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {anexos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {anexos.map((anexo) => (
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
                  <form action={removerAnexoAula.bind(null, aula.id, anexo.id)}>
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
          {isIAConfigured() && temConteudo && (
            <form action={gerarResumoIA.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {resumoIA ? "Gerar novamente" : "Gerar resumo"}
              </button>
            </form>
          )}
          {!isIAConfigured() ? (
            <p className="text-xs text-foreground/50">
              Recurso de IA ainda não configurado neste app.
            </p>
          ) : resumoIA ? (
            <p className="text-sm whitespace-pre-wrap">{resumoIA}</p>
          ) : (
            <p className="text-xs text-foreground/50">
              Escreva suas anotações e clique em &ldquo;Gerar resumo&rdquo; para ter uma síntese
              pronta para revisão. Usa só as suas anotações, e só você vê.
            </p>
          )}
        </div>
      </details>

      <details className="disclosure card" open={Boolean(textoParaCards)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">🗂️ Resumo em cards</h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="mt-3">
          {textoParaCards ? (
            <>
              <p className="text-xs text-foreground/50 mb-3">
                Um ponto-chave por vez, bem simples: arraste pro lado no celular ou use as setas
                pra passar de card em card.
              </p>
              <ResumoCards texto={textoParaCards} />
            </>
          ) : (
            <p className="text-xs text-foreground/50">
              Escreva suas anotações (ou gere o resumo inteligente) para ver aqui um resumo em
              cards, rápido de revisar antes da prova.
            </p>
          )}
        </div>
      </details>

      <details className="disclosure card" open={Boolean(mapaMental)}>
        <summary className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground/70">🗺️ Mapa mental da aula</h2>
          <span className="btn-ghost shrink-0">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {isIAConfigured() && temConteudo && (
            <form action={gerarMapaMentalAula.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {mapaMental ? "Gerar outro mapa mental" : "Gerar mapa mental"}
              </button>
            </form>
          )}
          {!isIAConfigured() ? (
            <p className="text-xs text-foreground/50">Recurso de IA ainda não configurado neste app.</p>
          ) : mapaMental ? (
            <MapaMental mapa={mapaMental} />
          ) : (
            <p className="text-xs text-foreground/50">
              Escreva suas anotações e clique em &ldquo;Gerar mapa mental&rdquo; pra organizar a
              matéria em um infográfico por tópicos, tipo mapa mental.
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
          {isIAConfigured() && temConteudo && (
            <form action={gerarQuizAula.bind(null, aula.id)}>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                {quizIA?.length ? "Gerar outro quiz" : "Gerar quiz"}
              </button>
            </form>
          )}
          {!isIAConfigured() ? (
            <p className="text-xs text-foreground/50">Recurso de IA ainda não configurado neste app.</p>
          ) : quizIA?.length ? (
            <QuizPlayer perguntas={quizIA} />
          ) : (
            <p className="text-xs text-foreground/50">
              Escreva suas anotações e clique em &ldquo;Gerar quiz&rdquo; para treinar essa aula.
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
        <button type="submit" className="btn-danger-text">
          Remover esta aula da minha lista
        </button>
        <p className="text-xs text-foreground/45 mt-1">
          Apaga suas anotações, anexos e conteúdo de IA desta aula. Não afeta os colegas.
        </p>
      </form>
    </div>
  );
}
