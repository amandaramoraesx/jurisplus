"use client";

import { useState } from "react";

/** Compartilha texto pelo share nativo do celular (WhatsApp, etc.); se não tiver, copia pra área de transferência. */
export function ShareButton({
  title,
  text,
  className = "btn-ghost",
}: {
  title: string;
  text: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copiado" | "erro">("idle");

  async function compartilhar() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        // usuária cancelou o compartilhamento — não é erro
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus("copiado");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("erro");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button type="button" onClick={compartilhar} className={className}>
      {status === "copiado" ? "✅ Copiado!" : status === "erro" ? "Não deu, copia à mão" : "📤 Compartilhar"}
    </button>
  );
}
