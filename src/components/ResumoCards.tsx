const ICONES = ["📘", "🔑", "⚖️", "📌", "💡", "🧩", "🗂️", "✨", "📎", "🎯"];

const CORES = [
  "bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/20",
  "bg-purple-600/10 text-purple-700 dark:text-purple-400 border-purple-600/20",
  "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/20",
  "bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20",
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

export function ResumoCards({ texto }: { texto: string }) {
  const topicos = dividirEmTopicos(texto);
  if (topicos.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {topicos.map((topico, i) => (
        <div
          key={i}
          className={`rounded-xl border p-3 flex gap-2.5 items-start ${CORES[i % CORES.length]}`}
        >
          <span className="text-xl leading-none shrink-0">{ICONES[i % ICONES.length]}</span>
          <p className="text-sm">{topico}</p>
        </div>
      ))}
    </div>
  );
}
