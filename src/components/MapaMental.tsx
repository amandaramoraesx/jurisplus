import type { MapaMental as MapaMentalType } from "@/lib/firestore";

// Cores sólidas, cicladas por ramo — mesmo espírito visual do resumo em flashcards.
const CORES = ["bg-blue-600", "bg-purple-600", "bg-amber-500", "bg-green-600", "bg-rose-600", "bg-teal-600"];

export function MapaMental({ mapa }: { mapa: MapaMentalType }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="hero-banner text-center">
        <h3 className="text-lg font-bold">{mapa.titulo}</h3>
        {mapa.subtitulo && <p className="text-sm opacity-85 mt-1">{mapa.subtitulo}</p>}
        {mapa.perguntaCentral && (
          <p className="text-sm mt-3 font-medium bg-black/15 rounded-lg px-3 py-2 inline-block">
            💡 {mapa.perguntaCentral}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mapa.ramos.map((ramo, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
            <div className={`px-3 py-2 flex items-center gap-2 text-white ${CORES[i % CORES.length]}`}>
              <span className="text-lg leading-none">{ramo.icone}</span>
              <span className="text-xs font-bold uppercase tracking-wide opacity-80">{i + 1}</span>
              <h4 className="text-sm font-semibold">{ramo.titulo}</h4>
            </div>
            <ul className="p-3 flex flex-col gap-1.5 bg-[var(--surface)]">
              {ramo.pontos.map((ponto, j) => (
                <li key={j} className="text-sm text-foreground/85 flex gap-1.5">
                  <span className="text-foreground/40 shrink-0">•</span>
                  {ponto}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
