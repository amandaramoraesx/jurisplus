"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary print:hidden">
      🖨️ Imprimir / Salvar como PDF
    </button>
  );
}
