import "dotenv/config";
import { db } from "../src/lib/firebase-admin";
import {
  buscarHtmlLatin1,
  htmlParaTexto,
  extrairArtigos,
  dedupPorMaisCompleto,
  type ArtigoExtraido,
} from "../src/lib/vademecum-import";

const FONTES: { codigo: string; nome: string; url: string }[] = [
  { codigo: "CF", nome: "Constituição Federal", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" },
  { codigo: "CC", nome: "Código Civil", url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm" },
  { codigo: "CP", nome: "Código Penal", url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm" },
  { codigo: "CPC", nome: "Código de Processo Civil", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm" },
];

async function extrairCodigo(fonte: (typeof FONTES)[number]): Promise<ArtigoExtraido[]> {
  const html = await buscarHtmlLatin1(fonte.url);

  if (fonte.codigo === "CF") {
    // A Constituição reaproveita a numeração (Art. 1º, 2º...) no ADCT em anexo —
    // separamos em dois "códigos" pra não colidir.
    const marcador = html.search(/<a name="adct">/i);
    const htmlPrincipal = marcador === -1 ? html : html.slice(0, marcador);
    const htmlAdct = marcador === -1 ? "" : html.slice(marcador);

    const principal = dedupPorMaisCompleto(extrairArtigos(htmlParaTexto(htmlPrincipal), "CF", fonte.url));
    const adct = htmlAdct
      ? dedupPorMaisCompleto(extrairArtigos(htmlParaTexto(htmlAdct), "ADCT", fonte.url))
      : [];
    return [...principal, ...adct];
  }

  return dedupPorMaisCompleto(extrairArtigos(htmlParaTexto(html), fonte.codigo, fonte.url));
}

async function main() {
  const todos: ArtigoExtraido[] = [];

  for (const fonte of FONTES) {
    console.log(`Buscando ${fonte.nome} (${fonte.codigo})...`);
    const artigos = await extrairCodigo(fonte);
    console.log(`  -> ${artigos.length} artigos extraídos.`);
    todos.push(...artigos);
  }

  console.log(`\nTotal extraído: ${todos.length} artigos. Gravando no Firestore...`);

  let criados = 0;
  let atualizados = 0;
  let ignorados = 0;
  let processados = 0;

  const LOTE = 25;
  for (let i = 0; i < todos.length; i += LOTE) {
    const fatia = todos.slice(i, i + LOTE);
    await Promise.all(
      fatia.map(async (artigo) => {
        const existenteSnap = await db
          .collection("vademecum_artigos")
          .where("codigo", "==", artigo.codigo)
          .where("numero", "==", artigo.numero)
          .limit(1)
          .get();

        if (existenteSnap.empty) {
          await db.collection("vademecum_artigos").add({
            codigo: artigo.codigo,
            numero: artigo.numero,
            texto: artigo.texto,
            fonte: artigo.fonte,
          });
          criados++;
          return;
        }

        const doc = existenteSnap.docs[0];
        const dados = doc.data();
        if (!dados.fonte) {
          // Documento sem "fonte" = foi cadastrado manualmente por um usuário. Não mexe.
          ignorados++;
          return;
        }

        await doc.ref.update({ texto: artigo.texto, fonte: artigo.fonte });
        atualizados++;
      })
    );
    processados += fatia.length;
    console.log(`  ${processados}/${todos.length} processados...`);
  }

  console.log(`\nConcluído: ${criados} criados, ${atualizados} atualizados, ${ignorados} ignorados (cadastrados manualmente).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
