"use client";

import { useState } from "react";

type Estado = "idle" | "gerando" | "pronto" | "baixado" | "erro";

function nomeDoArquivo(resposta: Response) {
  const header = resposta.headers.get("Content-Disposition") || "";
  return /filename="([^"]+)"/.exec(header)?.[1] || "aula.pdf";
}

function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Compartilha a aula como arquivo PDF pelo share nativo do celular (WhatsApp, e-mail...).
 * Sem suporte a compartilhar arquivos (ex: computador), baixa o PDF.
 */
export function ShareButton({
  aulaId,
  title,
  className = "btn-ghost",
}: {
  aulaId: string;
  title: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  // Só fica guardado enquanto espera o segundo toque; depois gera de novo (pega edições novas).
  const [arquivo, setArquivo] = useState<File | null>(null);

  async function enviar(pdf: File, segundoToque = false) {
    const podeCompartilhar =
      typeof navigator !== "undefined" && navigator.canShare?.({ files: [pdf] }) && navigator.share;
    if (!podeCompartilhar) {
      baixar(pdf);
      setArquivo(null);
      setEstado("baixado");
      setTimeout(() => setEstado("idle"), 2500);
      return;
    }
    try {
      await navigator.share({ files: [pdf], title });
      setArquivo(null);
      setEstado("idle");
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") {
        setArquivo(null);
        setEstado("idle"); // cancelou o compartilhamento — não é erro
      } else if (segundoToque) {
        baixar(pdf); // falhou de novo: entrega o arquivo baixado mesmo
        setArquivo(null);
        setEstado("baixado");
        setTimeout(() => setEstado("idle"), 2500);
      } else {
        // iPhone exige um toque "fresco" pra compartilhar; como o PDF demorou pra gerar,
        // deixa pronto e pede mais um toque.
        setEstado("pronto");
      }
    }
  }

  async function compartilhar() {
    if (estado === "gerando") return;
    if (arquivo) return enviar(arquivo, true);

    setEstado("gerando");
    try {
      const resposta = await fetch(`/api/aulas/${encodeURIComponent(aulaId)}/pdf`);
      if (!resposta.ok || !resposta.headers.get("Content-Type")?.includes("pdf")) {
        throw new Error(`HTTP ${resposta.status}`);
      }
      const pdf = new File([await resposta.blob()], nomeDoArquivo(resposta), { type: "application/pdf" });
      setArquivo(pdf);
      await enviar(pdf);
    } catch {
      setEstado("erro");
      setTimeout(() => setEstado("idle"), 2500);
    }
  }

  const rotulo = {
    idle: "📤 Compartilhar PDF",
    gerando: "⏳ Gerando PDF...",
    pronto: "📤 PDF pronto, toque pra enviar",
    baixado: "✅ PDF baixado!",
    erro: "Não deu, tenta de novo",
  }[estado];

  return (
    <button type="button" onClick={compartilhar} disabled={estado === "gerando"} className={className}>
      {rotulo}
    </button>
  );
}
