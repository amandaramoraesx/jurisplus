"use client";

import { useEffect } from "react";

/** Abre o <details> cujo id está no #hash da URL (ex: link "editar" da frequência no Início). */
export function AbrirPorHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const alvo = document.getElementById(id);
    if (alvo instanceof HTMLDetailsElement) {
      alvo.open = true;
      alvo.scrollIntoView({ block: "start" });
    }
  }, []);
  return null;
}
