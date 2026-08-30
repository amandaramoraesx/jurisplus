import { db } from "@/lib/firebase-admin";
import { fromDoc, type Aula, type Disciplina, type VadeMecumArtigo, type VadeMecumFavorito } from "@/lib/firestore";
import { criarArtigo, favoritarArtigo, vincularFavoritoAula, removeFavorito } from "./actions";

export const dynamic = "force-dynamic";

function correspondeAoTermo(artigo: VadeMecumArtigo, termo: string) {
  const palavras = termo.toLowerCase().split(/\s+/).filter(Boolean);
  const alvo = `${artigo.codigo} ${artigo.numero} ${artigo.texto}`.toLowerCase();
  return palavras.every((palavra) => alvo.includes(palavra));
}

export default async function VadeMecumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = (q || "").trim();

  const [artigosSnap, favoritosSnap, aulasSnap, disciplinasSnap] = await Promise.all([
    termo ? db.collection("vademecum_artigos").get() : Promise.resolve(null),
    db.collection("vademecum_favoritos").orderBy("createdAt", "desc").get(),
    db.collection("aulas").orderBy("data", "desc").get(),
    db.collection("disciplinas").get(),
  ]);

  const disciplinasPorId = new Map(
    disciplinasSnap.docs.map((doc) => [doc.id, fromDoc<Disciplina>(doc)])
  );
  const aulas = aulasSnap.docs.map((doc) => {
    const aula = fromDoc<Aula>(doc);
    return { ...aula, disciplina: disciplinasPorId.get(aula.disciplinaId)! };
  });

  const resultados = artigosSnap
    ? artigosSnap.docs
        .map((doc) => fromDoc<VadeMecumArtigo>(doc))
        .filter((artigo) => correspondeAoTermo(artigo, termo))
        .slice(0, 20)
    : [];

  const favoritos = favoritosSnap.docs.map((doc) => fromDoc<VadeMecumFavorito>(doc));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Vade Mecum digital</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Busque por código, número ou palavras do texto de um artigo que você mesma cadastrou aqui embaixo.
        </p>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={termo}
          placeholder='Ex: "CC 186", "homicídio", "art. 5"...'
          className="flex-1 field"
        />
        <button
          type="submit"
          className="btn-primary"
        >
          🔍 Buscar
        </button>
      </form>

      <details className="disclosure card">
        <summary className="font-semibold text-sm text-foreground/70">Cadastrar artigo</summary>
        <form action={criarArtigo} className="flex flex-col gap-3 mt-3">
          <div className="flex gap-3">
            <input name="codigo" placeholder="Código (ex: CF, CC, CP, CPC)" required className="w-32 field" />
            <input name="numero" placeholder="Número (ex: 5º, 186)" required className="flex-1 field" />
          </div>
          <textarea
            name="texto"
            placeholder="Texto completo do artigo"
            required
            rows={3}
            className="field"
          />
          <button type="submit" className="self-start btn-primary">
            Adicionar ao Vade Mecum
          </button>
        </form>
      </details>

      {termo && (
        <div className="flex flex-col gap-3">
          {resultados.length === 0 && (
            <p className="text-sm text-foreground/60">
              Nenhum artigo encontrado para &ldquo;{termo}&rdquo;. Use &ldquo;Cadastrar artigo&rdquo; acima
              para adicionar os artigos que você quer poder buscar depois.
            </p>
          )}
          {resultados.map((artigo) => (
            <div
              key={artigo.id}
              className="card flex flex-col gap-2"
            >
              <p className="font-semibold text-sm">
                {artigo.codigo}, art. {artigo.numero}
              </p>
              <p className="text-sm text-foreground/80">{artigo.texto}</p>
              <form action={favoritarArtigo} className="flex flex-wrap items-center gap-2 mt-1">
                <input type="hidden" name="codigo" value={artigo.codigo} />
                <input type="hidden" name="numero" value={artigo.numero} />
                <input type="hidden" name="texto" value={artigo.texto} />
                <select
                  name="aulaId"
                  defaultValue=""
                  className="text-xs rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-2 py-1"
                >
                  <option value="">Vincular a uma aula (opcional)</option>
                  {aulas.map((aula) => (
                    <option key={aula.id} value={aula.id}>
                      {aula.disciplina.nome} · {aula.tema}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
                >
                  ★ Favoritar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold px-1">Favoritos</h2>
        {favoritos.length === 0 && (
          <p className="text-sm text-foreground/60">
            Nenhum artigo favoritado ainda. Busque acima e favorite os que mais usar.
          </p>
        )}
        {favoritos.map((fav) => (
          <div
            key={fav.id}
            className="card flex flex-col gap-2"
          >
            <div className="flex items-start justify-between">
              <p className="font-semibold text-sm">
                {fav.codigo}, art. {fav.numero}
              </p>
              <form action={removeFavorito.bind(null, fav.id)}>
                <button
                  type="submit"
                  className="btn-danger-text"
                >
                  remover
                </button>
              </form>
            </div>
            <p className="text-sm text-foreground/80">{fav.texto}</p>
            <form action={vincularFavoritoAula.bind(null, fav.id)} className="flex items-center gap-2">
              <select
                name="aulaId"
                defaultValue={fav.aulaId ?? ""}
                className="text-xs rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-2 py-1"
              >
                <option value="">Sem aula vinculada</option>
                {aulas.map((aula) => (
                  <option key={aula.id} value={aula.id}>
                    {aula.disciplina.nome} · {aula.tema}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1"
              >
                Salvar vínculo
              </button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
