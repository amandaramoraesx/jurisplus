import { db } from "@/lib/firebase-admin";
import { fromDoc, type Palestra } from "@/lib/firestore";
import { createPalestra, updatePalestra, deletePalestra } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function PalestrasPage() {
  const palestrasSnap = await db.collection("palestras").orderBy("data", "desc").get();
  const palestras = palestrasSnap.docs.map((doc) => fromDoc<Palestra>(doc));
  const totalHoras = palestras.reduce((acc, p) => acc + p.horas, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Palestras e horas complementares</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Total acumulado: <span className="font-semibold">{totalHoras}h</span>
        </p>
      </div>

      <details className="disclosure card">
        <summary className="section-title">Nova atividade</summary>
        <form action={createPalestra} className="flex flex-col gap-3 mt-3">
          <input name="tema" placeholder="Tema da palestra" required className="field" />
          <input name="palestrante" placeholder="Palestrante (opcional)" className="field" />
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              name="data"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="field"
            />
            <input
              name="horas"
              placeholder="Horas (ex: 2)"
              inputMode="decimal"
              required
              className="w-32 field"
            />
            <input name="local" placeholder="Local (opcional)" className="flex-1 field" />
          </div>
          <textarea
            name="resumo"
            placeholder="Resumo do que foi apresentado"
            rows={2}
            className="field"
          />
          <button type="submit" className="self-start btn-primary">
            Adicionar
          </button>
        </form>
      </details>

      <div className="flex flex-col gap-3">
        {palestras.length === 0 && (
          <p className="text-sm text-foreground/60">Nenhuma palestra registrada ainda.</p>
        )}
        {palestras.map((p) => (
          <div key={p.id} className="card flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{p.tema}</p>
                {p.palestrante && (
                  <p className="text-xs text-foreground/70">Por {p.palestrante}</p>
                )}
              </div>
              <span className="text-xs text-foreground/60 shrink-0">
                {formatDate(p.data)} · {p.horas}h
              </span>
            </div>
            {p.local && <p className="text-xs text-foreground/60">{p.local}</p>}
            {p.resumo && <p className="text-sm mt-1">{p.resumo}</p>}

            <details className="disclosure text-sm mt-1">
              <summary className="text-foreground/70 font-medium">Editar</summary>
              <form
                action={updatePalestra.bind(null, p.id)}
                className="flex flex-col gap-2 mt-3"
              >
                <input name="tema" defaultValue={p.tema} required className="field" />
                <input
                  name="palestrante"
                  defaultValue={p.palestrante ?? ""}
                  placeholder="Palestrante (opcional)"
                  className="field"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    name="data"
                    type="date"
                    required
                    defaultValue={p.data.toISOString().slice(0, 10)}
                    className="field"
                  />
                  <input
                    name="horas"
                    defaultValue={p.horas}
                    inputMode="decimal"
                    required
                    className="w-32 field"
                  />
                  <input
                    name="local"
                    defaultValue={p.local ?? ""}
                    placeholder="Local (opcional)"
                    className="flex-1 field"
                  />
                </div>
                <textarea
                  name="resumo"
                  defaultValue={p.resumo ?? ""}
                  placeholder="Resumo do que foi apresentado"
                  rows={2}
                  className="field"
                />
                <button type="submit" className="self-start btn-primary">
                  Salvar alterações
                </button>
              </form>
            </details>

            <form action={deletePalestra.bind(null, p.id)} className="self-start">
              <button type="submit" className="btn-danger-text">
                Remover
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
