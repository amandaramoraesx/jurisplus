import { prisma } from "@/lib/prisma";
import { createPalestra, deletePalestra } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function PalestrasPage() {
  const palestras = await prisma.palestra.findMany({ orderBy: { data: "desc" } });
  const totalHoras = palestras.reduce((acc, p) => acc + p.horas, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Palestras e horas complementares</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Total acumulado: <span className="font-semibold">{totalHoras}h</span>
        </p>
      </div>

      <form
        action={createPalestra}
        className="flex flex-col gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
      >
        <h2 className="font-semibold text-sm text-foreground/70">Nova atividade</h2>
        <input
          name="tema"
          placeholder="Tema da palestra"
          required
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            name="data"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="horas"
            placeholder="Horas (ex: 2)"
            inputMode="decimal"
            required
            className="w-32 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <input
            name="local"
            placeholder="Local (opcional)"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <textarea
          name="resumo"
          placeholder="Resumo do que foi apresentado"
          rows={2}
          className="rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          Adicionar
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {palestras.length === 0 && (
          <p className="text-sm text-foreground/60">Nenhuma palestra registrada ainda.</p>
        )}
        {palestras.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-1"
          >
            <div className="flex items-start justify-between">
              <p className="font-semibold">{p.tema}</p>
              <span className="text-xs text-foreground/60">
                {formatDate(p.data)} · {p.horas}h
              </span>
            </div>
            {p.local && <p className="text-xs text-foreground/60">{p.local}</p>}
            {p.resumo && <p className="text-sm mt-1">{p.resumo}</p>}
            <form action={deletePalestra.bind(null, p.id)} className="self-start mt-1">
              <button
                type="submit"
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Remover
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
