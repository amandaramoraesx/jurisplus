import "dotenv/config";
import { db } from "../src/lib/firebase-admin";

// Dataset inicial do Vade Mecum digital — pode ser expandido com o tempo.
const artigos = [
  {
    codigo: "CF",
    numero: "1º",
    texto:
      "A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I - a soberania; II - a cidadania; III - a dignidade da pessoa humana; IV - os valores sociais do trabalho e da livre iniciativa; V - o pluralismo político.",
  },
  {
    codigo: "CF",
    numero: "5º",
    texto:
      "Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade...",
  },
  {
    codigo: "CC",
    numero: "1º",
    texto: "Toda pessoa é capaz de direitos e deveres na ordem civil.",
  },
  {
    codigo: "CC",
    numero: "186",
    texto:
      "Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.",
  },
  {
    codigo: "CC",
    numero: "927",
    texto:
      "Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo.",
  },
  {
    codigo: "CP",
    numero: "121",
    texto: "Matar alguém: Pena - reclusão, de seis a vinte anos.",
  },
  {
    codigo: "CP",
    numero: "155",
    texto:
      "Subtrair, para si ou para outrem, coisa alheia móvel: Pena - reclusão, de um a quatro anos, e multa.",
  },
  {
    codigo: "CPC",
    numero: "319",
    texto:
      "A petição inicial indicará: I - o juízo a que é dirigida; II - os nomes, os prenomes, o estado civil...; III - o fato e os fundamentos jurídicos do pedido; IV - o pedido com as suas especificações; V - o valor da causa; VI - as provas com que o autor pretende demonstrar a verdade dos fatos alegados; VII - a opção do autor pela realização ou não de audiência de conciliação ou de mediação.",
  },
];

async function main() {
  const collection = db.collection("vademecum_artigos");
  let criados = 0;

  for (const artigo of artigos) {
    const existente = await collection
      .where("codigo", "==", artigo.codigo)
      .where("numero", "==", artigo.numero)
      .limit(1)
      .get();

    if (existente.empty) {
      await collection.add(artigo);
      criados++;
    }
  }

  console.log(`Seed concluído: ${artigos.length} artigos verificados, ${criados} criados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
