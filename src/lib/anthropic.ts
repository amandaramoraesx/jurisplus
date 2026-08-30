import Anthropic from "@anthropic-ai/sdk";
import type { QuizPergunta } from "./firestore";

export function isIAConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropicClient() {
  if (!isIAConfigured()) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Extrai e valida o array de perguntas de uma resposta de texto da IA (que deveria ser só JSON). */
export function parseQuizResponse(texto: string): QuizPergunta[] {
  const inicio = texto.indexOf("[");
  const fim = texto.lastIndexOf("]");
  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new Error("A IA não retornou um quiz em formato reconhecível.");
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    throw new Error("A IA não retornou um JSON válido para o quiz.");
  }

  if (!Array.isArray(bruto)) {
    throw new Error("A IA não retornou uma lista de perguntas.");
  }

  const perguntas: QuizPergunta[] = bruto
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.pergunta === "string" && Array.isArray(item.opcoes))
    .map((item) => {
      const opcoes = (item.opcoes as unknown[]).filter((o): o is string => typeof o === "string");
      const respostaCorreta =
        typeof item.respostaCorreta === "number" &&
        item.respostaCorreta >= 0 &&
        item.respostaCorreta < opcoes.length
          ? item.respostaCorreta
          : 0;
      return {
        pergunta: item.pergunta as string,
        opcoes,
        respostaCorreta,
        explicacao: typeof item.explicacao === "string" ? item.explicacao : null,
      };
    })
    .filter((p) => p.opcoes.length >= 2);

  if (perguntas.length === 0) {
    throw new Error("A IA não retornou nenhuma pergunta válida para o quiz.");
  }

  return perguntas;
}

/** Gera um quiz de múltipla escolha a partir de anotações de aula(s), via IA. */
export async function gerarQuizComIA(contexto: string, conteudo: string, quantidade: number): Promise<QuizPergunta[]> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          `Você é um assistente de estudos para uma aluna de Direito no Brasil.`,
          `Com base no conteúdo abaixo (${contexto}), crie um quiz de múltipla escolha com exatamente ${quantidade} perguntas para revisão antes de prova.`,
          `Cada pergunta deve ter 4 alternativas, apenas uma correta, testando compreensão real do conteúdo (não decoreba de frases soltas). Não invente conteúdo que não esteja implícito no material.`,
          `Responda ESTRITAMENTE com um array JSON válido, sem markdown, sem \`\`\`, sem texto antes ou depois, no formato exato:`,
          `[{"pergunta": "...", "opcoes": ["...", "...", "...", "..."], "respostaCorreta": 0, "explicacao": "..."}]`,
          `"respostaCorreta" é o índice (0 a 3) da alternativa certa dentro de "opcoes". "explicacao" é uma frase curta justificando a resposta certa.`,
          ``,
          `Conteúdo:`,
          conteudo,
        ].join("\n"),
      },
    ],
  });

  const texto = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return parseQuizResponse(texto);
}
