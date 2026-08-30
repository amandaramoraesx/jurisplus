"use client";

import { useState } from "react";
import type { QuizPergunta } from "@/lib/firestore";

export function QuizPlayer({ perguntas }: { perguntas: QuizPergunta[] }) {
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [corrigido, setCorrigido] = useState(false);

  const acertos = perguntas.reduce((acc, p, i) => acc + (respostas[i] === p.respostaCorreta ? 1 : 0), 0);
  const respondeuTudo = Object.keys(respostas).length === perguntas.length;

  function escolher(perguntaIndex: number, opcaoIndex: number) {
    if (corrigido) return;
    setRespostas((prev) => ({ ...prev, [perguntaIndex]: opcaoIndex }));
  }

  function reiniciar() {
    setRespostas({});
    setCorrigido(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {corrigido && (
        <p className="text-sm font-semibold">
          Você acertou {acertos} de {perguntas.length}.
        </p>
      )}

      {perguntas.map((pergunta, i) => {
        const escolhida = respostas[i];
        return (
          <div key={i} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex flex-col gap-2">
            <p className="text-sm font-medium">
              {i + 1}. {pergunta.pergunta}
            </p>
            <div className="flex flex-col gap-1">
              {pergunta.opcoes.map((opcao, oi) => {
                const selecionada = escolhida === oi;
                const ehCorreta = corrigido && oi === pergunta.respostaCorreta;
                const ehErradaEscolhida = corrigido && selecionada && oi !== pergunta.respostaCorreta;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => escolher(i, oi)}
                    className={`text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                      ehCorreta
                        ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                        : ehErradaEscolhida
                          ? "border-red-600 bg-red-600/10 text-red-600 dark:text-red-400"
                          : selecionada
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-black/10 dark:border-white/10"
                    }`}
                  >
                    {opcao}
                  </button>
                );
              })}
            </div>
            {corrigido && pergunta.explicacao && (
              <p className="text-xs text-foreground/60 mt-1">💡 {pergunta.explicacao}</p>
            )}
          </div>
        );
      })}

      <div className="flex gap-3">
        {!corrigido ? (
          <button
            type="button"
            onClick={() => setCorrigido(true)}
            disabled={!respondeuTudo}
            className="self-start btn-primary disabled:opacity-40"
          >
            Corrigir
          </button>
        ) : (
          <button type="button" onClick={reiniciar} className="self-start btn-ghost">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}
