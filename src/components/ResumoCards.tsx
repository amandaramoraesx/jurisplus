"use client";

import { useRef, useState } from "react";

const ICONES = ["📘", "🔑", "⚖️", "📌", "💡", "🧩", "🗂️", "✨", "📎", "🎯"];

// Fundo sólido e colorido (tipo cartão/pôster), não só um tom leve — pra ficar visual de verdade.
const CORES = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-500",
  "bg-green-600",
  "bg-rose-600",
  "bg-teal-600",
];

/** Quebra o resumo (IA ou anotação livre) em tópicos curtos pra virar cards. */
function dividirEmTopicos(texto: string): string[] {
  const linhasComMarcador = texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .filter((linha) => /^([-•*]|\d+[.)])\s+/.test(linha));

  const base =
    linhasComMarcador.length >= 2
      ? linhasComMarcador
      : texto
          .split(/\n{2,}/)
          .map((paragrafo) => paragrafo.trim())
          .filter(Boolean);

  return base
    .map((linha) => linha.replace(/^([-•*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Resumo em formato de flashcard: um ponto por vez, grande e colorido — arrasta ou usa as setas. */
export function ResumoCards({ texto }: { texto: string }) {
  const topicos = dividirEmTopicos(texto);
  const [indice, setIndice] = useState(0);
  const inicioToque = useRef<number | null>(null);

  if (topicos.length === 0) return null;

  const ultimo = topicos.length - 1;
  const anterior = () => setIndice((i) => Math.max(0, i - 1));
  const proximo = () => setIndice((i) => Math.min(ultimo, i + 1));

  function aoTocar(e: React.TouchEvent) {
    inicioToque.current = e.touches[0].clientX;
  }
  function aoSoltarToque(e: React.TouchEvent) {
    if (inicioToque.current === null) return;
    const delta = e.changedTouches[0].clientX - inicioToque.current;
    if (delta > 50) anterior();
    else if (delta < -50) proximo();
    inicioToque.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onTouchStart={aoTocar}
        onTouchEnd={aoSoltarToque}
        className={`w-full min-h-[190px] rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 text-white transition-colors ${CORES[indice % CORES.length]}`}
      >
        <span className="text-4xl leading-none">{ICONES[indice % ICONES.length]}</span>
        <p className="text-base font-medium leading-relaxed">{topicos[indice]}</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={anterior}
          disabled={indice === 0}
          className="btn-ghost disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="text-xs text-foreground/50 tabular-nums">
          {indice + 1} / {topicos.length}
        </span>
        <button
          type="button"
          onClick={proximo}
          disabled={indice === ultimo}
          className="btn-ghost disabled:opacity-30"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
