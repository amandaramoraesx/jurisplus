import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type SecaoPdf = {
  titulo: string;
  resumo?: string | null;
  lousa?: string | null;
};

// As fontes padrão do PDF só conhecem WinAnsi (Latin-1 + alguns símbolos): acentos e ç
// funcionam, emoji e setas não. Troca o que dá e descarta o resto pra não quebrar a geração.
const EXTRAS_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const TROCAS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "⇒": "=>",
  "≠": "!=",
  "≤": "<=",
  "≥": ">=",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "\t": "    ",
};

function paraWinAnsi(texto: string) {
  let out = "";
  for (const ch of texto.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRAS_WINANSI.has(ch)) {
      out += ch;
    } else if (TROCAS[ch]) {
      out += TROCAS[ch];
    }
  }
  return out;
}

function quebrarLinhas(texto: string, font: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/)) {
    const limpo = paraWinAnsi(paragrafo);
    if (!limpo.trim()) {
      linhas.push("");
      continue;
    }
    let atual = "";
    for (const palavra of limpo.split(/(\s+)/)) {
      const tentativa = atual + palavra;
      if (font.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa;
        continue;
      }
      if (atual.trim()) linhas.push(atual.trimEnd());
      atual = palavra.trimStart();
      // palavra maior que a linha inteira (ex: link): corta em pedaços
      while (font.widthOfTextAtSize(atual, tamanho) > largura) {
        let corte = atual.length - 1;
        while (corte > 1 && font.widthOfTextAtSize(atual.slice(0, corte), tamanho) > largura) corte--;
        linhas.push(atual.slice(0, corte));
        atual = atual.slice(corte);
      }
    }
    linhas.push(atual.trimEnd());
  }
  return linhas;
}

const ROXO = rgb(0.357, 0.227, 0.557);
const CINZA = rgb(0.4, 0.4, 0.4);
const TEXTO = rgb(0.11, 0.1, 0.09);
const LOUSA_FUNDO = rgb(0.93, 0.96, 0.93);
const LOUSA_BORDA = rgb(0.12, 0.23, 0.2);

/** Gera o PDF de uma aula (A4), com cabeçalho, uma seção por autor e a lousa destacada. */
export async function gerarPdfAula({
  disciplina,
  data,
  tema,
  secoes,
}: {
  disciplina: string;
  data: string;
  tema: string;
  secoes: SecaoPdf[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${disciplina} - ${tema}`);
  pdf.setCreator("Juris+");

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const [LARGURA, ALTURA] = [595.28, 841.89];
  const MARGEM = 50;
  const util = LARGURA - MARGEM * 2;

  let pagina: PDFPage = pdf.addPage([LARGURA, ALTURA]);
  let y = ALTURA - MARGEM;

  function garantirEspaco(altura: number) {
    if (y - altura < MARGEM + 20) {
      pagina = pdf.addPage([LARGURA, ALTURA]);
      y = ALTURA - MARGEM;
    }
  }

  function escrever(texto: string, font: PDFFont, tamanho: number, cor = TEXTO, entrelinha = tamanho * 1.45) {
    for (const linha of quebrarLinhas(texto, font, tamanho, util)) {
      garantirEspaco(entrelinha);
      y -= entrelinha;
      if (linha) pagina.drawText(linha, { x: MARGEM, y: y + 3, size: tamanho, font, color: cor });
    }
  }

  // Cabeçalho
  escrever("Juris+", negrito, 10, ROXO);
  escrever(`${disciplina} · ${data}`, normal, 10, CINZA);
  y -= 4;
  escrever(tema, negrito, 18, TEXTO, 24);
  y -= 8;
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: LARGURA - MARGEM, y },
    thickness: 0.7,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 10;

  if (secoes.length === 0) {
    escrever("Esta aula ainda não tem conteúdo registrado.", normal, 11, CINZA);
  }

  for (const secao of secoes) {
    garantirEspaco(50);
    y -= 10;
    escrever(secao.titulo, negrito, 13, ROXO, 18);

    if (secao.resumo) {
      y -= 4;
      escrever("ANOTAÇÕES", negrito, 8, CINZA, 14);
      escrever(secao.resumo, normal, 11);
    }

    if (secao.lousa) {
      y -= 6;
      escrever("LOUSA", negrito, 8, CINZA, 14);
      const tamanho = 10;
      const entrelinha = 15;
      const linhas = quebrarLinhas(secao.lousa, mono, tamanho, util - 20);
      y -= 4;
      for (const [i, linha] of linhas.entries()) {
        const primeira = i === 0;
        const ultima = i === linhas.length - 1;
        // Fundo desenhado linha a linha: o "quadro" continua certinho mesmo quebrando de página.
        const altura = entrelinha + (primeira ? 6 : 0) + (ultima ? 6 : 0);
        garantirEspaco(altura);
        pagina.drawRectangle({
          x: MARGEM,
          y: y - altura,
          width: util,
          height: altura,
          color: LOUSA_FUNDO,
        });
        pagina.drawRectangle({
          x: MARGEM,
          y: y - altura,
          width: 3,
          height: altura,
          color: LOUSA_BORDA,
        });
        if (primeira) y -= 6;
        y -= entrelinha;
        if (linha) pagina.drawText(linha, { x: MARGEM + 12, y: y + 4, size: tamanho, font: mono, color: LOUSA_BORDA });
        if (ultima) y -= 6;
      }
    }
  }

  const paginas = pdf.getPages();
  for (const [i, p] of paginas.entries()) {
    const rodape = `Juris+ · ${paraWinAnsi(disciplina)} · página ${i + 1} de ${paginas.length}`;
    p.drawText(rodape, {
      x: MARGEM,
      y: MARGEM / 2,
      size: 8,
      font: normal,
      color: CINZA,
    });
  }

  return pdf.save();
}

/** Nome de arquivo seguro: "Direito Penal - Coisa julgada - 06-10-2026.pdf". */
export function nomeArquivoPdf(disciplina: string, tema: string, data: string) {
  const base = `${disciplina} - ${tema} - ${data.replaceAll("/", "-")}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w .-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "aula"}.pdf`;
}
