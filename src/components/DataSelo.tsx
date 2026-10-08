/** Selo compacto de data (dia da semana, dia, mês). Datas de aula são meia-noite UTC. */
export function DataSelo({ data }: { data: Date }) {
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(data).replace(".", "");

  return (
    <span className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] py-1">
      <span className="text-[10px] uppercase leading-none">{fmt({ weekday: "short" })}</span>
      <span className="text-lg font-bold leading-tight">{fmt({ day: "2-digit" })}</span>
      <span className="text-[10px] uppercase leading-none">{fmt({ month: "short" })}</span>
    </span>
  );
}
