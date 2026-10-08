"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { Colega } from "@/lib/colegas";

type Aba = "anotacoes" | "lousa";

function contarPalavras(texto: string) {
  const limpo = texto.trim();
  return limpo ? limpo.split(/\s+/).length : 0;
}

/**
 * Editor espaçoso das anotações pessoais de uma aula: abas "Anotações" e "Lousa", área de escrita
 * grande que cresce com o texto, modo tela cheia pra escrever durante a aula e tamanho de letra
 * ajustável. Os dois textos vão sempre no mesmo form (a aba escondida continua sendo enviada).
 */
export function EditorAnotacao({
  action,
  resumoInicial,
  lousaInicial,
  titulo,
  rodapeExtra,
  colegas = [],
  compartilhadoComInicial = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  resumoInicial: string;
  lousaInicial: string;
  titulo?: string;
  rodapeExtra?: React.ReactNode;
  /** Logins com quem dá pra compartilhar (só anotação e lousa, só leitura). */
  colegas?: Colega[];
  compartilhadoComInicial?: string[];
}) {
  const [aba, setAba] = useState<Aba>("anotacoes");
  // Controlados de propósito: o React reseta forms não controlados depois da action.
  const [resumo, setResumo] = useState(resumoInicial);
  const [lousa, setLousa] = useState(lousaInicial);
  const [telaCheia, setTelaCheia] = useState(false);
  const [letraGrande, setLetraGrande] = useState(false);
  const [compartilhadoCom, setCompartilhadoCom] = useState<string[]>(compartilhadoComInicial);
  const [escolhendo, setEscolhendo] = useState(false);
  const nomesCompartilhados = colegas.filter((c) => compartilhadoCom.includes(c.uid)).map((c) => c.nome.split(" ")[0]);

  function alternarColega(uid: string) {
    setCompartilhadoCom((atual) => (atual.includes(uid) ? atual.filter((u) => u !== uid) : [...atual, uid]));
  }
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!telaCheia) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTelaCheia(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [telaCheia]);

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const textoAtual = aba === "anotacoes" ? resumo : lousa;
  const tamanhoLetra = letraGrande ? "text-lg leading-8" : "text-base leading-7";

  return (
    <form
      ref={formRef}
      action={action}
      onKeyDown={onKeyDown}
      className={
        telaCheia
          ? "editor-anotacao fixed inset-0 z-50 flex flex-col gap-3 bg-[var(--background)] p-3 sm:p-6"
          : "editor-anotacao flex flex-col gap-3"
      }
    >
      {telaCheia && titulo && <p className="text-sm font-semibold text-foreground/70 truncate">{titulo}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="editor-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "anotacoes"}
            onClick={() => setAba("anotacoes")}
            className="editor-tab"
          >
            📝 Anotações
            {resumo.trim() && <span className="editor-tab-dot" aria-hidden />}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "lousa"}
            onClick={() => setAba("lousa")}
            className="editor-tab"
          >
            🧑‍🏫 Lousa
            {lousa.trim() && <span className="editor-tab-dot" aria-hidden />}
          </button>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setLetraGrande((v) => !v)}
            className="editor-tool"
            title={letraGrande ? "Diminuir letra" : "Aumentar letra"}
            aria-pressed={letraGrande}
          >
            {letraGrande ? "A−" : "A+"}
          </button>
          <button
            type="button"
            onClick={() => setTelaCheia((v) => !v)}
            className="editor-tool"
            title={telaCheia ? "Sair da tela cheia (Esc)" : "Escrever em tela cheia"}
          >
            {telaCheia ? "✕ Fechar" : "⛶ Tela cheia"}
          </button>
        </div>
      </div>

      <div className={telaCheia ? "flex-1 min-h-0 flex flex-col" : "flex flex-col"}>
        <textarea
          name="resumo"
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          hidden={aba !== "anotacoes"}
          placeholder="Escreva aqui suas anotações da aula: conceitos, exemplos, dúvidas, o que vai cair na prova..."
          aria-label="Anotações"
          className={`editor-area ${tamanhoLetra} ${telaCheia ? "flex-1" : ""}`}
        />
        <textarea
          name="anotacoesLousa"
          value={lousa}
          onChange={(e) => setLousa(e.target.value)}
          hidden={aba !== "lousa"}
          placeholder="Copie aqui o que o professor escreveu na lousa..."
          aria-label="Lousa"
          className={`editor-area editor-lousa ${tamanhoLetra} ${telaCheia ? "flex-1" : ""}`}
        />
      </div>

      {/* Sempre no form (mesmo com a lista fechada) pra salvar a escolha junto com o texto. */}
      {compartilhadoCom.map((uid) => (
        <input key={uid} type="hidden" name="compartilhadoCom" value={uid} />
      ))}

      {escolhendo && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-foreground/70">
            Com quem compartilhar? Eles só leem sua anotação e lousa desta aula.
          </p>
          {colegas.length === 0 ? (
            <p className="text-xs text-foreground/50">Ainda não tem outros logins no Juris+.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colegas.map((colega) => {
                const marcado = compartilhadoCom.includes(colega.uid);
                return (
                  <button
                    key={colega.uid}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => alternarColega(colega.uid)}
                    className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                      marcado
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                        : "border-black/15 dark:border-white/20 text-foreground/75"
                    }`}
                  >
                    {marcado ? "✓ " : ""}
                    {colega.nome}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-foreground/45">Toque em Salvar pra confirmar.</p>
        </div>
      )}

      <div className="editor-rodape">
        <button
          type="button"
          onClick={() => setEscolhendo((v) => !v)}
          aria-expanded={escolhendo}
          className="editor-tool !px-2 text-left"
        >
          {nomesCompartilhados.length > 0
            ? `👥 Compartilhada com ${nomesCompartilhados.join(", ")}`
            : "🔒 Só você vê · 👥 Compartilhar"}
        </button>
        <span className="text-[11px] text-foreground/45 hidden sm:inline">
          {contarPalavras(textoAtual)} palavras · Ctrl+S salva
        </span>
        <div className="flex items-center gap-3 ml-auto">
          {rodapeExtra}
          <SubmitButton savedLabel="Salvo!" pendingLabel="Salvando..." className="btn-primary">
            💾 Salvar
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
