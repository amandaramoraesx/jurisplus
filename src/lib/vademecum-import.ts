const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Busca uma página do planalto.gov.br e devolve o HTML já decodificado (essas páginas usam ISO-8859-1, não UTF-8). */
export async function buscarHtmlLatin1(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("latin1");
}

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&deg;": "º",
  "&sect;": "§",
};

function decodeEntidades(texto: string): string {
  return texto.replace(/&[a-z]+;/gi, (m) => ENTIDADES[m] ?? m);
}

/** Converte o HTML da página em texto simples, mantendo quebras de linha nos limites de blocos (parágrafos, divs, br). */
export function htmlParaTexto(html: string): string {
  const semScriptStyle = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Colapsa quebras de linha/espaços "de formatação" do HTML original ANTES de inserir
  // as nossas próprias quebras — senão um elemento inline quebrado em várias linhas no
  // arquivo-fonte (ex.: "º" em <sup><u>o</u></sup>) vira 3 "linhas" falsas.
  const espacosNormalizados = semScriptStyle.replace(/\s+/g, " ");
  const comQuebras = espacosNormalizados
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<(p|div|li|h[1-6])[^>]*>/gi, "\n");
  const semTags = comQuebras.replace(/<[^>]+>/g, "");
  return decodeEntidades(semTags);
}

export type ArtigoExtraido = {
  codigo: string;
  numero: string;
  texto: string;
  fonte: string;
};

/**
 * Extrai os artigos de um texto de lei já convertido pra texto simples.
 * Cada "Art. N" no começo de uma linha marca o início de um novo artigo — o texto
 * do artigo é tudo que vem depois, até o próximo "Art. N" de início de linha.
 */
export function extrairArtigos(textoBruto: string, codigo: string, fonte: string): ArtigoExtraido[] {
  const linhas = textoBruto.split("\n").map((l) => l.trim());

  const regexInicioArtigo = /^Art\.\s*(\d+(?:\.\d+)?)\s*[ºo]?\.?\s*(-[A-Za-z])?\.?\s*(.*)$/;

  type Bloco = { numero: string; partes: string[] };
  const blocos: Bloco[] = [];

  for (const linha of linhas) {
    const match = linha.match(regexInicioArtigo);
    if (match) {
      const numero = match[1] + (match[2] ?? "");
      blocos.push({ numero, partes: [match[3]] });
    } else if (blocos.length > 0 && linha) {
      blocos[blocos.length - 1].partes.push(linha);
    }
  }

  return blocos
    .map((bloco) => ({
      codigo,
      numero: bloco.numero,
      texto: bloco.partes.join(" ").replace(/\s+/g, " ").trim(),
      fonte,
    }))
    .filter((artigo) => artigo.texto.length > 0);
}

/**
 * Artigos com o mesmo código+número podem aparecer mais de uma vez quando a página
 * mostra o histórico de redações anteriores (antes de cada emenda). Fica só a versão
 * mais completa (texto mais longo), que na prática é a redação atual/vigente.
 */
export function dedupPorMaisCompleto(artigos: ArtigoExtraido[]): ArtigoExtraido[] {
  const porChave = new Map<string, ArtigoExtraido>();
  for (const artigo of artigos) {
    const chave = `${artigo.codigo}::${artigo.numero}`;
    const existente = porChave.get(chave);
    if (!existente || artigo.texto.length > existente.texto.length) {
      porChave.set(chave, artigo);
    }
  }
  return [...porChave.values()];
}
